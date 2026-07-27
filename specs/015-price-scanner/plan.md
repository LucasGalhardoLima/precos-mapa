# 015 — Price Scanner (Barcode + NFC-e)

> Status: Draft, refined against research (see below)  
> Goal: Let users contribute real shelf prices and receipt data to build the product/price database.

---

## Research findings that changed this plan

Four things researched against this exact codebase and current external reality — each corrects or firms up an assumption in the original draft:

1. **Scanning library**: `vision-camera-code-scanner` (named in the original draft) is dead/superseded. Use **react-native-vision-camera v4**'s built-in `useCodeScanner` hook instead — no separate plugin needed. A custom native AVFoundation/VisionKit module is not worth building: `expo-camera` already wraps both `AVCaptureMetadataOutput` and VisionKit's `DataScannerViewController` for free, and the real choice is vision-camera vs. expo-camera, not "library vs. native module." vision-camera wins here because a custom-branded scan screen (Economia Verde design system) needs an embeddable camera view, which rules out expo-camera's `launchScanner()` (Apple's fixed native modal, iOS-only).
2. **NFC-e is *not* certificate-gated** — the original draft's risk ("some states require digital certificate") conflates NFC-e (model 65, consumer receipts) with NF-e (model 55, B2B), which *did* get locked behind certificates in 2020. NFC-e's public consulta page is designed for exactly this use case (a consumer scanning their own receipt) and stays open. The real complexity is different: there's no clean REST/XML API — it's a **per-state HTML page to scrape**, not a documented endpoint, and the base domain varies by UF (SP: `nfce.fazenda.sp.gov.br`) even though the QR param schema is national. Several Brazilian consumer apps (NotaAi, Economiza Club) already do this. **Recommend scoping NFC-e v1 to São Paulo only.**
3. **Data model must reuse the anonymous-ID infra already built this session**, not invent a second one. `packages/shared/src/lib/anonymous-id.ts` exports `getAnonymousId(): Promise<string>`, a UUID persisted via `expo-secure-store`, already wired into `analytics_events.anonymous_id` (migration `049`). `price_reports.anonymous_id` should be `uuid`, not `text`, and should call the same `getAnonymousId()` — see Data Model below.
4. **Camera permissions are net-new.** `mobile/app.json` has no `NSCameraUsageDescription` or Android camera permission today. The existing `cameraPermission` string in the `expo-image-picker` plugin config is for the photo-picker's camera-roll access, not a live scanner — this feature needs its own permission plumbing and a `react-native-vision-camera` config plugin, which requires a dev-client rebuild (the app already uses `expo-dev-client`, so this is a non-issue, just not a no-op).

---

## Problem

The catalog has 25,806 products but only 14% have prices. Cosmos API adds ~100-200 products/day across 4 tokens — too slow to reach critical mass. Meanwhile, users are physically inside stores every day, looking at prices. Two scanning paths turn them into data collectors.

---

## Two scanning modes

### Mode A — Barcode scan + manual price

**User flow:**
1. User taps "Escanear preço" (floating action button or tab bar action)
2. Camera opens with barcode viewfinder
3. User points at product barcode (EAN-13)
4. App matches GTIN to catalog (`products.ean`)
5. If match: show product name + image, ask for price input
6. If no match: ask for product name + price (new product entry)
7. User types price, taps "Confirmar"
8. Data saved: `{ ean, price, store_id (inferred from location), timestamp, anonymous_id }`

**What it captures per scan:**
- Product (by EAN — deterministic match)
- Price (user input)
- Store (geo-inferred from nearest registered store)
- Timestamp
- Anonymous contributor ID

**Tech:**
- `react-native-vision-camera` v4 with its built-in `useCodeScanner` hook (no separate scanner plugin — `vision-camera-code-scanner` is unmaintained).
- **`codeTypes: ['ean-13']` only in this mode — not `qr` too.** Real shelf photos from actual Matão stores (Savegnago) show why: product packaging routinely carries its own marketing QR code unrelated to price (e.g. a Tang sachet's "Escaneie e divirta-se" Disney tie-in QR, printed right next to the EAN-13 barcode on the same package). A dual-scoped scanner pointed at that product risks reading the promo QR instead of the barcode. Mode A and Mode B should mount the scanner with different `codeTypes` per screen, not one shared scanner scoped to both — see Mode B below.
- Neither vision-camera nor expo-camera is perfectly reliable on EAN-13 out of the box (known ML Kit/rotation quirks on both) — always ship a manual barcode-entry text field as a fallback, not just a "retry" affordance.
- Price input: numeric keypad, pre-filled with `reference_price` if available (user confirms or corrects)
- New: `NSCameraUsageDescription` (iOS) and Android camera permission in `app.json`, plus the vision-camera config plugin — requires a dev-client rebuild, not just a JS change.

**Effort:** ~3-5 days

---

### Mode B — NFC-e receipt QR scan

**User flow:**
1. User finishes shopping, receives receipt (nota fiscal)
2. Taps "Escanear nota fiscal"
3. Camera opens with QR viewfinder
4. User scans the QR code printed on the NFC-e receipt
5. App extracts the URL from QR (format: `https://www.nfce.fazenda.gov.br/...`)
6. App fetches the XML from SEFAZ or parses the URL query params
7. Shows summary: "12 produtos encontrados — Savegnago — R$ 87,40"
8. User confirms, all items saved at once

**What it captures per scan:**
- ALL products purchased (with GTIN/NCM codes)
- ALL prices (actual transaction prices, not shelf prices)
- Store (CNPJ → store name + address)
- Date/time of purchase
- Payment method
- Tax breakdown

**NFC-e QR format** (param schema is national; the base domain is per-state — SP shown, a full rollout needs a 27-entry UF→domain map):
```
https://www.nfce.fazenda.sp.gov.br/NFCeConsultaPublica/...
?chNFe=35260712345678000190650010000012345678901234
&nVersao=100
&tpAmb=1
&dhEmi=...
&vNF=87.40
&vICMS=12.30
&digVal=...
&cIdToken=000001
&cHashQRCode=...
```

The `chNFe` (44-digit key) is **not** certificate-gated for NFC-e (unlike NF-e/model-55, which was locked to certificate-holders in 2020) — item-level data is genuinely public. But there's no clean XML/REST endpoint: the item list lives on the state's rendered "consulta pública" HTML page, so this is a **server-side scrape + parse of structured HTML**, not an XML fetch by header. Confirmed feasible by existing shipped apps (NotaAi, Economiza Club) doing the same thing for the same reason NFC-e was designed for on-receipt QR scanning.

**Item shape to extract from the consulta page (per line item):**
- EAN/GTIN, product description, quantity, unit, unit price, line total (field names mirror the underlying `nfeProc`/`<det>/<prod>` structure even though you're not fetching that XML directly)

**Tech:**
- QR scanning: same camera library as Mode A, but this screen's scanner is scoped to `codeTypes: ['qr']` only — a separate mount from Mode A's `['ean-13']`-only scanner, not a shared component with both types enabled (see Mode A rationale above). NFC-e receipt QR codes are also visually distinct in practice (printed on the paper receipt itself, at the bottom, not on product packaging) — a real-world detail worth confirming against actual Matão receipts before finalizing the viewfinder copy ("aponte para o QR code da nota").
- SEFAZ: Edge Function (`supabase/functions/sefaz-nfce-fetch/`, following the existing `Deno.serve` + CORS-preflight convention used by `delete-account`/`daily-digest`) that fetches and parses the SP consulta page by `chNFe`. Cache successful parses (keyed by `chNFe`, which is already unique) since a scraped page shouldn't be re-fetched on retry.
- HTML parsing: need a Deno-compatible HTML parser (e.g. `deno-dom` via esm.sh) rather than `fast-xml-parser`, since the source is rendered HTML, not raw XML — `fast-xml-parser` only helps if a later state's portal happens to expose XML directly.
- Store resolution: CNPJ from the page → match to `stores` table or create new
- **Fallback path is required, not optional**: when the scrape fails (markup drift, portal downtime, non-SP state), parse only the QR URL params — gives `vNF` (total value) with no itemized breakdown. Track `receipt_imports.status = 'partial'` for this case (already in the data model below).

**Effort:** ~5-8 days for SP-only v1 (scraping a single state's markup); treat each additional state as incremental follow-up work, not part of this estimate — 27-state coverage is a materially bigger project than the original "SEFAZ API integration" framing implied.

**Risks:**
- Scraping brittleness: government HTML markup can change without notice; no SLA; expect breakage over time, not a one-time integration.
- No confirmed hard rate limit for SP's public consulta specifically, but the existence of paid scraping-abstraction vendors (Infosimples, FiscalAPI) for this exact problem signals real friction at volume (bot detection, session/cookie requirements) — build in backoff and the QR-param fallback from day one, don't treat it as a rare-edge-case path.
- v1 scope is SP only — multi-state expansion is per-UF markup work, not a config change.

---

## Data model

Next migration number is **`051_...`** (`050_fix_matao_city_typo.sql` is the current latest). `anonymous_id` is `uuid` (not `text`) in both tables below — it must be populated client-side by calling `getAnonymousId()` from `@poup/shared` (`packages/shared/src/lib/anonymous-id.ts`), the same mechanism already wired into `analytics_events.anonymous_id`. Do not add a second anonymous-ID scheme.

### New table: `price_reports`

```sql
CREATE TABLE public.price_reports (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id    uuid REFERENCES products(id),
  ean           text,                    -- raw EAN scanned
  price         numeric(10,2) NOT NULL,
  store_id      uuid REFERENCES stores(id),
  source        text NOT NULL,           -- 'barcode_scan' | 'nfce_receipt'
  anonymous_id  uuid NOT NULL,           -- from getAnonymousId(), same scheme as analytics_events
  confidence    numeric(3,2) DEFAULT 0.5,-- 0.5 = single unconfirmed report (see Validation & trust)
  nfce_key      text,                    -- chNFe for receipt scans
  metadata      jsonb DEFAULT '{}',      -- quantity, unit, etc from NFC-e
  created_at    timestamptz DEFAULT now(),

  -- Composite index for dedup: same device, same product, same store, same day
  CONSTRAINT unique_daily_report UNIQUE (anonymous_id, ean, store_id, (created_at::date))
);

CREATE INDEX idx_price_reports_product ON price_reports(product_id, created_at DESC);
CREATE INDEX idx_price_reports_store ON price_reports(store_id, created_at DESC);

ALTER TABLE public.price_reports ENABLE ROW LEVEL SECURITY;

-- Follows the analytics_events_insert_anonymous pattern from migration 049:
-- anon role can only insert rows self-identified by anonymous_id, never a user_id.
CREATE POLICY price_reports_insert_anonymous ON public.price_reports
  FOR INSERT TO anon
  WITH CHECK (anonymous_id IS NOT NULL);

-- Read access: aggregated/joined data only, via a view or RPC (mirrors how
-- store_engagement_summary exposes analytics_events without raw row access) —
-- do not grant broad SELECT on this table directly; a device's own submission
-- history is not something other devices should be able to read row-by-row.
```

### New table: `receipt_imports`

```sql
CREATE TABLE public.receipt_imports (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  anonymous_id  uuid NOT NULL,           -- from getAnonymousId(), same scheme as analytics_events
  nfce_key      text UNIQUE NOT NULL,     -- chNFe (44 digits) — also the scrape-cache key
  store_cnpj    text,
  store_id      uuid REFERENCES stores(id),
  total_value   numeric(10,2),
  item_count    int,
  raw_html      text,                     -- scraped consulta page, for reprocessing if parsing improves
  status        text DEFAULT 'processed', -- 'processed' | 'failed' | 'partial' (partial = QR-param-only fallback)
  created_at    timestamptz DEFAULT now()
);

ALTER TABLE public.receipt_imports ENABLE ROW LEVEL SECURITY;

CREATE POLICY receipt_imports_insert_anonymous ON public.receipt_imports
  FOR INSERT TO anon
  WITH CHECK (anonymous_id IS NOT NULL);
```

Note: `raw_xml` from the original draft is renamed `raw_html` — see "Research findings" above, there's no XML being fetched for NFC-e, only a rendered consulta page.

---

## Validation & trust

| Scenario | Confidence | Action |
|----------|-----------|--------|
| Single barcode scan | 0.5 | Show in app with "Preço reportado" badge |
| 2+ independent devices report same price, same store, within ~48h | 0.9 | Treat as confirmed |
| NFC-e receipt (single scan) | 1.0 | Transaction price = ground truth |
| Price diverges >40-50% from current median | 0.3 | Auto-hold for review in `super/qualidade` — don't hard-reject, legit sale prices can be this far off |
| Device >150-300m from the store's registered geofence at submission | reject | Cheap, effective anti-manipulation gate — reject client-side before hitting the API |
| Device exceeds ~15-20 price *submissions*/day (scanning itself can stay uncapped or looser, e.g. ~30-50/day) | throttle | Submitting is the throttled action, not scanning — don't punish someone comparison-shopping |
| Same device, same SKU, same store, within 6-12h | reject | Cooldown blocks spam-updating a single price |
| Confidence decay | — | Full weight ~24-48h, half by day 3-5, flagged stale after 7-14 days — grocery prices move slower than gas prices, decay accordingly |
| Flagged/outlier or low-reputation-device submission | require photo | Don't require a shelf-tag photo on every scan (kills volume) — only on the exception path, where it gives reviewers ground truth |

This table is now concrete enough to implement directly (geofence radius, cooldown window, decay curve) rather than needing a follow-up design pass — the numbers come from how Waze/GasBuddy-style corroboration systems weight single vs. repeated reports, adapted to grocery-price update frequency.

---

## Incentive model

**No gamification yet.** Start simple:

- After scanning: "Você contribuiu com o preço de [produto]! Isso ajuda outros consumidores."
- Counter on account screen: "Você já contribuiu X preços"
- Future (Phase 2+): badges, leaderboard, unlock features (e.g., scan 10 → unlock full price history)

---

## Implementation order

1. **Mode A first** — barcode scan is simpler, validates the UX, starts collecting data immediately
2. **Mode B second** — NFC-e is higher value per scan but more complex (SEFAZ integration)
3. Both modes feed the same `price_reports` table
4. Dashboard already has `super/qualidade` for review

---

## Dependencies

- `react-native-vision-camera` v4 (~2.5MB; bundles an ML Kit barcode model on Android, ~2.2MB more — acceptable for this app) — includes code scanning natively via `useCodeScanner`, no separate scanner plugin
- Its Expo config plugin, added to `mobile/app.json` `plugins`, requiring a `expo prebuild` + dev-client rebuild (native `ios/`/`android/` dirs already exist, so this is a rebuild, not a from-scratch native setup)
- A Deno-compatible HTML parser for the SEFAZ Edge Function (e.g. `deno-dom` via `esm.sh`) — **not** `fast-xml-parser`, since NFC-e access is a rendered-HTML scrape, not an XML fetch (see Research findings above)
- New camera permission strings: `NSCameraUsageDescription` (iOS) + Android camera permission — **not** already covered by the existing `expo-image-picker` `cameraPermission` config, which is a separate, narrower grant

---

## Success metrics

| Metric | Target (30 days) |
|--------|-----------------|
| Users who scan at least once | 10% of MAU |
| Price reports/day | 50+ |
| Unique products with crowdsourced price | 500+ |
| NFC-e receipts processed | 20+ |
| Products enriched (had no price, now has one) | 200+ |

---

## Open decisions before implementation starts

Things the research surfaced that need a product call, not an engineering guess:

1. **NFC-e v1 scope**: confirm São Paulo-only is acceptable for launch (matches the app's current Matão-only store footprint anyway), with multi-state as explicit follow-up work rather than something this estimate covers.
2. **Read access to `price_reports`**: the draft never specified who can read raw submission rows. Recommend no direct `SELECT` grant on the table (RLS as drafted above only covers `INSERT`) — expose data via an aggregating view/RPC instead, same pattern as `store_engagement_summary` over `analytics_events`. Needs a decision on what that view returns (per-product cheapest confirmed price? full history?) before it's built.
3. **Authenticated users**: current draft is anonymous-only (`anonymous_id`, no `user_id` column). If logged-in users should also get attribution/credit for contributions (the "Incentive model" section implies a per-user contribution counter), the schema needs a `user_id` column and a merge strategy for a device's anonymous history after sign-in — not designed yet.
4. **Scraper maintenance ownership**: SP's consulta page will drift over time (government HTML markup, not a versioned API) — this needs an owner and a monitoring/alerting plan for silent scrape failures, not just a "if it fails, fall back to QR-params" note.
5. **Mode A (barcode) product creation — deferred, disabled for now**: unlike Mode B (a receipt line has a description to fuzzy-match/create from), a barcode scan is only an EAN with no name — `products.name` is `NOT NULL`, so there's nothing to create a row with. A live Cosmos `/gtins/{ean}` lookup per scan was prototyped and reverted: Cosmos's token quota is paid/rate-limited and reserved for the seeder's bulk enrichment runs (`scripts/seed-cosmos-catalog.ts`), not per-user live lookups. Current behavior: an unrecognized EAN shows "sem correspondência" (`mobile/app/scan.tsx`'s product-lookup effect) and stays that way until the seeder catches up. When this gets picked up: **Open Food Facts** (`world.openfoodfacts.org`, already used for image/brand enrichment in `scripts/enrich-from-off.ts`) is a free, no-API-key candidate for a live per-scan lookup — food-focused with community-sourced data quality, and no price data, so it'd only solve the "get a name" half of the problem.
