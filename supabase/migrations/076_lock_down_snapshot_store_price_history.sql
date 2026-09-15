-- supabase/migrations/076_lock_down_snapshot_store_price_history.sql
--
-- snapshot_store_price_history() (073) is SECURITY DEFINER but was never
-- REVOKE'd from PUBLIC — Postgres grants EXECUTE on new functions to PUBLIC
-- by default, so it was callable by anyone hitting
-- POST /rest/v1/rpc/snapshot_store_price_history with just the anon key,
-- no auth required. Confirmed live: an anon-key call returned 204. Harm is
-- limited (it only recomputes price_history for the current day and prunes
-- rows older than 365 days — no data loss on repeat calls), but it's an
-- open compute/write trigger on the public internet for no reason: only
-- pg_cron needs to call this. bulk_update_product_size (075) already got
-- this right; this migration brings the earlier function in line with it.

REVOKE ALL ON FUNCTION public.snapshot_store_price_history() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.snapshot_store_price_history() TO service_role;
