-- Add trigger-tracking columns to user_alerts
-- When a promotion matches an active alert, the edge function records
-- the price, store, and timestamp so the mobile app can show "Novidades".

alter table public.user_alerts
  add column triggered_at     timestamptz,
  add column triggered_price  numeric(10,2),
  add column triggered_store_id uuid references public.stores(id);

-- Index for quick lookup of recently triggered alerts per user
create index ix_user_alerts_triggered_at
  on public.user_alerts (user_id, triggered_at desc)
  where triggered_at is not null;
