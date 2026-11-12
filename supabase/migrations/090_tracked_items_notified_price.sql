-- RASCUNHO — NÃO APLICADA. Precisa do OK explícito do Lucas (e dry-run)
-- antes de `supabase db push`.
--
-- Dedupe state for notify-tracked-price (the "Acompanhar e avisar" push).
-- notified_price = the price we last pushed for this item while it was at or
-- below target_price; null = "armed" (next drop to/below target pushes).
-- The function:
--   * pushes when today's lowest price <= target and (notified_price is null
--     or today's price < notified_price), then sets notified_price = price;
--   * re-arms (notified_price = null) when today's lowest price goes back
--     above target_price;
--   * leaves it alone on a day with no fresh price.
-- Owners can already update their own rows (tracked_items_update_own), so a
-- client could write this column; harmless — worst case they get one extra
-- or one fewer push for their own item.
alter table public.tracked_items
  add column notified_price numeric(10,2);

comment on column public.tracked_items.notified_price is
  'Last price pushed by notify-tracked-price while at/below target_price; null = armed.';
