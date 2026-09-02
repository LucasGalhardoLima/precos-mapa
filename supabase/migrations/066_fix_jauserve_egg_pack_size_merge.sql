-- supabase/migrations/066_fix_jauserve_egg_pack_size_merge.sql
--
-- One-off cleanup, same trial as migration 064 but from the follow-up
-- larger batch (BATCH=75): the scraped "Ovo Grande Branco Mantiqueira
-- Bandeja C/20 Unidades" (EAN 7896982103388, R$9.98) fuzzy-matched onto the
-- pre-existing "Ovo branco Mantiqueira jumbo com 10 unidades" product —
-- same brand-ish name, but a different pack size (20 vs 10 eggs). Root
-- cause: extractSize()'s regex only recognized weight/volume units, not
-- Portuguese pack-count phrasing ("Unidades"/"unidades"), so neither name
-- produced a size token and the mismatch went unchecked by the existing
-- size-compatibility gate. Fixed in src/lib/product-match.ts (and its Deno
-- port) alongside this migration.
--
-- This left the 10-egg product carrying a wrong R$9.98 Jaú Serve price for
-- what is actually the 20-egg carton, on top of its own legitimate R$5.90
-- row from another store's PDF import (untouched here). Recreating the
-- 20-egg product with the real scraped data and repointing its price.

DO $$
DECLARE
  wrong_product_id    uuid := 'df60c9a3-e2f7-4d83-8f45-7e749fe73268'; -- "...jumbo com 10 unidades"
  target_store_id     uuid := '13fb45bb-7ba2-4910-8194-760e4cc4eaf0'; -- Jaú Serve, Matão
  correct_product_id  uuid;
BEGIN
  -- The mismatched price belongs to the 20-egg carton, not the 10-egg one.
  DELETE FROM public.store_prices
  WHERE product_id = wrong_product_id AND store_id = target_store_id;

  INSERT INTO public.products (name, category_id, brand, reference_price, image_url, ean)
  VALUES (
    'Ovo Grande Branco Mantiqueira Bandeja C/20 Unidades',
    'cat_alimentos',
    'Hortifrúti Jaú Serve',
    9.98,
    'https://www.jauserve.com.br/dw/image/v2/BFJL_PRD/on/demandware.static/-/Sites-jauserve-master/default/dw645e9862/7896982103388.png?sw=1800',
    '7896982103388'
  )
  RETURNING id INTO correct_product_id;

  INSERT INTO public.store_prices (product_id, store_id, price, is_promo, source, confidence, valid_until)
  VALUES (correct_product_id, target_store_id, 9.98, true, 'crawler', 1.0, null);
END $$;

NOTIFY pgrst, 'reload schema';
