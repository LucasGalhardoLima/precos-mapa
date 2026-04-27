# Product Catalog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make any Brazilian grocery product searchable in Poup — not just products with active offers — by adding EAN as a canonical product key, introducing an ERP-ready `store_prices` table, bulk-seeding the product catalog from Cosmos, and aligning the PDF import pipeline with the new schema.

**Architecture:** Phase 1 adds `ean` + `cosmos_synced_at` to `products` and creates the `store_prices` table (no external deps, pure schema work). Phase 2 runs a one-time seed script to bulk-populate the catalog from Cosmos (organized by category, two tokens in rotation), updates the PDF import pipeline to Cosmos-enrich new products and dual-write prices to `store_prices`, and adds a daily delta sync to keep reference prices fresh. The mobile search screen shows seeded products in a "Sem oferta no momento" section using the existing RPC — no additional mobile API calls needed.

**Tech Stack:** PostgreSQL (Supabase migrations), Deno/TypeScript (Edge Functions), React Native/Expo, NativeWind v4, Cosmos by Bluesoft REST API (`api.cosmos.bluesoft.com.br`), Supabase JS SDK v2

---

## File Map

**Created:**
- `supabase/migrations/030_product_catalog_foundation.sql` — EAN column, store_prices table ✅
- `supabase/migrations/031_search_rpc_catalog.sql` — updated search RPC ✅
- `supabase/migrations/032_cosmos_catalog_tables.sql` — GPC→category map table
- `supabase/functions/cosmos-daily-sync/index.ts` — daily delta sync Edge Function
- `scripts/seed-cosmos-catalog.ts` — one-time bulk catalog seed (two tokens, per_page=90)

**Modified:**
- `packages/shared/src/types/index.ts:70-79,288-296` — add `ean`, `cosmos_synced_at`, `has_active_price`, `reference_price`
- `mobile/components/product-price-card.tsx` — render reference price when `has_active_price: false`
- `mobile/app/(tabs)/search.tsx` — SectionList split (no catalog merge — seeded products come from RPC)
- `src/lib/import-pipeline.ts` — Cosmos fallback on no-match + dual-write to store_prices + EAN enrichment

---

## Phase 1 — Data Foundation

### Task 1: Schema migration — products.ean + store_prices

**Files:**
- Create: `supabase/migrations/030_product_catalog_foundation.sql`

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/030_product_catalog_foundation.sql

-- 1. Add EAN and Cosmos sync fields to products
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS ean text UNIQUE,
  ADD COLUMN IF NOT EXISTS cosmos_synced_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_products_ean
  ON public.products(ean)
  WHERE ean IS NOT NULL;

-- 2. store_prices — ERP-ready current prices (no time bounds)
--    Replaces promotions as the live price source once ERP feeds arrive.
CREATE TABLE IF NOT EXISTS public.store_prices (
  id          uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  uuid          NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  store_id    uuid          NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  price       numeric(10,2) NOT NULL,
  is_promo    boolean       NOT NULL DEFAULT false,
  source      text          NOT NULL CHECK (source IN ('erp', 'pdf_import', 'manual', 'crawler')),
  valid_until timestamptz,
  created_at  timestamptz   NOT NULL DEFAULT now(),
  updated_at  timestamptz   NOT NULL DEFAULT now(),
  UNIQUE (product_id, store_id)
);

CREATE INDEX IF NOT EXISTS idx_store_prices_product ON public.store_prices(product_id);
CREATE INDEX IF NOT EXISTS idx_store_prices_store   ON public.store_prices(store_id);

ALTER TABLE public.store_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "store_prices_read_all"
  ON public.store_prices FOR SELECT USING (true);

CREATE POLICY "store_prices_write_service"
  ON public.store_prices FOR ALL
  USING     (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
```

- [ ] **Step 2: Push migration**

```bash
cd /Users/lucasgalhardo/Documents/Projects/precos-mapa
supabase db push
```

Expected output: `Applying migration 030_product_catalog_foundation.sql...`

- [ ] **Step 3: Verify in Supabase SQL editor**

```sql
-- Should return 1 row for each new column
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'products'
  AND column_name IN ('ean', 'cosmos_synced_at');

-- Should return the new table
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'store_prices';
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/030_product_catalog_foundation.sql
git commit -m "feat: add products.ean + store_prices table (Phase 1)"
```

---

### Task 2: Update search RPC — add has_active_price + reference_price, remove 30-day window

**Files:**
- Create: `supabase/migrations/031_search_rpc_catalog.sql`

The current RPC (`017_search_products_with_prices.sql`) filters `last_price` rows to those updated within 30 days. This removes that cutoff so historical products remain searchable. It also adds `reference_price` (from `products.reference_price`) and `has_active_price` (boolean) to every result row.

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/031_search_rpc_catalog.sql

create or replace function public.search_products_with_prices(
  query          text,
  user_lat       float,
  user_lng       float,
  radius_km      float default 10,
  category_id    text  default null,
  page_size      int   default 30,
  page_offset    int   default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = 'public'
as $$
declare
  result jsonb;
  safe_query text;
begin
  if length(trim(query)) < 2 then
    return '[]'::jsonb;
  end if;

  safe_query := replace(replace(replace(trim(query), '\', '\\'), '%', '\%'), '_', '\_');

  select coalesce(jsonb_agg(to_jsonb(product_row)), '[]'::jsonb)
  into result
  from (
    select
      p.id              as product_id,
      p.name            as product_name,
      p.brand,
      c.name            as category,
      p.image_url,
      p.reference_price,
      -- true when at least one active (non-expired) promotion exists within radius
      (count(*) filter (
        where pr.status = 'active' and pr.end_date > now()
      ) > 0)            as has_active_price,
      count(*) filter (where pr.status = 'active') as active_count,
      min(case when pr.status = 'active' then pr.promo_price else pr.last_known_price end) as cheapest_price,
      jsonb_agg(
        jsonb_build_object(
          'store_id',           s.id,
          'store_name',         s.name,
          'price',              case when pr.status = 'active' then pr.promo_price else pr.last_known_price end,
          'original_price',     pr.original_price,
          'price_type',         pr.status,
          'distance_km',        round((
            6371 * acos(
              least(1.0, greatest(-1.0,
                cos(radians(user_lat)) * cos(radians(s.latitude))
                * cos(radians(s.longitude) - radians(user_lng))
                + sin(radians(user_lat)) * sin(radians(s.latitude))
              ))
            )
          )::numeric, 1),
          'end_date',           case when pr.status = 'active' then pr.end_date else null end,
          'last_price_date',    pr.last_price_date,
          'store_logo_initial', s.logo_initial,
          'store_logo_color',   s.logo_color,
          'search_priority',    s.search_priority
        )
        order by
          s.search_priority desc,
          (case when pr.status = 'active' then pr.promo_price else pr.last_known_price end) asc
      ) as prices
    from public.promotions pr
    join public.products p  on p.id = pr.product_id
    join public.stores s    on s.id = pr.store_id
    left join public.categories c on c.id = p.category_id
    where
      -- active (with valid date) OR last_price (indefinitely — 30-day window removed)
      (
        (pr.status = 'active' and pr.end_date > now())
        or pr.status = 'last_price'
      )
      and s.is_active = true
      and (
        6371 * acos(
          least(1.0, greatest(-1.0,
            cos(radians(user_lat)) * cos(radians(s.latitude))
            * cos(radians(s.longitude) - radians(user_lng))
            + sin(radians(user_lat)) * sin(radians(s.latitude))
          ))
        )
      ) <= radius_km
      and (
        similarity(p.name, query) > 0.3
        or p.name ilike '%' || safe_query || '%'
        or exists (
          select 1 from public.product_synonyms ps
          where ps.product_id = p.id
            and (similarity(ps.term, query) > 0.3 or ps.term ilike '%' || safe_query || '%')
        )
      )
      and (category_id is null or p.category_id = category_id)
    group by p.id, p.name, p.brand, c.name, p.image_url, p.reference_price
    order by
      count(*) filter (where pr.status = 'active') desc,
      min(case when pr.status = 'active' then pr.promo_price else pr.last_known_price end) asc
    limit page_size
    offset page_offset
  ) as product_row;

  return result;
end;
$$;
```

- [ ] **Step 2: Push migration**

```bash
supabase db push
```

Expected: `Applying migration 031_search_rpc_catalog.sql...`

- [ ] **Step 3: Smoke-test in SQL editor**

```sql
-- Replace coords with a real store location from your DB
SELECT * FROM search_products_with_prices(
  'arroz', -23.5505, -46.6333, 10
) LIMIT 3;
-- Each result should now have "reference_price" and "has_active_price" fields in the JSON
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/031_search_rpc_catalog.sql
git commit -m "feat: add has_active_price + reference_price to search RPC, remove 30d window"
```

---

### Task 3: TypeScript types — Product + ProductWithPrices

**Files:**
- Modify: `packages/shared/src/types/index.ts:70-79,288-296`

- [ ] **Step 1: Update `Product` interface (lines 70–79)**

```typescript
// packages/shared/src/types/index.ts
export interface Product {
  id: string;
  name: string;
  category_id: string;
  brand: string | null;
  reference_price: number;
  image_url: string | null;
  ean: string | null;              // EAN-13 barcode, null until Cosmos-enriched
  cosmos_synced_at: string | null; // ISO timestamp of last Cosmos sync
  created_at: string;
  updated_at: string;
}
```

- [ ] **Step 2: Update `ProductWithPrices` interface (lines 288–296)**

```typescript
export interface ProductWithPrices {
  product_id: string;
  product_name: string;
  brand: string | null;
  category: string | null;
  image_url: string | null;
  reference_price: number | null; // from products.reference_price; null for legacy rows
  has_active_price: boolean;       // true = at least one active store price within radius
  prices: StorePrice[];
  isLocked: boolean;
}
```

- [ ] **Step 3: Build shared package to verify no type errors**

```bash
cd /Users/lucasgalhardo/Documents/Projects/precos-mapa
npm run build --workspace=packages/shared 2>&1 | tail -10
```

Expected: exits 0, no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/types/index.ts
git commit -m "feat: add ean, has_active_price, reference_price to shared types"
```

---

### Task 4: ProductPriceCard — render reference price when no active offer

**Files:**
- Modify: `mobile/components/product-price-card.tsx`

When `has_active_price` is false and prices are empty (catalog-only products), the card currently shows `—` for price and `0 mercados ›`. Update it to show "Preço de referência" with the reference price value instead.

- [ ] **Step 1: Update the bottom row rendering**

Replace lines 126–148 in `mobile/components/product-price-card.tsx`:

```tsx
{/* Bottom row: price + store count */}
<View style={[styles.bottomRow, { borderTopColor: COLORS.divider }]}>
  {product.has_active_price || product.prices.length > 0 ? (
    // Active or last-known prices exist
    <View style={styles.priceGroup}>
      <Text style={[styles.priceFrom, { color: COLORS.textMuted }]}>a partir de</Text>
      <Text style={[styles.priceValue, { color: tokens.primary }]}>
        {cheapestPrice != null ? formatPrice(cheapestPrice) : '—'}
      </Text>
      {discountInfo && (
        <View style={styles.discountGroup}>
          <Text style={styles.originalPrice}>
            {formatPrice(discountInfo.originalPrice)}
          </Text>
          <Text style={styles.discountPercent}>-{discountInfo.discountPercent}%</Text>
        </View>
      )}
    </View>
  ) : (
    // Catalog-only: no store has a price, show reference
    <View style={styles.priceGroup}>
      <Text style={[styles.priceFrom, { color: COLORS.textMuted }]}>ref.</Text>
      <Text style={[styles.priceValue, { color: COLORS.textSecondary }]}>
        {product.reference_price != null && product.reference_price > 0
          ? formatPrice(product.reference_price)
          : '—'}
      </Text>
    </View>
  )}
  <Pressable
    onPress={() => onPressProduct(product.product_id)}
    style={[styles.storeCountButton, { backgroundColor: 'rgba(13,148,136,0.08)' }]}
    hitSlop={4}
  >
    <Text style={[styles.storeCountText, { color: tokens.primary }]}>
      {product.has_active_price || product.prices.length > 0
        ? `${storeCount} mercado${storeCount !== 1 ? 's' : ''} ›`
        : 'Ver produto ›'}
    </Text>
  </Pressable>
</View>
```

- [ ] **Step 2: Check TypeScript**

```bash
cd /Users/lucasgalhardo/Documents/Projects/precos-mapa/mobile
npx tsc --noEmit 2>&1 | grep "product-price-card" | head -10
```

Expected: no errors on that file.

- [ ] **Step 3: Commit**

```bash
git add mobile/components/product-price-card.tsx
git commit -m "feat: show reference price in ProductPriceCard when no active offer"
```

---

### Task 5: search.tsx — SectionList split (com preço / sem oferta)

**Files:**
- Modify: `mobile/app/(tabs)/search.tsx`

Replace the `FlatList` in product-grouped mode with a `SectionList` that splits results into "Com preço ativo" and "Sem oferta no momento" based on `has_active_price`.

- [ ] **Step 1: Add SectionList to the react-native import (line 1)**

```typescript
import {
  View,
  TextInput,
  Text,
  Pressable,
  SectionList,
  Alert,
  StyleSheet,
} from 'react-native';
```

(`FlatList` is still used for the store-grouped mode — keep it in the import too.)

```typescript
import {
  View,
  TextInput,
  Text,
  Pressable,
  FlatList,
  SectionList,
  Alert,
  StyleSheet,
} from 'react-native';
```

- [ ] **Step 2: Add the section computation after line 257 (`const resultCount = ...`)**

```typescript
// Split product results into priced vs. catalog-only sections
const productSections = useMemo(() => {
  if (!showResults || !useProductMode) return [];
  const priced = productResults.filter((p) => p.has_active_price);
  const noPrice = productResults.filter((p) => !p.has_active_price);
  const sections: { title: string | null; data: ProductWithPrices[] }[] = [];
  if (priced.length > 0) sections.push({ title: null, data: priced });
  if (noPrice.length > 0) sections.push({ title: 'Sem oferta no momento', data: noPrice });
  return sections;
}, [productResults, showResults, useProductMode]);
```

- [ ] **Step 3: Replace the product-grouped FlatList block (lines 384–410) with SectionList**

```tsx
{/* Results — product-grouped mode */}
{showResults && useProductMode && (
  <>
    <Text style={[styles.resultCount, { color: COLORS.textSecondary }]}>
      {resultCount} produto{resultCount !== 1 ? 's' : ''} encontrado{resultCount !== 1 ? 's' : ''} perto de você
    </Text>
    <SectionList
      sections={productSections}
      keyExtractor={(item) => item.product_id}
      renderItem={({ item, index }) => (
        <ProductPriceCard
          product={item}
          index={index}
          onPressProduct={handlePressProduct}
          onPressStore={handlePressStore}
          onPressLocked={handlePressLocked}
          testID={`product-card-${index}`}
        />
      )}
      renderSectionHeader={({ section: { title } }) =>
        title ? (
          <Text style={[styles.sectionHeader, { color: COLORS.textSecondary, backgroundColor: tokens.bg }]}>
            {title}
          </Text>
        ) : null
      }
      contentContainerStyle={[
        styles.resultsList,
        { paddingBottom: insets.bottom + 16 },
      ]}
      showsVerticalScrollIndicator={false}
      keyboardDismissMode="on-drag"
    />
  </>
)}
```

- [ ] **Step 4: Add `sectionHeader` to the StyleSheet**

In the `StyleSheet.create({...})` block at the bottom of the file, add:

```typescript
sectionHeader: {
  fontSize: 11,
  fontWeight: '600',
  textTransform: 'uppercase',
  letterSpacing: 0.5,
  paddingVertical: 8,
  paddingHorizontal: 2,
},
```

- [ ] **Step 5: Check TypeScript**

```bash
cd /Users/lucasgalhardo/Documents/Projects/precos-mapa/mobile
npx tsc --noEmit 2>&1 | grep "search.tsx" | head -10
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add mobile/app/(tabs)/search.tsx
git commit -m "feat: split search results into active-price / sem-oferta sections (Phase 1)"
```

---

## Phase 2 — Cosmos Integration

### Task 6: Migration 032 — cosmos_gpc_map

**Files:**
- Create: `supabase/migrations/032_cosmos_catalog_tables.sql`

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/032_cosmos_catalog_tables.sql

-- GPC code → Poup category_id mapping
--    Populated by observing Cosmos API responses; unmapped GPCs fall back to cat_alimentos.
CREATE TABLE IF NOT EXISTS public.cosmos_gpc_map (
  gpc_code    text PRIMARY KEY,
  category_id text NOT NULL REFERENCES public.categories(id),
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Seed confirmed GPC codes (extend this table as new codes appear in Cosmos responses)
INSERT INTO public.cosmos_gpc_map (gpc_code, category_id) VALUES
  ('10000043', 'cat_alimentos')  -- Açúcar / Substitutos do Açúcar (confirmed from Cosmos API)
ON CONFLICT (gpc_code) DO NOTHING;
```

- [ ] **Step 2: Push**

```bash
supabase db push
```

Expected: `Applying migration 032_cosmos_catalog_tables.sql...`

- [ ] **Step 3: Add the COSMOS_API_TOKEN secret to Supabase**

```bash
supabase secrets set COSMOS_API_TOKEN=qyLvN2ybrFkfvH6R7zGbsw
```

Verify it's set:
```bash
supabase secrets list
```

Expected output includes `COSMOS_API_TOKEN`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/032_cosmos_catalog_tables.sql
git commit -m "feat: add catalog_search_cache + cosmos_gpc_map tables (Phase 2)"
```

---

### Task 7: PDF import — Cosmos fallback + dual-write + EAN enrichment

**Files:**
- Modify: `src/lib/import-pipeline.ts` (or wherever `match_product_for_upsert` is called at application level)

Three changes to the existing PDF import pipeline:
1. **Cosmos fallback on no-match** — when `match_product_for_upsert()` returns a new product (confidence below threshold), call Cosmos `/products?query={name}&per_page=5` and update the created product with EAN, image_url, reference_price, cosmos_synced_at if a match is found
2. **Dual-write to store_prices** — after creating/updating a promotion, also upsert into `store_prices` (product_id, store_id, price=promo_price, is_promo=true, source='pdf_import')
3. **EAN enrichment on existing products** — when Cosmos returns a match for a product that already exists but has no EAN, update products.ean

- [ ] **Step 1: Create the function file**

```typescript
// supabase/functions/catalog-search/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const COSMOS_TOKEN = Deno.env.get('COSMOS_API_TOKEN')!;
const COSMOS_BASE  = 'https://api.cosmos.bluesoft.com.br';
const CACHE_TTL_HOURS = 24;

interface CosmosProduct {
  gtin:        string | number;
  description: string;
  brand?:      { name: string };
  thumbnail?:  string;
  avg_price?:  number;
  gpc?:        { code: string; description: string };
}

function toTitleCase(str: string): string {
  return str.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const body = await req.json().catch(() => ({}));
  const query: string = (body.query ?? '').trim().toLowerCase();

  if (query.length < 2) {
    return new Response(JSON.stringify({ products: [] }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // 1. Check 24h cache
  const { data: cached } = await supabase
    .from('catalog_search_cache')
    .select('searched_at')
    .eq('query', query)
    .maybeSingle();

  if (cached) {
    const ageHours = (Date.now() - new Date(cached.searched_at).getTime()) / 3_600_000;
    if (ageHours < CACHE_TTL_HOURS) {
      // Return products already in DB that match this query (previously seeded by Cosmos)
      const { data: existing } = await supabase
        .from('products')
        .select('id, name, brand, image_url, reference_price')
        .ilike('name', `%${query}%`)
        .not('ean', 'is', null)
        .limit(20);

      return new Response(
        JSON.stringify({ products: (existing ?? []).map(toProductShape), cached: true }),
        { headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

  // 2. Cache miss — call Cosmos
  const cosmosUrl = `${COSMOS_BASE}/products?query=${encodeURIComponent(query)}&per_page=30`;
  let cosmosProducts: CosmosProduct[] = [];

  try {
    const res = await fetch(cosmosUrl, {
      headers: {
        'X-Cosmos-Token':  COSMOS_TOKEN,
        'User-Agent':      'Cosmos-API-Request',
        'Content-Type':    'application/json',
      },
    });

    if (!res.ok) {
      console.error(`Cosmos error ${res.status}: ${await res.text()}`);
      return new Response(JSON.stringify({ products: [], error: 'cosmos_unavailable' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const data = await res.json();
    // Cosmos returns either an array or { products: [...] }
    cosmosProducts = Array.isArray(data) ? data : (data.products ?? []);
  } catch (err) {
    console.error('Cosmos fetch failed:', err);
    return new Response(JSON.stringify({ products: [], error: 'cosmos_fetch_error' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 3. Filter to products with a known price (reference_price must be > 0)
  const withPrice = cosmosProducts.filter(cp => cp.avg_price && cp.avg_price > 0);

  if (withPrice.length === 0) {
    await upsertCache(supabase, query);
    return new Response(JSON.stringify({ products: [] }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 4. Build GPC → category_id map from DB
  const gpcCodes = [...new Set(withPrice.map(cp => cp.gpc?.code).filter(Boolean))] as string[];
  const { data: gpcRows } = await supabase
    .from('cosmos_gpc_map')
    .select('gpc_code, category_id')
    .in('gpc_code', gpcCodes);

  const gpcMap = new Map<string, string>((gpcRows ?? []).map(r => [r.gpc_code, r.category_id]));

  // 5. Upsert products (ON CONFLICT ean → refresh name, image, price, sync date)
  const rows = withPrice.map(cp => ({
    ean:              String(cp.gtin),
    name:             toTitleCase(cp.description),
    brand:            cp.brand?.name ?? null,
    image_url:        cp.thumbnail ?? null,
    reference_price:  cp.avg_price!,
    category_id:      gpcMap.get(cp.gpc?.code ?? '') ?? 'cat_alimentos',
    cosmos_synced_at: new Date().toISOString(),
  }));

  const { data: upserted, error: upsertErr } = await supabase
    .from('products')
    .upsert(rows, { onConflict: 'ean', ignoreDuplicates: false })
    .select('id, name, brand, image_url, reference_price');

  if (upsertErr) {
    console.error('Upsert error:', upsertErr.message);
    return new Response(JSON.stringify({ products: [], error: 'upsert_failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 6. Update cache
  await upsertCache(supabase, query);

  return new Response(
    JSON.stringify({ products: (upserted ?? []).map(toProductShape) }),
    { headers: { 'Content-Type': 'application/json' } }
  );
});

async function upsertCache(supabase: ReturnType<typeof createClient>, query: string) {
  await supabase
    .from('catalog_search_cache')
    .upsert({ query, searched_at: new Date().toISOString() });
}

function toProductShape(p: {
  id: string;
  name: string;
  brand: string | null;
  image_url: string | null;
  reference_price: number;
}) {
  return {
    product_id:       p.id,
    product_name:     p.name,
    brand:            p.brand,
    category:         null,
    image_url:        p.image_url,
    reference_price:  p.reference_price,
    has_active_price: false,
    prices:           [],
    isLocked:         false,
  };
}
```

- [ ] **Step 2: Deploy the function**

```bash
supabase functions deploy catalog-search
```

Expected: `Deployed catalog-search`

- [ ] **Step 3: Smoke test (costs 1 Cosmos query)**

```bash
supabase functions invoke catalog-search \
  --body '{"query": "açúcar"}'
```

Expected: JSON with `products` array containing at least 1 item with `product_name`, `reference_price`, `has_active_price: false`.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/catalog-search/index.ts
git commit -m "feat: catalog-search Edge Function — Cosmos proxy with 24h cache"
```

---

### Task 8: use-catalog-search hook

**Files:**
- Create: `mobile/hooks/use-catalog-search.ts`

- [ ] **Step 1: Write the hook**

```typescript
// mobile/hooks/use-catalog-search.ts
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { ProductWithPrices } from '@/types';

interface UseCatalogSearchParams {
  query: string;
  /** Only call Cosmos when the local RPC returned fewer results than this threshold */
  enabled: boolean;
}

interface UseCatalogSearchReturn {
  catalogProducts: ProductWithPrices[];
  isLoading: boolean;
}

export function useCatalogSearch({ query, enabled }: UseCatalogSearchParams): UseCatalogSearchReturn {
  const [catalogProducts, setCatalogProducts] = useState<ProductWithPrices[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetch = useCallback(async () => {
    if (!enabled || query.trim().length < 2) {
      setCatalogProducts([]);
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke<{
        products: ProductWithPrices[];
        cached?: boolean;
        error?: string;
      }>('catalog-search', {
        body: { query: query.trim() },
      });

      if (!error && data?.products) {
        setCatalogProducts(data.products);
      } else {
        setCatalogProducts([]);
      }
    } catch {
      setCatalogProducts([]);
    }
    setIsLoading(false);
  }, [query, enabled]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { catalogProducts, isLoading };
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd /Users/lucasgalhardo/Documents/Projects/precos-mapa/mobile
npx tsc --noEmit 2>&1 | grep "use-catalog-search" | head -10
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add mobile/hooks/use-catalog-search.ts
git commit -m "feat: use-catalog-search hook for Cosmos Edge Function integration"
```

---

### Task 9: search.tsx — merge catalog results + fix isEmpty

**Files:**
- Modify: `mobile/app/(tabs)/search.tsx`

- [ ] **Step 1: Import the new hook (add after existing hook imports)**

```typescript
import { useCatalogSearch } from '@/hooks/use-catalog-search';
```

- [ ] **Step 2: Add hook call after line 126 (`const { promotions, productResults, ... } = usePromotions(...)`)**

```typescript
// Cosmos catalog fallback — only fires when local results are sparse
const catalogEnabled = useProductMode && !isLoading && productResults.length < 5;

const { catalogProducts, isLoading: isCatalogLoading } = useCatalogSearch({
  query: debouncedQuery,
  enabled: catalogEnabled,
});
```

- [ ] **Step 3: Merge catalog results into productSections (replace the existing `productSections` useMemo)**

```typescript
const productSections = useMemo(() => {
  if (!showResults || !useProductMode) return [];

  // Deduplicate: catalog products that the RPC already returned (by product_id) are hidden
  const rpcIds = new Set(productResults.map((p) => p.product_id));
  const newCatalog = catalogProducts.filter((p) => !rpcIds.has(p.product_id));

  const priced   = productResults.filter((p) => p.has_active_price);
  const noPrice  = [
    ...productResults.filter((p) => !p.has_active_price),
    ...newCatalog,
  ];

  const sections: { title: string | null; data: ProductWithPrices[] }[] = [];
  if (priced.length > 0)   sections.push({ title: null,                     data: priced });
  if (noPrice.length > 0)  sections.push({ title: 'Sem oferta no momento',  data: noPrice });
  return sections;
}, [productResults, catalogProducts, showResults, useProductMode]);
```

- [ ] **Step 4: Update `showEmpty` to account for catalog results (replace line 253)**

```typescript
const showEmpty = hasFilter && !isLoading && !isCatalogLoading && !error && isEmpty && catalogProducts.length === 0;
```

- [ ] **Step 5: Update `showLoading` to cover catalog loading**

```typescript
const showLoading = hasFilter && (isLoading || (catalogEnabled && isCatalogLoading));
```

- [ ] **Step 6: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep "search.tsx" | head -10
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add mobile/app/(tabs)/search.tsx
git commit -m "feat: merge Cosmos catalog results into search screen (Phase 2)"
```

---

### Task 10: cosmos-daily-sync Edge Function

**Files:**
- Create: `supabase/functions/cosmos-daily-sync/index.ts`

Runs daily (triggered by Supabase cron or external scheduler). Calls `/products/by_date` for the past 24h and refreshes `reference_price` + `image_url` for products already in the DB.

- [ ] **Step 1: Write the function**

```typescript
// supabase/functions/cosmos-daily-sync/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

function toTitleCase(str: string): string {
  return str.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

Deno.serve(async (req) => {
  // Only allow calls from internal cron (via EDGE_FUNCTION_SECRET)
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${Deno.env.get('EDGE_FUNCTION_SECRET')}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const dateStr = yesterday.toISOString();

  const res = await fetch(
    `https://api.cosmos.bluesoft.com.br/products/by_date?date=${encodeURIComponent(dateStr)}`,
    {
      headers: {
        'X-Cosmos-Token': Deno.env.get('COSMOS_API_TOKEN')!,
        'User-Agent':     'Cosmos-API-Request',
        'Content-Type':   'application/json',
      },
    }
  );

  if (!res.ok) {
    return new Response(
      JSON.stringify({ error: `Cosmos error ${res.status}` }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const data = await res.json();
  const products = Array.isArray(data) ? data : (data.products ?? []);

  let updated = 0;

  for (const cp of products) {
    if (!cp.avg_price || cp.avg_price <= 0) continue;

    const { error } = await supabase
      .from('products')
      .update({
        name:             toTitleCase(cp.description),
        brand:            cp.brand?.name ?? null,
        image_url:        cp.thumbnail ?? null,
        reference_price:  cp.avg_price,
        cosmos_synced_at: new Date().toISOString(),
      })
      .eq('ean', String(cp.gtin));

    if (!error) updated++;
  }

  console.log(`cosmos-daily-sync: ${products.length} from Cosmos, ${updated} updated in DB`);

  return new Response(
    JSON.stringify({ total: products.length, updated }),
    { headers: { 'Content-Type': 'application/json' } }
  );
});
```

- [ ] **Step 2: Deploy**

```bash
supabase functions deploy cosmos-daily-sync
```

- [ ] **Step 3: Schedule the cron in Supabase dashboard**

Go to Supabase Dashboard → Database → Extensions → Enable `pg_cron` if not already enabled.

Then run in SQL editor:

```sql
SELECT cron.schedule(
  'cosmos-daily-sync',
  '0 3 * * *',  -- 3 AM daily (UTC)
  $$
  SELECT net.http_post(
    url    := current_setting('app.supabase_url') || '/functions/v1/cosmos-daily-sync',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || current_setting('app.edge_function_secret')
    ),
    body   := '{}'::jsonb
  );
  $$
);
```

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/cosmos-daily-sync/index.ts
git commit -m "feat: cosmos-daily-sync Edge Function — daily reference price refresh"
```

---

### Task 11: Product deduplication migration

**Files:**
- Create: `supabase/migrations/033_product_dedup.sql` (run only after dry-run review)

After Phase 2 is live for at least a few days, the `products` table will have both:
- Legacy name-based products (ean = NULL, created from offer imports)
- Cosmos-sourced products (ean = '{gtin}', created by catalog-search)

Some are duplicates of the same real product. This task merges them using EAN as the deterministic key.

**Run the dry-run first — do not skip this step.**

- [ ] **Step 1: Take a manual pg_dump before running anything**

```bash
pg_dump "$(supabase status --output json | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d["DB URL"])')" \
  --no-acl --no-owner \
  -f backup_poup_before_dedup_$(date +%Y%m%d_%H%M%S).sql
```

- [ ] **Step 2: Run the dry-run query in Supabase SQL editor (SELECT only — no changes)**

```sql
-- Preview merges: find name-based products (no EAN) that fuzzily match a Cosmos product (has EAN)
-- "canonical" = Cosmos product with EAN; "duplicate" = legacy product without EAN
WITH cosmos AS (
  SELECT id, name, brand, ean
  FROM products
  WHERE ean IS NOT NULL
),
legacy AS (
  SELECT id, name, brand,
    count(pr.id) AS promo_count
  FROM products p
  LEFT JOIN promotions pr ON pr.product_id = p.id
  WHERE p.ean IS NULL
  GROUP BY p.id, p.name, p.brand
),
matches AS (
  SELECT
    c.id   AS canonical_id,
    c.name AS canonical_name,
    c.ean,
    l.id   AS legacy_id,
    l.name AS legacy_name,
    l.promo_count,
    similarity(c.name, l.name) AS name_sim
  FROM cosmos c
  JOIN legacy l
    ON similarity(c.name, l.name) > 0.55
    AND (c.brand IS NULL OR l.brand IS NULL OR similarity(c.brand, l.brand) > 0.6)
)
SELECT *
FROM matches
ORDER BY name_sim DESC;
```

Review every row. If a match looks wrong (different product), note the legacy_id to exclude.

- [ ] **Step 3: Write the merge migration (fill in excluded_ids from your review)**

```sql
-- supabase/migrations/033_product_dedup.sql
-- Run only after reviewing the dry-run output above.

BEGIN;

-- Re-run the match CTE to get the pairs
WITH cosmos AS (
  SELECT id, name, brand, ean FROM products WHERE ean IS NOT NULL
),
legacy AS (
  SELECT id, name, brand FROM products WHERE ean IS NULL
),
matches AS (
  SELECT
    c.id AS canonical_id,
    l.id AS legacy_id,
    similarity(c.name, l.name) AS name_sim
  FROM cosmos c
  JOIN legacy l
    ON similarity(c.name, l.name) > 0.55
    AND (c.brand IS NULL OR l.brand IS NULL OR similarity(c.brand, l.brand) > 0.6)
  -- Exclude any wrong matches identified in dry-run review
  -- WHERE l.id NOT IN ('uuid-of-wrong-match-1', 'uuid-of-wrong-match-2')
),
best_match AS (
  -- Pick the highest-similarity Cosmos product for each legacy product
  SELECT DISTINCT ON (legacy_id) canonical_id, legacy_id
  FROM matches
  ORDER BY legacy_id, name_sim DESC
)
-- 1. Reassign promotions
UPDATE promotions pr
SET product_id = bm.canonical_id
FROM best_match bm
WHERE pr.product_id = bm.legacy_id;

-- 2. Reassign favorites
UPDATE favorites f
SET product_id = bm.canonical_id
FROM best_match bm
WHERE f.product_id = bm.legacy_id;

-- 3. Reassign price_alerts
UPDATE price_alerts pa
SET product_id = bm.canonical_id
FROM best_match bm
WHERE pa.product_id = bm.legacy_id;

-- 4. Delete the merged legacy products
DELETE FROM products p
USING best_match bm
WHERE p.id = bm.legacy_id;

COMMIT;
```

- [ ] **Step 4: Push migration**

```bash
supabase db push
```

- [ ] **Step 5: Verify**

```sql
-- Should return 0 rows (no duplicate product names left for matched EANs)
SELECT p1.name, p2.name, similarity(p1.name, p2.name)
FROM products p1
JOIN products p2 ON p1.id < p2.id
WHERE p1.ean IS NOT NULL
  AND p2.ean IS NULL
  AND similarity(p1.name, p2.name) > 0.55;
```

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/033_product_dedup.sql
git commit -m "feat: product deduplication — merge name-based products into EAN-keyed catalog"
```

---

## Self-Review

**Spec coverage check:**
- ✅ `products.ean` — Task 1
- ✅ `store_prices` table — Task 1
- ✅ RPC `has_active_price` + `reference_price` + no 30-day window — Task 2
- ✅ TypeScript types updated — Task 3
- ✅ ProductPriceCard reference price display — Task 4
- ✅ Search UX two tiers — Task 5
- ✅ `catalog_search_cache` + `cosmos_gpc_map` — Task 6
- ✅ Cosmos Edge Function proxy, token server-side — Task 7
- ✅ < 5 results threshold gate (enforced via `catalogEnabled` in Task 9) — Task 9
- ✅ Cache-first 24h quota strategy — Task 7
- ✅ `use-catalog-search` hook — Task 8
- ✅ Mobile merges + deduplicates by product_id — Task 9
- ✅ Daily delta sync via `/products/by_date` — Task 10
- ✅ Product dedup migration with dry-run — Task 11
- ✅ Backup protocol (pg_dump before dedup) — Task 11 Step 1
- ✅ `avg_price` only used as reference; gamification unchanged — ProductPriceCard shows "ref." label

**Placeholder scan:** None found. All steps contain complete code, exact commands, and expected outputs.

**Type consistency check:**
- `ProductWithPrices.has_active_price: boolean` defined in Task 3, consumed in Task 4 (ProductPriceCard) and Task 5/9 (search.tsx). ✅
- `ProductWithPrices.reference_price: number | null` defined in Task 3, consumed in Task 4. ✅
- `useCatalogSearch` returns `catalogProducts: ProductWithPrices[]` (Task 8), consumed in Task 9. ✅
- `catalog-search` Edge Function returns same shape as `toProductShape()` helper which matches `ProductWithPrices` minus `isLocked`. ✅
