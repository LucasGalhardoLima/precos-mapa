-- supabase/migrations/081_price_history_skip_unchanged_price.sql
--
-- Why: snapshot_store_price_history() (073) unconditionally copies every
-- crawler/crowdsourced row in store_prices into price_history once a day,
-- one row per product+store+day regardless of whether the price actually
-- moved. Measured over the 7 days before this migration: 97.7% of rows
-- (252,091 / 258,006 with a prior recorded price) matched the previous
-- price for that product+store — most of the table's daily volume
-- (~37,201 rows/day, ~10 MB/day at current row size) is exact repeats, not
-- new information. That window overlaps the 17–22/09 Storage-restriction
-- outage (scrapers weren't writing, so store_prices held the same price
-- for 5 straight days), which likely inflates the figure above normal
-- steady state — but even well below 97.7% this is worth fixing: at the
-- unconditional rate, price_history alone was on pace for roughly
-- +870 MB in 90 days against a 500 MB (Free plan) whole-database budget.
--
-- Fix: a BEFORE INSERT trigger on price_history itself — not a filter
-- inside snapshot_store_price_history() — cancels (RETURNS NULL) any
-- incoming row whose price matches that product+store's most recently
-- recorded price. This catches every insert path into price_history, not
-- just the daily snapshot job, so snapshot_store_price_history() goes back
-- to its original unconditional INSERT...SELECT (073) and the trigger does
-- the filtering. First-ever rows for a product+store (no prior row at all)
-- always insert — nothing to compare against. store_prices is untouched
-- and keeps updating every run — it remains "today's price" regardless of
-- whether price_history got a new row. Existing rows are not touched or
-- deleted by this migration.
--
-- Side effect to know: a gap in price_history's dates for a product+store
-- now means "unchanged since the last dated row", not "no data that day"
-- (docs/poup-mlp-decisoes.md decisão 1 now notes "normal" must be a
-- duration-weighted average of recorded prices for this reason, not a
-- simple mean). Nothing in the app reads price_history directly today
-- (checked), so nothing currently depends on daily contiguity.
--
-- Also drops tmp_price_history_dedup_stats() (080), the one-off read-only
-- function used to take the measurement above — it was never meant to
-- stay in the schema.

DROP FUNCTION IF EXISTS public.tmp_price_history_dedup_stats();

-- Supports the trigger's "most recent price_history row for this
-- product+store" lookup efficiently; the existing per-column indexes
-- (product_id, date) and (store_id, date) don't cover both key columns
-- together. Ordered by `date`, not `created_at`: `date` is the column that
-- means "which day this price was recorded for" — what the trigger and the
-- table's own UNIQUE(product_id, store_id, date) constraint both key on —
-- while `created_at` is insert time, which only coincides with `date` by
-- convention (the snapshot job always inserts for current_date) and isn't
-- what either existing index or this lookup actually needs.
CREATE INDEX IF NOT EXISTS idx_price_history_product_store_date
  ON public.price_history (product_id, store_id, date DESC);

CREATE OR REPLACE FUNCTION public.price_history_skip_unchanged()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'public'
AS $$
DECLARE
  last_price numeric(10,2);
BEGIN
  SELECT ph.price INTO last_price
  FROM public.price_history ph
  WHERE ph.product_id = NEW.product_id
    AND ph.store_id = NEW.store_id
  ORDER BY ph.date DESC
  LIMIT 1;

  IF last_price IS NOT NULL AND last_price = NEW.price THEN
    RETURN NULL; -- unchanged since the last recorded row — skip the insert
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.price_history_skip_unchanged() IS
  'BEFORE INSERT trigger (081): cancels an incoming price_history row when its price matches that product+store''s most recently recorded price. See trigger price_history_skip_unchanged_trigger.';

DROP TRIGGER IF EXISTS price_history_skip_unchanged_trigger ON public.price_history;

CREATE TRIGGER price_history_skip_unchanged_trigger
  BEFORE INSERT ON public.price_history
  FOR EACH ROW
  EXECUTE FUNCTION public.price_history_skip_unchanged();

-- Reverted to 073's original, unconditional form: the trigger above is now
-- what decides whether a row actually gets written, so this function no
-- longer needs its own price-comparison filter.
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
  'Daily bulk copy of store_prices (crawler + crowdsourced) into price_history, one row per product+store+day. Scheduled via pg_cron, see job store-price-history-snapshot. Unchanged-price rows are silently skipped by the price_history_skip_unchanged_trigger (081), not filtered here.';
