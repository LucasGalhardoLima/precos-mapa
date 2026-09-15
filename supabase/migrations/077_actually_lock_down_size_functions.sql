-- supabase/migrations/077_actually_lock_down_size_functions.sql
--
-- 076's `REVOKE ALL ... FROM PUBLIC` did not actually block anon — verified
-- live, still 204 after 076 shipped. This project has `ALTER DEFAULT
-- PRIVILEGES ... GRANT EXECUTE ON FUNCTIONS TO anon, authenticated` set up
-- (the usual Supabase convention so new functions are callable via REST
-- immediately), which grants EXECUTE to those roles directly at creation
-- time — a separate grant from PUBLIC's, so revoking PUBLIC's privileges
-- never touched it. Same gap found in bulk_update_product_size (075),
-- confirmed live: an anon-key call with `{"updates": []}` also returned
-- 204 — meaning any unauthenticated caller could currently overwrite
-- size_value/size_unit on arbitrary products by id. Revoking from the
-- named roles directly this time.

REVOKE EXECUTE ON FUNCTION public.snapshot_store_price_history() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.bulk_update_product_size(jsonb) FROM anon, authenticated;
