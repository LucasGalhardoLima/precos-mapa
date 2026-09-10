-- supabase/migrations/056_fix_cron_source_mapping.sql
--
-- Fixes a mapping bug in 054: promotions.source has FOUR values, not three
-- ('manual', 'importador_ia', 'crawler', 'cron' — see migration 010, which
-- extended the check constraint for the automated PDF-processing pipeline).
-- 054's CASE only matched 'importador_ia' and 'crawler', so every 'cron'-
-- sourced promotion (89% of the sampled data — the dominant automated PDF
-- import path) fell through to the ELSE branch and was mislabeled 'manual'
-- in store_prices. 'cron' is still a PDF-import-derived price, so it belongs
-- in the same 'pdf_import' bucket as 'importador_ia'.

CREATE OR REPLACE FUNCTION public.sync_promotion_to_store_price()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_price       numeric(10,2);
  v_is_promo    boolean;
  v_valid_until timestamptz;
  v_source      text;
BEGIN
  SELECT
    CASE WHEN pr.status = 'active' AND pr.end_date > now() THEN pr.promo_price ELSE pr.last_known_price END,
    (pr.status = 'active' AND pr.end_date > now()),
    CASE WHEN pr.status = 'active' AND pr.end_date > now() THEN pr.end_date ELSE NULL END,
    CASE pr.source
      WHEN 'importador_ia' THEN 'pdf_import'
      WHEN 'cron'           THEN 'pdf_import'
      WHEN 'crawler'        THEN 'crawler'
      ELSE 'manual'
    END
  INTO v_price, v_is_promo, v_valid_until, v_source
  FROM public.promotions pr
  WHERE pr.product_id = NEW.product_id
    AND pr.store_id = NEW.store_id
    AND pr.status IN ('active', 'last_price')
  ORDER BY (pr.status = 'active' AND pr.end_date > now()) DESC, pr.updated_at DESC
  LIMIT 1;

  IF v_price IS NOT NULL THEN
    INSERT INTO public.store_prices (product_id, store_id, price, is_promo, source, confidence, valid_until, updated_at)
    VALUES (NEW.product_id, NEW.store_id, v_price, v_is_promo, v_source, 1.0, v_valid_until, now())
    ON CONFLICT (product_id, store_id) DO UPDATE SET
      price       = EXCLUDED.price,
      is_promo    = EXCLUDED.is_promo,
      source      = EXCLUDED.source,
      confidence  = 1.0,
      valid_until = EXCLUDED.valid_until,
      updated_at  = now();
  END IF;

  RETURN NEW;
END;
$$;

-- Re-run the backfill with the corrected mapping — also self-heals the one
-- row that was corrupted by a manual verification upsert during testing
-- (any product+store pair with a promotions row always gets recomputed
-- from promotions here, which is the correct source of truth).
INSERT INTO public.store_prices (product_id, store_id, price, is_promo, source, confidence, valid_until, updated_at)
SELECT DISTINCT ON (pr.product_id, pr.store_id)
  pr.product_id,
  pr.store_id,
  CASE WHEN pr.status = 'active' AND pr.end_date > now() THEN pr.promo_price ELSE pr.last_known_price END AS price,
  (pr.status = 'active' AND pr.end_date > now())                                                          AS is_promo,
  CASE pr.source
    WHEN 'importador_ia' THEN 'pdf_import'
    WHEN 'cron'           THEN 'pdf_import'
    WHEN 'crawler'        THEN 'crawler'
    ELSE 'manual'
  END                                                                                                      AS source,
  1.0                                                                                                      AS confidence,
  CASE WHEN pr.status = 'active' AND pr.end_date > now() THEN pr.end_date ELSE NULL END                    AS valid_until,
  now()
FROM public.promotions pr
WHERE pr.status IN ('active', 'last_price')
  AND (CASE WHEN pr.status = 'active' AND pr.end_date > now() THEN pr.promo_price ELSE pr.last_known_price END) IS NOT NULL
ORDER BY pr.product_id, pr.store_id, (pr.status = 'active' AND pr.end_date > now()) DESC, pr.updated_at DESC
ON CONFLICT (product_id, store_id) DO UPDATE SET
  price       = EXCLUDED.price,
  is_promo    = EXCLUDED.is_promo,
  source      = EXCLUDED.source,
  confidence  = 1.0,
  valid_until = EXCLUDED.valid_until,
  updated_at  = EXCLUDED.updated_at;
