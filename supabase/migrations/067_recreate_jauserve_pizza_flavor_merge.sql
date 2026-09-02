-- supabase/migrations/067_recreate_jauserve_pizza_flavor_merge.sql
--
-- One-off cleanup, same Jaú Serve trial as migrations 064/066: 12 "Grande"
-- pizza flavors fuzzy-matched onto "Pizza Calabresa Grande aprox. 700g"
-- (7c2a607a...), and 13 "Média" flavors fuzzy-matched onto "Pizza Frango
-- com Requeijão Média aprox. 600g" (b7408eab...). Root cause: neither side
-- had an EAN or a size mismatch to catch — brand, size, and most of the
-- name text were identical, differing only by the flavor word, which
-- cleared the same-brand fuzzy threshold (0.4) at a measured similarity of
-- 0.62. Fixed in src/lib/product-match.ts (strictNoEanMatch, opt-in for the
-- 4 scraper scripts only — PDF-import-family callers keep their existing
-- fuzzy tolerance for OCR/receipt phrasing variance).
--
-- store_prices.upsert(onConflict: product_id, store_id) meant each merge
-- overwrote the previous one; the survivor products' own prices ended up
-- wrong too (Calabresa coincidentally survived intact at its true 34.93,
-- but "Frango com Requeijão" now shows 35.94 instead of its true 29.94).
-- Recreating the 25 lost flavors with the real scraped data (name/price/
-- image already captured in scripts/.scrape-jauserve-review.csv) and
-- correcting the one wrong survivor price.

WITH new_products AS (
  INSERT INTO public.products (name, category_id, brand, reference_price, image_url, ean)
  VALUES
    -- Grande (700g) flavors merged into Calabresa (7c2a607a...)
    ('Pizza Lombo Defumado Grande aprox. 700g', 'cat_alimentos', 'Pizzaria Jaú Serve', 39.13, 'https://www.jauserve.com.br/dw/image/v2/BFJL_PRD/on/demandware.static/-/Sites-jauserve-master/default/dwaf86f3ba/pizza_lombo_2745_2833_2912.png?sw=1800', null),
    ('Pizza Milho Verde Grande aprox. 700g', 'cat_alimentos', 'Pizzaria Jaú Serve', 34.93, 'https://www.jauserve.com.br/dw/image/v2/BFJL_PRD/on/demandware.static/-/Sites-jauserve-master/default/dw8ed021ee/pizza_milho_2741_2827_2898.png?sw=1800', null),
    ('Pizza Frios Grande aprox. 700g', 'cat_alimentos', 'Pizzaria Jaú Serve', 34.93, 'https://www.jauserve.com.br/dw/image/v2/BFJL_PRD/on/demandware.static/-/Sites-jauserve-master/default/dw44b98b19/pizza_frios_2744_2830_2902.png?sw=1800', null),
    ('Pizza Peito de Peru Grande aprox. 700g', 'cat_alimentos', 'Pizzaria Jaú Serve', 41.93, 'https://www.jauserve.com.br/dw/image/v2/BFJL_PRD/on/demandware.static/-/Sites-jauserve-master/default/dwe68fa959/pizza_peru_2747_2837_2915.png?sw=1800', null),
    ('Pizza Atum Grande aprox. 700g', 'cat_alimentos', 'Pizzaria Jaú Serve', 46.13, 'https://www.jauserve.com.br/dw/image/v2/BFJL_PRD/on/demandware.static/-/Sites-jauserve-master/default/dw66e243f8/pizza_atum_2696_2920_2838.png?sw=1800', null),
    ('Pizza A Baiana Grande aprox. 700g', 'cat_alimentos', 'Pizzaria Jaú Serve', 34.93, 'https://www.jauserve.com.br/dw/image/v2/BFJL_PRD/on/demandware.static/-/Sites-jauserve-master/default/dw19f4542c/pizza_baiana_2742_2828_2922.png?sw=1800', null),
    ('Pizza Portuguesa Grande aprox. 700g', 'cat_alimentos', 'Pizzaria Jaú Serve', 34.93, 'https://www.jauserve.com.br/dw/image/v2/BFJL_PRD/on/demandware.static/-/Sites-jauserve-master/default/dw28dc3d02/pizza_portuguesa_2713_2769_2859.png?sw=1800', null),
    ('Pizza Mortadela Grande aprox. 700g', 'cat_alimentos', 'Pizzaria Jaú Serve', 32.13, 'https://www.jauserve.com.br/dw/image/v2/BFJL_PRD/on/demandware.static/-/Sites-jauserve-master/default/dw1ccd1378/pizza_mortadela_2712_2768_2847.png?sw=1800', null),
    ('Pizza Brigadeiro Grande aprox. 700g', 'cat_alimentos', 'Pizzaria Jaú Serve', 41.93, 'https://www.jauserve.com.br/dw/image/v2/BFJL_PRD/on/demandware.static/-/Sites-jauserve-master/default/dw716f31d1/pizza_brigadeiro_2698_2927_2884.png?sw=1800', null),
    ('Pizza Provolone Grande aprox. 700g', 'cat_alimentos', 'Pizzaria Jaú Serve', 41.93, 'https://www.jauserve.com.br/dw/image/v2/BFJL_PRD/on/demandware.static/-/Sites-jauserve-master/default/dw66557c7a/pizza_provolone_2708_2753_2846.png?sw=1800', null),
    ('Pizza Tomate Seco Grande aprox. 700g', 'cat_alimentos', 'Pizzaria Jaú Serve', 39.83, 'https://www.jauserve.com.br/dw/image/v2/BFJL_PRD/on/demandware.static/-/Sites-jauserve-master/default/dw547e505f/pizza_tomate_2743_2829_2899.png?sw=1800', null),
    ('Pizza Palmito Grande aprox. 700g', 'cat_alimentos', 'Pizzaria Jaú Serve', 34.93, 'https://www.jauserve.com.br/dw/image/v2/BFJL_PRD/on/demandware.static/-/Sites-jauserve-master/default/dwf2b1c593/pizza_palmito_2707_2826_2845.png?sw=1800', null),
    -- Média (600g) flavors merged into "Frango com Requeijão" (b7408eab...)
    ('Pizza Mussarela Média aprox. 600g', 'cat_alimentos', 'Pizzaria Jaú Serve', 29.94, 'https://www.jauserve.com.br/dw/image/v2/BFJL_PRD/on/demandware.static/-/Sites-jauserve-master/default/dwdf04abb6/pizza_mussarela_2716_2750_2867.png?sw=1800', null),
    ('Pizza Peito de Peru Média aprox. 600g', 'cat_alimentos', 'Pizzaria Jaú Serve', 35.94, 'https://www.jauserve.com.br/dw/image/v2/BFJL_PRD/on/demandware.static/-/Sites-jauserve-master/default/dwe68fa959/pizza_peru_2747_2837_2915.png?sw=1800', null),
    ('Pizza Tomate Seco Média aprox. 600g', 'cat_alimentos', 'Pizzaria Jaú Serve', 34.14, 'https://www.jauserve.com.br/dw/image/v2/BFJL_PRD/on/demandware.static/-/Sites-jauserve-master/default/dw547e505f/pizza_tomate_2743_2829_2899.png?sw=1800', null),
    ('Pizza Palmito Média aprox. 600g', 'cat_alimentos', 'Pizzaria Jaú Serve', 29.94, 'https://www.jauserve.com.br/dw/image/v2/BFJL_PRD/on/demandware.static/-/Sites-jauserve-master/default/dwf2b1c593/pizza_palmito_2707_2826_2845.png?sw=1800', null),
    ('Pizza Presunto Média aprox. 600g', 'cat_alimentos', 'Pizzaria Jaú Serve', 29.94, 'https://www.jauserve.com.br/dw/image/v2/BFJL_PRD/on/demandware.static/-/Sites-jauserve-master/default/dwf696b216/pizza_presunto_2929_2751_2870.png?sw=1800', null),
    ('Pizza Brigadeiro Média aprox. 600g', 'cat_alimentos', 'Pizzaria Jaú Serve', 35.94, 'https://www.jauserve.com.br/dw/image/v2/BFJL_PRD/on/demandware.static/-/Sites-jauserve-master/default/dw716f31d1/pizza_brigadeiro_2698_2927_2884.png?sw=1800', null),
    ('Pizza Atum Média aprox. 600g', 'cat_alimentos', 'Pizzaria Jaú Serve', 39.54, 'https://www.jauserve.com.br/dw/image/v2/BFJL_PRD/on/demandware.static/-/Sites-jauserve-master/default/dw66e243f8/pizza_atum_2696_2920_2838.png?sw=1800', null),
    ('Pizza Portuguesa Média aprox. 600g', 'cat_alimentos', 'Pizzaria Jaú Serve', 29.94, 'https://www.jauserve.com.br/dw/image/v2/BFJL_PRD/on/demandware.static/-/Sites-jauserve-master/default/dw28dc3d02/pizza_portuguesa_2713_2769_2859.png?sw=1800', null),
    ('Pizza Provolone Média aprox. 600g', 'cat_alimentos', 'Pizzaria Jaú Serve', 35.94, 'https://www.jauserve.com.br/dw/image/v2/BFJL_PRD/on/demandware.static/-/Sites-jauserve-master/default/dw66557c7a/pizza_provolone_2708_2753_2846.png?sw=1800', null),
    ('Pizza A Baiana Média aprox. 600g', 'cat_alimentos', 'Pizzaria Jaú Serve', 29.94, 'https://www.jauserve.com.br/dw/image/v2/BFJL_PRD/on/demandware.static/-/Sites-jauserve-master/default/dw19f4542c/pizza_baiana_2742_2828_2922.png?sw=1800', null),
    ('Pizza Mortadela Média aprox. 600g', 'cat_alimentos', 'Pizzaria Jaú Serve', 27.54, 'https://www.jauserve.com.br/dw/image/v2/BFJL_PRD/on/demandware.static/-/Sites-jauserve-master/default/dw1ccd1378/pizza_mortadela_2712_2768_2847.png?sw=1800', null),
    ('Pizza Frios Média aprox. 600g', 'cat_alimentos', 'Pizzaria Jaú Serve', 29.94, 'https://www.jauserve.com.br/dw/image/v2/BFJL_PRD/on/demandware.static/-/Sites-jauserve-master/default/dw44b98b19/pizza_frios_2744_2830_2902.png?sw=1800', null),
    ('Pizza 4 Queijos Média aprox. 600g', 'cat_alimentos', 'Pizzaria Jaú Serve', 35.94, 'https://www.jauserve.com.br/dw/image/v2/BFJL_PRD/on/demandware.static/-/Sites-jauserve-master/default/dwfa69ea71/pizza_4queijos_2746_2834_2914.png?sw=1800', null)
  RETURNING id, reference_price
)
INSERT INTO public.store_prices (product_id, store_id, price, is_promo, source, confidence, valid_until)
SELECT id, '13fb45bb-7ba2-4910-8194-760e4cc4eaf0'::uuid, reference_price, false, 'crawler', 1.0, null
FROM new_products;

-- The survivor product's own price was itself overwritten by a
-- later-processed flavor sharing its price coincidentally (35.94, actually
-- Brigadeiro/Provolone's price) — restore its true scraped price.
UPDATE public.store_prices
SET price = 29.94, updated_at = now()
WHERE product_id = 'b7408eab-8738-4a87-9b70-5c16824d3c13'
  AND store_id = '13fb45bb-7ba2-4910-8194-760e4cc4eaf0';

NOTIFY pgrst, 'reload schema';
