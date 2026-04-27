# Product Catalog — Design Spec
**Date:** 2026-04-27  
**Status:** Approved for implementation

## Problem

Poup's search returns nothing when a user searches for a product that has never had an active offer submitted. Offers were always a bootstrap mechanism — the real product vision is to show the best current price across nearby supermarkets for any product. This requires a canonical product catalog that exists independently of price data.

## Vision

Products are first-class entities. Prices (from offers, PDF imports, or future ERP feeds) are the time-varying layer on top. Any product in the Cosmos database is searchable in Poup, regardless of whether any store has submitted a price for it.

## North Star Architecture

```
Phase 1 (now)       Phase 2 (Cosmos)      Phase 3 (ERP)
─────────────────   ──────────────────    ─────────────────
products + ean      catalog seeded         ERP price feed
store_prices        via Cosmos API         writes to
table created       on-demand search       store_prices
                    enrichment             keyed by EAN
```

---

## Approach: Catalog-First with Deferred Dedup (Approach B)

Add EAN as the canonical product key now. Defer product deduplication to Phase 2 when EAN matching makes merges deterministic. Keep `promotions` as the legacy price source during transition; `store_prices` is the ERP-ready slot.

---

## Phase 1 — Data Model (no external dependency)

### Schema changes

**`products` table:**
```sql
ALTER TABLE products ADD COLUMN ean text UNIQUE;
ALTER TABLE products ADD COLUMN cosmos_synced_at timestamptz;
```

`ean` is nullable — existing products don't have it yet. It gets populated opportunistically in Phase 2 via Cosmos matching.

**New `store_prices` table:**
```sql
CREATE TABLE store_prices (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  store_id    uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  price       numeric(10,2) NOT NULL,
  is_promo    boolean DEFAULT false,
  source      text NOT NULL CHECK (source IN ('erp', 'pdf_import', 'manual', 'crawler')),
  valid_until timestamptz,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now(),
  UNIQUE (product_id, store_id)
);
```

No start/end dates — a store's price is valid until replaced by a newer entry. This is intentionally different from `promotions` (time-bounded deals). ERP feeds will write here.

### Search RPC change

`search_products_with_prices` gets a `has_active_price boolean` field on each result row. The 30-day `last_price` fallback window is removed — products now persist indefinitely once created. The mobile groups results by this flag.

### What does NOT change in Phase 1

- `promotions` table — untouched, stays the active price source
- `match_product_for_upsert` — unchanged
- PDF import pipeline — unchanged
- Mobile search UI — minor: add "sem oferta no momento" section header

---

## Phase 2 — Cosmos Catalog Integration

### Data source: Cosmos by Bluesoft

- **Endpoint:** `https://api.cosmos.bluesoft.com.br`
- **Auth:** `X-Cosmos-Token` header + `User-Agent: Cosmos-API-Request`
- **Free tier:** 25 queries/day
- **Key endpoints used:**
  - `GET /gtins/{ean}` — barcode lookup (D2 barcode scanning)
  - `GET /products?query={term}` — name search, 30 results/page (max 90 with `per_page`)
  - `GET /products/by_date?date={ISO8601}` — delta sync, max 7-day window

### Field mapping

| Cosmos field | Poup `products` field | Notes |
|---|---|---|
| `gtin` | `ean` | Canonical key |
| `description` | `name` | Normalized to title case |
| `brand.name` | `brand` | |
| `thumbnail` | `image_url` | CDN URL: `cdn-cosmos.bluesoft.com.br/products/{gtin}` |
| `avg_price` | `reference_price` | Seed value only — overridden by real promotion median once 3+ data points exist |
| `gpc.code` | `category_id` | Via static GPC→category mapping table (see below) |

### GPC → category mapping

A static `cosmos_gpc_map` table maps Cosmos GPC codes to Poup's internal category IDs. Unmapped GPCs fall back to a generic "Outros" category. Mapping is populated once at setup and updated manually as new categories emerge.

### Architecture: Edge Function proxy

The Cosmos token never lives in the mobile app. All calls go through a Supabase Edge Function:

```
Mobile
  ├─► RPC search_products_with_prices   (existing, returns priced products)
  └─► Edge Function: catalog-search     (new, returns catalog-only products)
        │
        ├─ Check catalog_search_cache (TTL 24h per query term)
        ├─ If cache miss → GET /products?query={term} on Cosmos
        ├─ Upsert new products into `products` table (on conflict ean → update)
        └─ Return new product IDs to mobile

Mobile merges both result sets, deduplicates by product_id / ean
```

**`catalog_search_cache` table:**
```sql
CREATE TABLE catalog_search_cache (
  query      text PRIMARY KEY,
  searched_at timestamptz DEFAULT now()
);
```

Simple — one row per query term. If `searched_at` is within 24 hours, skip Cosmos. No Redis needed.

### Quota management

- Cache-first: each unique search term costs 1 Cosmos query per 24h regardless of how many users search it
- Threshold gate: only call Cosmos if local RPC returns < 5 results for the term
- Popular terms (arroz, feijão, leite) will be cached within hours and never hit quota again
- At 25/day free tier, quota is consumed by net-new search terms only
- Upgrade to paid tier when daily cache misses consistently approach the limit (growth signal)

### Product deduplication (Phase 2 only)

Once Cosmos is integrated, existing `products` rows get EANs attached via name+brand fuzzy match against Cosmos results. Duplicates (same EAN, multiple rows) are merged:

1. Run dry-run SELECT to preview merges — review before committing
2. Pick the canonical row (highest promotion count wins)
3. Reassign all FK references (`promotions`, `favorites`, `price_alerts`) to canonical row
4. Soft-delete or hard-delete duplicates
5. Wrap entire operation in a transaction — take a manual `pg_dump` backup first

### Daily delta sync (cron)

A Supabase scheduled function runs daily:
```
GET /products/by_date?date={yesterday ISO8601}
→ upsert updated products (refreshes reference_price, image_url)
→ costs 1 Cosmos query regardless of result count
```

Keeps reference prices and images fresh for products already in the catalog.

---

## Phase 3 — ERP Integration (future)

When a supermarket partner provides an ERP price feed:
1. Feed arrives keyed by EAN (standard in Brazilian retail ERPs — TOTVS, SAP B1, Bling, etc.)
2. Lookup `products.ean` → get `product_id`
3. Upsert into `store_prices` (price, is_promo, source='erp', valid_until=null)
4. No schema changes needed — the table is already ERP-ready

The `promotions` table is eventually retired or kept only for historical records. `store_prices` becomes the live price source, and `search_products_with_prices` reads from it instead.

---

## Search UX — Result Tiers

```
Search: "arroz"

┌─ Com preço ativo ──────────────────────────────┐
│ Arroz Tio João 1kg     R$4,99 → Carrefour      │
│ Arroz Camil 1kg        R$5,49 → Pão de Açúcar  │
└────────────────────────────────────────────────┘

┌─ Sem oferta no momento ────────────────────────┐
│ Arroz Namorado 1kg     ref: R$6,20             │
│ Arroz Urbano 1kg       ref: R$5,80             │
└────────────────────────────────────────────────┘
```

"Sem oferta" products show Cosmos `avg_price` as reference — clearly labeled, not a real store price. Users can tap to create a price alert. Alert volume per product becomes a demand signal for store partnership conversations.

`avg_price` is used as reference only. The "Você evitou pagar caro!" savings gamification triggers only after 3+ real promotion data points exist for the product — never on Cosmos reference price alone.

---

## Backup Protocol

- **Before Phase 1 migrations:** verify Supabase scheduled backup is recent (< 24h) or run `pg_dump` manually
- **Before Phase 2 dedup:** mandatory `pg_dump` — this is the only destructive operation in the plan
- **Project is on Supabase Pro** — daily automated backups, 7-day retention

---

## Out of Scope

- Nutritional data / Nutri-Score (Open Food Facts — D2 at earliest, ODbL license requires careful integration)
- GS1 Brasil CNP access (requires institutional partnership)
- SEFAZ/NF-e real-price data (requires Brazilian taxpayer credentials + legal framework)
- Barcode scanning UI (D2, gamification layer — EAN infrastructure built now so it's a thin UI addition later)
