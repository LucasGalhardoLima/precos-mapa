-- supabase/migrations/082_tmp_retailer_freshness_check.sql
--
-- TEMPORARY. One-off read-only check: max(updated_at) and row count per
-- retailer chain in store_prices, after the 2026-09-23 03:00 BRT
-- scrape-prices.yml round (all 4 retailers now on the direct-connection
-- bridge since PR #58). Called once via RPC, dropped by the next migration.
-- Same "add now, drop next" pattern as 080/081.

CREATE OR REPLACE FUNCTION public.tmp_retailer_freshness_check()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.most_recent DESC), '[]'::jsonb)
  FROM (
    SELECT
      s.name AS retailer,
      max(sp.updated_at) AS most_recent,
      count(*) AS rows
    FROM public.store_prices sp
    JOIN public.stores s ON s.id = sp.store_id
    WHERE s.name IN ('Jaú Serve', 'Savegnago')
       OR s.name ILIKE 'Amarelinha%'
       OR s.name = 'Tenda Atacado - Matão'
    GROUP BY s.name
  ) r;
$$;

REVOKE ALL ON FUNCTION public.tmp_retailer_freshness_check() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tmp_retailer_freshness_check() TO service_role;
