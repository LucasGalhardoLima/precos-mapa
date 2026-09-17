-- supabase/migrations/078_product_image_source.sql
--
-- Tracks which pipeline filled products.image_url, so the retailer-image
-- backfill (Savegnago/Jaú Serve/Amarelinha/Tenda) and the OFF fallback can be
-- audited and so OFF's uniform-treatment (contain, white bg, square crop) can
-- be applied only to OFF-sourced images, never to retailer photos.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS image_source text
  CHECK (image_source IN ('savegnago', 'jauserve', 'amarelinha', 'tenda', 'off'));

COMMENT ON COLUMN public.products.image_source IS
  'Which pipeline set image_url: a retailer scraper (savegnago/jauserve/amarelinha/tenda) or the Open Food Facts fallback (off). Null for images set before this column existed or by ad-hoc scripts.';
