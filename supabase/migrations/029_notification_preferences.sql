-- 029_notification_preferences.sql
-- Consumer notification preferences for email digest + push controls.
-- Enables the consumer-daily-digest Edge Function to respect opt-in.

create table public.notification_preferences (
  user_id           uuid primary key references public.profiles(id) on delete cascade,
  email_digest      boolean   not null default false,
  push_favorites    boolean   not null default true,
  push_alerts       boolean   not null default true,
  unsubscribe_token uuid      not null default gen_random_uuid(),
  last_digest_at    timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

comment on table  public.notification_preferences is 'Per-user notification toggles and digest opt-in.';
comment on column public.notification_preferences.unsubscribe_token is 'One-click email unsubscribe token (LGPD).';

-- RLS: users read/update their own row only
alter table public.notification_preferences enable row level security;

create policy "Users read own prefs"
  on public.notification_preferences for select
  using (auth.uid() = user_id);

create policy "Users update own prefs"
  on public.notification_preferences for update
  using (auth.uid() = user_id);

create policy "Users insert own prefs"
  on public.notification_preferences for insert
  with check (auth.uid() = user_id);

-- Auto-create a row when a consumer profile is inserted
create or replace function public.create_default_notification_prefs()
returns trigger as $$
begin
  if NEW.role = 'consumer' then
    insert into public.notification_preferences (user_id)
    values (NEW.id)
    on conflict (user_id) do nothing;
  end if;
  return NEW;
end;
$$ language plpgsql security definer;

create trigger on_consumer_profile_insert
  after insert on public.profiles
  for each row
  execute function public.create_default_notification_prefs();

-- Backfill existing consumers
insert into public.notification_preferences (user_id)
select id from public.profiles where role = 'consumer'
on conflict (user_id) do nothing;

-- ─── Cron: consumer daily digest at 12:00 UTC (09:00 BRT) ───────────────────
select cron.schedule(
  'consumer-daily-digest',
  '0 12 * * *',
  $$select public.invoke_edge_function('consumer-daily-digest')$$
);
