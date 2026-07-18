-- supabase/migrations/041_store_opening_hours.sql
--
-- Adds opening_hours JSONB column to stores.
--
-- Schema: object keyed by day-of-week string ("0"=Sun … "6"=Sat).
-- Each value is either null (store is closed that day)
-- or { "open": "HH:MM", "close": "HH:MM" } in 24-hour Brazil/São Paulo time.
--
-- Example:
--   {
--     "0": null,
--     "1": { "open": "07:00", "close": "21:00" },
--     ...
--     "6": { "open": "07:00", "close": "20:00" }
--   }
--
-- When null, the app shows no open/closed badge.

ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS opening_hours jsonb DEFAULT NULL;
