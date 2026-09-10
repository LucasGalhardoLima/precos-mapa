-- supabase/migrations/054_store_prices_canonical_pricing.sql
--
-- Direction A of the pricing-structure brainstorm: store_prices becomes the
-- single canonical "current price of this product at this store" table,
-- fed by triggers from every source instead of per-call-site dual-writes
-- (the previous dual-write in src/app/api/publish-import/route.ts was dead
-- code — nothing called that route — which is the actual reason
-- store_prices sat empty for 3 months despite 47k promotions).
--
-- promotions keeps its original job: the promotional *event* record
-- (start/end dates, original vs promo price), feeding price_snapshots for
-- price-history/trend purposes. It no longer needs to be read directly by
-- anything that just wants "the current price" — that's store_prices now.
--
-- Precedence, highest first: active promotion > last_price > crowdsourced
-- scan (price_reports) > products.reference_price (catalog fallback,
-- handled at the read-path/RPC level, not in this table).

-- =============================================================================
-- 1. store_prices: add confidence, allow 'crowdsourced' as a source
-- =============================================================================

ALTER TABLE public.store_prices
  ADD COLUMN IF NOT EXISTS confidence numeric(3,2) NOT NULL DEFAULT 1.0;

ALTER TABLE public.store_prices
  DROP CONSTRAINT IF EXISTS store_prices_source_check;

ALTER TABLE public.store_prices
  ADD CONSTRAINT store_prices_source_check
  CHECK (source IN ('erp', 'pdf_import', 'manual', 'crawler', 'crowdsourced'));

COMMENT ON COLUMN public.store_prices.confidence IS
  'Full confidence (1.0) for store-attested sources (pdf_import/erp/manual/crawler). '
  'Crowdsourced scans start at 0.5 (single report) and rise to 0.9 with 2+ corroborating '
  'devices within 48h — see specs/015-price-scanner/plan.md "Validation & trust".';

-- =============================================================================
-- 2. Backfill from existing promotions (one-time — the trigger in section 3
--    handles everything from here on). Picks, per product+store, the active
--    promo if still valid, else the most recent last_price.
-- =============================================================================

INSERT INTO public.store_prices (product_id, store_id, price, is_promo, source, valid_until, updated_at)
SELECT DISTINCT ON (pr.product_id, pr.store_id)
  pr.product_id,
  pr.store_id,
  CASE WHEN pr.status = 'active' AND pr.end_date > now() THEN pr.promo_price ELSE pr.last_known_price END AS price,
  (pr.status = 'active' AND pr.end_date > now())                                                          AS is_promo,
  CASE pr.source WHEN 'importador_ia' THEN 'pdf_import' WHEN 'crawler' THEN 'crawler' ELSE 'manual' END    AS source,
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
  valid_until = EXCLUDED.valid_until,
  updated_at  = EXCLUDED.updated_at;

-- =============================================================================
-- 3. Trigger: promotions -> store_prices
--
-- Fires on any insert/update that could change what "the current price" is.
-- Re-derives from promotions itself (not just NEW) since a product+store can
-- have multiple promotions rows (active + historical last_price) and the
-- correct current value depends on picking the best one, not just the row
-- that happened to fire the trigger.
-- =============================================================================

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
    CASE pr.source WHEN 'importador_ia' THEN 'pdf_import' WHEN 'crawler' THEN 'crawler' ELSE 'manual' END
  INTO v_price, v_is_promo, v_valid_until, v_source
  FROM public.promotions pr
  WHERE pr.product_id = NEW.product_id
    AND pr.store_id = NEW.store_id
    AND pr.status IN ('active', 'last_price')
  ORDER BY (pr.status = 'active' AND pr.end_date > now()) DESC, pr.updated_at DESC
  LIMIT 1;

  IF v_price IS NOT NULL THEN
    -- A promotion is store-attested data — always takes precedence over a
    -- prior crowdsourced entry for the same product+store.
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

DROP TRIGGER IF EXISTS trg_sync_promotion_to_store_price ON public.promotions;

CREATE TRIGGER trg_sync_promotion_to_store_price
AFTER INSERT OR UPDATE OF status, promo_price, last_known_price, end_date
ON public.promotions
FOR EACH ROW EXECUTE FUNCTION public.sync_promotion_to_store_price();

-- =============================================================================
-- 4. Trigger: price_reports -> store_prices
--
-- Implements the two lowest tiers of specs/015-price-scanner/plan.md's
-- "Validation & trust" table: single scan = 0.5 confidence, 2+ independent
-- devices reporting the same product+store within 48h = 0.9. Never
-- overwrites a store-attested row (pdf_import/erp/manual/crawler,
-- confidence 1.0) — a single anonymous scan shouldn't clobber the store's
-- own listed price. Only replaces an existing crowdsourced row or fills an
-- empty slot.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.sync_price_report_to_store_price()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_corroborating_count int;
  v_confidence          numeric(3,2);
BEGIN
  IF NEW.product_id IS NULL OR NEW.store_id IS NULL THEN
    RETURN NEW; -- can't attribute a store-specific price without both
  END IF;

  SELECT count(DISTINCT anonymous_id) INTO v_corroborating_count
  FROM public.price_reports
  WHERE product_id = NEW.product_id
    AND store_id = NEW.store_id
    AND created_at > now() - interval '48 hours';

  v_confidence := CASE WHEN v_corroborating_count >= 2 THEN 0.9 ELSE 0.5 END;

  INSERT INTO public.store_prices (product_id, store_id, price, is_promo, source, confidence, valid_until, updated_at)
  VALUES (NEW.product_id, NEW.store_id, NEW.price, false, 'crowdsourced', v_confidence, NULL, now())
  ON CONFLICT (product_id, store_id) DO UPDATE SET
    price       = EXCLUDED.price,
    is_promo    = false,
    source      = 'crowdsourced',
    confidence  = EXCLUDED.confidence,
    valid_until = NULL,
    updated_at  = now()
  WHERE store_prices.source = 'crowdsourced'; -- never overwrite a store-attested (confidence 1.0) row

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_price_report_to_store_price ON public.price_reports;

CREATE TRIGGER trg_sync_price_report_to_store_price
AFTER INSERT ON public.price_reports
FOR EACH ROW EXECUTE FUNCTION public.sync_price_report_to_store_price();
