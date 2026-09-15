-- supabase/migrations/073_price_history_and_snapshot_cron_reschedule.sql
--
-- store_prices upserts in place (unique on product_id, store_id) — every
-- scraper run overwrites the prior price with no trail. The only history
-- table today, price_snapshots, is fed exclusively from `promotions` (see
-- daily-price-snapshot edge function), so the two live tiers store_prices
-- actually carries for consumers — 'crawler' and 'crowdsourced' — have zero
-- price history. 'pdf_import' rows in store_prices don't need a parallel
-- history here: they're synced FROM promotions by the sync_promotion_to_store_price
-- trigger (054), so they're already covered by price_snapshots.
--
-- 1. price_history: a new per-store daily table capturing store_prices
--    (crawler + crowdsourced) each day, at product+store granularity so a
--    product's price at Tenda can be told apart from its price at Jaú Serve.
--    Deliberately NOT folded into price_snapshots — that table's
--    min_promo_price/avg_promo_price columns, and reference_price's rolling
--    30-day average of them, specifically mean "active promotion price";
--    blending shelf prices into the same columns would change what
--    reference_price means for every product without that being asked for.
--
-- 2. A snapshot function that bulk-copies store_prices -> price_history in
--    one INSERT ... SELECT (the catalog is tens of thousands of rows —
--    looping row-by-row from an edge function isn't needed when Postgres
--    can do the whole copy in one statement), scheduled directly via
--    pg_cron rather than through invoke_edge_function like the other jobs
--    here: there's no external API call in this job, so the edge-function
--    hop buys nothing.
--
-- 3. Reschedules daily-price-snapshot AND schedules the new job for
--    09:30 UTC. The retailer scrapers (.github/workflows/scrape-prices.yml)
--    start at 06:00 UTC and Jaú Serve, the long pole, has finished as late
--    as 09:01 UTC (observed 2026-09-15) against a comment-documented worst
--    case of ~2.4h — 09:30 UTC leaves headroom past that. daily-price-snapshot
--    was previously scheduled at 04:00 UTC, i.e. before the scrapers even
--    start; anything reading store_prices at that hour would see the
--    previous day's scrape.

-- =============================================================================
-- 1. price_history table
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.price_history (
  id          uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  uuid          NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  store_id    uuid          NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  price       numeric(10,2) NOT NULL,
  source      text          NOT NULL CHECK (source IN ('crawler', 'crowdsourced')),
  date        date          NOT NULL DEFAULT current_date,
  created_at  timestamptz   NOT NULL DEFAULT now(),
  UNIQUE (product_id, store_id, date)
);

CREATE INDEX IF NOT EXISTS idx_price_history_product_date ON public.price_history(product_id, date);
CREATE INDEX IF NOT EXISTS idx_price_history_store_date   ON public.price_history(store_id, date);

ALTER TABLE public.price_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "price_history_read_all"
  ON public.price_history FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "price_history_write_service"
  ON public.price_history FOR ALL
  USING     (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

GRANT SELECT ON public.price_history TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.price_history TO service_role;

-- =============================================================================
-- 2. Snapshot function: bulk-copy store_prices (crawler + crowdsourced)
--    into price_history for today, then prune anything older than 365 days
--    (same retention window as price_snapshots, for YoY comparisons later).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.snapshot_store_price_history()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  INSERT INTO public.price_history (product_id, store_id, price, source, date)
  SELECT sp.product_id, sp.store_id, sp.price, sp.source, current_date
  FROM public.store_prices sp
  WHERE sp.source IN ('crawler', 'crowdsourced')
  ON CONFLICT (product_id, store_id, date)
  DO UPDATE SET price = EXCLUDED.price;

  DELETE FROM public.price_history
  WHERE date < current_date - INTERVAL '365 days';
END;
$$;

COMMENT ON FUNCTION public.snapshot_store_price_history() IS
  'Daily bulk copy of store_prices (crawler + crowdsourced) into price_history, one row per product+store+day. Scheduled via pg_cron, see job store-price-history-snapshot.';

-- =============================================================================
-- 3. Cron: reschedule daily-price-snapshot, schedule the new snapshot job —
--    both after the scrapers finish.
-- =============================================================================

SELECT cron.unschedule('daily-price-snapshot');

SELECT cron.schedule(
  'daily-price-snapshot',
  '30 9 * * *',
  $$select public.invoke_edge_function('daily-price-snapshot')$$
);

SELECT cron.schedule(
  'store-price-history-snapshot',
  '30 9 * * *',
  $$select public.snapshot_store_price_history()$$
);
