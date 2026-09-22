-- supabase/migrations/080_tmp_price_history_dedup_analysis.sql
--
-- TEMPORARY. One-off read-only analysis function to measure how much of
-- price_history's daily volume is same-price rows (no price change from the
-- previous recorded day for that product+store), so we can decide whether to
-- make snapshot_store_price_history() skip unchanged prices. Called once via
-- RPC, then dropped by migration 081. Not meant to stay in the schema.

CREATE OR REPLACE FUNCTION public.tmp_price_history_dedup_stats()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = 'public'
AS $$
  WITH ranked AS (
    SELECT product_id, store_id, date, price,
           LAG(price) OVER (PARTITION BY product_id, store_id ORDER BY date) AS prev_price
    FROM public.price_history
  ),
  window_7d AS (
    SELECT * FROM ranked WHERE date >= current_date - INTERVAL '7 days'
  ),
  daily_counts AS (
    SELECT date, count(*) AS rows
    FROM public.price_history
    WHERE date >= current_date - INTERVAL '14 days'
    GROUP BY date
    ORDER BY date
  ),
  sizes AS (
    SELECT pg_relation_size('public.price_history') AS table_bytes,
           pg_indexes_size('public.price_history') AS index_bytes,
           pg_total_relation_size('public.price_history') AS total_bytes
  )
  SELECT jsonb_build_object(
    'total_rows_7d', (SELECT count(*) FROM window_7d),
    'have_prev_7d', (SELECT count(*) FROM window_7d WHERE prev_price IS NOT NULL),
    'same_as_prev_7d', (SELECT count(*) FROM window_7d WHERE prev_price IS NOT NULL AND price = prev_price),
    'total_rows_ever', (SELECT count(*) FROM public.price_history),
    'daily_counts_14d', (SELECT jsonb_agg(jsonb_build_object('date', date, 'rows', rows)) FROM daily_counts),
    'sizes', (SELECT to_jsonb(sizes) FROM sizes)
  );
$$;

REVOKE ALL ON FUNCTION public.tmp_price_history_dedup_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tmp_price_history_dedup_stats() TO service_role;
