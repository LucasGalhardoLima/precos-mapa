-- supabase/migrations/053_price_reports_and_receipt_imports.sql
--
-- 015 Price Scanner — data model for Mode A (barcode scan + manual price)
-- and Mode B (NFC-e receipt QR). Schema and RLS pattern taken directly from
-- specs/015-price-scanner/plan.md, which was already validated against the
-- existing analytics_events_insert_anonymous policy (migration 049).
--
-- Read access is intentionally NOT granted here (open decision #2 in the
-- spec) — anon can only INSERT, self-identified by anonymous_id. Aggregated
-- read access (a view/RPC, mirroring store_engagement_summary) is follow-up
-- work once it's decided what that view should return.

CREATE TABLE public.price_reports (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id    uuid REFERENCES products(id),
  ean           text,                    -- raw EAN scanned
  price         numeric(10,2) NOT NULL,
  store_id      uuid REFERENCES stores(id),
  source        text NOT NULL,           -- 'barcode_scan' | 'nfce_receipt'
  anonymous_id  uuid NOT NULL,           -- from getAnonymousId(), same scheme as analytics_events
  confidence    numeric(3,2) DEFAULT 0.5,-- 0.5 = single unconfirmed report (see plan.md "Validation & trust")
  nfce_key      text,                    -- chNFe for receipt scans
  metadata      jsonb DEFAULT '{}',      -- quantity, unit, etc from NFC-e
  created_at    timestamptz DEFAULT now()
);

-- Dedup: same device, same product, same store, same day. A table-level
-- UNIQUE constraint can't reference an expression like (created_at::date),
-- so this has to be a unique index instead — and timestamptz::date isn't
-- IMMUTABLE (it depends on the session's TimeZone GUC), so the index needs
-- an IMMUTABLE wrapper. This is a spam-prevention heuristic, not a source
-- of financial truth, so day-bucketing that tracks the DB session's
-- timezone at write time is an acceptable trade-off.
CREATE OR REPLACE FUNCTION public.immutable_date(ts timestamptz) RETURNS date
  LANGUAGE sql IMMUTABLE AS $$ SELECT ts::date $$;

CREATE UNIQUE INDEX unique_daily_report ON public.price_reports(anonymous_id, ean, store_id, public.immutable_date(created_at));

CREATE INDEX idx_price_reports_product ON public.price_reports(product_id, created_at DESC);
CREATE INDEX idx_price_reports_store ON public.price_reports(store_id, created_at DESC);

ALTER TABLE public.price_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY price_reports_insert_anonymous ON public.price_reports
  FOR INSERT TO anon
  WITH CHECK (anonymous_id IS NOT NULL);

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
