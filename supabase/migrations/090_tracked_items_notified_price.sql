-- RASCUNHO — NÃO APLICADA. Precisa do OK explícito do Lucas (e dry-run)
-- antes de `supabase db push`.
--
-- Dedupe state for notify-tracked-price (the "Acompanhar e avisar" push).
-- notified_price = the price we last pushed for this item while it was at or
-- below target_price; null = "armed" (next crossing of the target pushes).
-- notified_at = when that push went out (max 1 push per item per day).
-- The function (rules in supabase/functions/notify-tracked-price/decide.ts):
--   * first crossing (notified_price is null, price <= target): always pushes;
--   * while still at/below target: pushes again only if the price fell at
--     least R$ 0,10 below notified_price AND notified_at is not today;
--   * re-arms (notified_price = null) when today's lowest goes back above
--     target_price; leaves both alone on a day with no fresh price.
-- Owners can already update their own rows (tracked_items_update_own), so a
-- client could write these columns; harmless — worst case they get one extra
-- or one fewer push for their own item.
alter table public.tracked_items
  add column notified_price numeric(10,2),
  add column notified_at timestamptz;

comment on column public.tracked_items.notified_price is
  'Last price pushed by notify-tracked-price while at/below target_price; null = armed.';
comment on column public.tracked_items.notified_at is
  'When notify-tracked-price last pushed for this item (max 1 per day).';
