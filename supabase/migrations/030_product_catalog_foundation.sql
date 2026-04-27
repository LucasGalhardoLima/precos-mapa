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
  ON public.store_prices FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "store_prices_write_service"
  ON public.store_prices FOR ALL
  USING     (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- 3. updated_at trigger
CREATE TRIGGER trg_store_prices_updated_at
  BEFORE UPDATE ON public.store_prices
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 4. Explicit GRANTs (pattern from 008_price_intelligence_grants.sql)
GRANT SELECT ON public.store_prices TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_prices TO service_role;

-- 5. Realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.store_prices;
