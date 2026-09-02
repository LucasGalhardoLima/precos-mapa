-- supabase/migrations/064_recreate_jauserve_trial_merged_products.sql
--
-- One-off cleanup: a small live trial of scripts/scrape-jauserve-prices.ts
-- (5 products, BATCH=5) hit a matcher bug and lost 2 of 3 wines from the
-- same brand+size family. findOrCreateProduct/match_product_for_upsert has
-- no way to know a query's own EAN, so "Vinho Tinto Merlot Los Coches
-- Garrafa 750ml" and "Vinho Rose Los Coches Garrafa 750ml" both matched the
-- just-created "Vinho Tinto Cabernet Sauvignon Los Coches Garrafa 750ml"
-- product (same brand, same size, high name similarity) instead of creating
-- their own rows — confirmed by calling match_product_for_upsert directly
-- with the Merlot query, which returned the Cabernet product at confidence
-- 0.75. Their store_prices upsert (onConflict: product_id,store_id) then
-- landed on the Cabernet product's single price row, overwriting it twice.
--
-- This is the opposite failure mode from migration 062 (Fruit Shoot), which
-- was under-merging. See src/lib/product-match.ts for the accompanying
-- EAN-aware disqualification fix that prevents this going forward.
--
-- Recreating the 2 lost products here with the real data already captured
-- in scripts/.scrape-jauserve-review.csv (both scraped successfully, just
-- discarded by the matcher). The surviving Cabernet product/store_prices
-- row is untouched — all 3 wines happened to share the same price (28.99)
-- and is_promo (false), so it was never actually wrong, just short two rows.

DO $$
DECLARE
  store_id     uuid := '13fb45bb-7ba2-4910-8194-760e4cc4eaf0'; -- Jaú Serve, Matão
  merlot_id    uuid;
  rose_id      uuid;
BEGIN
  INSERT INTO public.products (name, category_id, brand, reference_price, image_url, ean)
  VALUES (
    'Vinho Tinto Merlot Los Coches Garrafa 750ml',
    'cat_alimentos',
    'Adega Jaú Serve',
    28.99,
    'https://www.jauserve.com.br/dw/image/v2/BFJL_PRD/on/demandware.static/-/Sites-jauserve-master/default/dw24425d19/7804414012832.png?sw=1800',
    '7804414012832'
  )
  RETURNING id INTO merlot_id;

  INSERT INTO public.products (name, category_id, brand, reference_price, image_url, ean)
  VALUES (
    'Vinho Rose Los Coches Garrafa 750ml',
    'cat_alimentos',
    'Adega Jaú Serve',
    28.99,
    'https://www.jauserve.com.br/dw/image/v2/BFJL_PRD/on/demandware.static/-/Sites-jauserve-master/default/dwf82ccba9/7804414014201.png?sw=1800',
    '7804414014201'
  )
  RETURNING id INTO rose_id;

  INSERT INTO public.store_prices (product_id, store_id, price, is_promo, source, confidence, valid_until)
  VALUES
    (merlot_id, store_id, 28.99, false, 'crawler', 1.0, null),
    (rose_id,   store_id, 28.99, false, 'crawler', 1.0, null);
END $$;

NOTIFY pgrst, 'reload schema';
