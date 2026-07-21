-- supabase/migrations/049_analytics_anonymous_events.sql
--
-- useAnalytics currently drops every event when there's no authenticated
-- session (`if (!userId) return;` in mobile/hooks/use-analytics.ts) — which
-- is most traffic, since browsing/searching never requires login. This adds
-- an anonymous_id column so logged-out events can be captured, keyed off a
-- client-generated UUID persisted in expo-secure-store.

alter table public.analytics_events
  alter column user_id drop not null;

alter table public.analytics_events
  add column if not exists anonymous_id uuid;

alter table public.analytics_events
  add constraint analytics_events_identity_check
  check (user_id is not null or anonymous_id is not null);

create index if not exists ix_analytics_anonymous_created
  on public.analytics_events (anonymous_id, created_at)
  where anonymous_id is not null;

-- Logged-out requests use the `anon` role. They can only ever insert rows
-- identifying themselves by anonymous_id, never impersonate a real user_id.
create policy analytics_events_insert_anonymous on public.analytics_events
  for insert to anon
  with check (user_id is null and anonymous_id is not null);

notify pgrst, 'reload schema';
