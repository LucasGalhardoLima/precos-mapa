-- supabase/migrations/083_drop_tmp_retailer_freshness_check.sql
--
-- Drops tmp_retailer_freshness_check() (082) — the one-off read-only check
-- used to confirm the 2026-09-23 03:00 BRT scrape-prices.yml round wrote
-- fresh data for all 4 retailers. It was never meant to stay in the schema.

DROP FUNCTION IF EXISTS public.tmp_retailer_freshness_check();
