-- supabase/migrations/060_stores_cnpj.sql
--
-- 015 Price Scanner Mode B (NFC-e receipt scan) needs to resolve a scraped
-- receipt's issuer CNPJ (receipt_imports.store_cnpj, migration 053) to an
-- existing row in `stores` — plan.md's "Store resolution: CNPJ from the page
-- -> match to stores table or create new". `stores` has no CNPJ column today,
-- so that match is currently impossible; this adds it.
--
-- Nullable, no uniqueness constraint: not every store has this backfilled
-- yet, and it's populated incrementally as receipts get scanned for a store.
-- Stored digits-only (14 chars, no punctuation) — the scraper is expected to
-- strip "12.345.678/0001-90" formatting before matching or writing here, so
-- comparisons never need to normalize on read.

ALTER TABLE public.stores ADD COLUMN cnpj text;

CREATE INDEX idx_stores_cnpj ON public.stores(cnpj) WHERE cnpj IS NOT NULL;

COMMENT ON COLUMN public.stores.cnpj IS
  'Digits-only 14-char CNPJ. Used to match NFC-e receipt_imports.store_cnpj to a store row (015 Mode B).';
