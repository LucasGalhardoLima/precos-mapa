-- 020_analytics_events.sql
-- Analytics instrumentation for B2B pitch: tracks user engagement per store.
-- Events are lightweight (type + IDs + JSONB metadata) and write-only for
-- authenticated users, read-only for super_admin.

-- =============================================================================
-- 1. Core analytics_events table
-- =============================================================================

create table if not exists public.analytics_events (
  id          uuid primary key default gen_random_uuid(),
  event_type  text not null,
  user_id     uuid not null references auth.users(id) on delete cascade,
  store_id    uuid references public.stores(id) on delete set null,
  product_id  uuid references public.products(id) on delete set null,
  metadata    jsonb default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

comment on table public.analytics_events is
  'Lightweight user engagement events for B2B pitch and product analytics.';

-- =============================================================================
-- 2. Indexes for query patterns
-- =============================================================================

-- B2B pitch: "Your store was searched X times by Y unique users"
create index ix_analytics_store_type_created
  on public.analytics_events (store_id, event_type, created_at)
  where store_id is not null;

-- Per-user event timeline (admin debugging, user history)
create index ix_analytics_user_created
  on public.analytics_events (user_id, created_at);

-- Product-level aggregation
create index ix_analytics_product_type
  on public.analytics_events (product_id, event_type)
  where product_id is not null;

-- Time-range queries for dashboards
create index ix_analytics_created_at
  on public.analytics_events (created_at);

-- =============================================================================
-- 3. Row Level Security
-- =============================================================================

alter table public.analytics_events enable row level security;

-- Users can insert their own events
create policy analytics_events_insert on public.analytics_events
  for insert to authenticated
  with check (auth.uid() = user_id);

-- Super admin can read all events
create policy analytics_events_select_admin on public.analytics_events
  for select to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'super_admin'
    )
  );

-- Business users can read events related to their stores
create policy analytics_events_select_business on public.analytics_events
  for select to authenticated
  using (
    store_id is not null
    and exists (
      select 1 from public.store_members
      where store_members.store_id = analytics_events.store_id
        and store_members.user_id = auth.uid()
    )
  );

-- =============================================================================
-- 4. B2B Pitch Report View — per-store engagement summary
-- =============================================================================

create or replace view public.store_engagement_summary as
select
  e.store_id,
  s.name as store_name,
  s.city,
  s.chain,
  -- Search engagement
  count(*) filter (where e.event_type = 'search_result_viewed') as search_impressions,
  count(distinct e.user_id) filter (where e.event_type = 'search_result_viewed') as search_unique_users,
  -- Product detail views
  count(*) filter (where e.event_type = 'product_detail_viewed') as detail_views,
  count(distinct e.user_id) filter (where e.event_type = 'product_detail_viewed') as detail_unique_users,
  -- Shopping list adds
  count(*) filter (where e.event_type = 'list_item_added') as list_adds,
  count(distinct e.user_id) filter (where e.event_type = 'list_item_added') as list_unique_users,
  -- Alert creation
  count(*) filter (where e.event_type = 'alert_created') as alerts_created,
  count(distinct e.user_id) filter (where e.event_type = 'alert_created') as alert_unique_users,
  -- Map engagement
  count(*) filter (where e.event_type = 'map_pin_tapped') as map_taps,
  count(distinct e.user_id) filter (where e.event_type = 'map_pin_tapped') as map_unique_users,
  -- Totals
  count(*) as total_events,
  count(distinct e.user_id) as total_unique_users,
  -- Time window
  min(e.created_at) as first_event_at,
  max(e.created_at) as last_event_at
from public.analytics_events e
join public.stores s on s.id = e.store_id
where e.store_id is not null
group by e.store_id, s.name, s.city, s.chain;

comment on view public.store_engagement_summary is
  'Per-store engagement metrics for B2B sales pitch. "Your store was viewed X times by Y users."';

-- =============================================================================
-- 5. B2B Pitch Report Function — filtered by date range and store
-- =============================================================================

create or replace function public.store_engagement_report(
  target_store_id uuid default null,
  start_date      timestamptz default (now() - interval '30 days'),
  end_date        timestamptz default now()
)
returns jsonb
language plpgsql
stable
security definer
set search_path = 'public'
as $$
declare
  result jsonb;
begin
  select coalesce(jsonb_agg(store_row order by total_events desc), '[]'::jsonb)
  into result
  from (
    select
      e.store_id,
      s.name as store_name,
      s.city,
      s.chain,
      count(*) filter (where e.event_type = 'search_result_viewed') as search_impressions,
      count(distinct e.user_id) filter (where e.event_type = 'search_result_viewed') as search_unique_users,
      count(*) filter (where e.event_type = 'product_detail_viewed') as detail_views,
      count(distinct e.user_id) filter (where e.event_type = 'product_detail_viewed') as detail_unique_users,
      count(*) filter (where e.event_type = 'list_item_added') as list_adds,
      count(*) filter (where e.event_type = 'alert_created') as alerts_created,
      count(*) filter (where e.event_type = 'map_pin_tapped') as map_taps,
      count(*) as total_events,
      count(distinct e.user_id) as total_unique_users
    from analytics_events e
    join stores s on s.id = e.store_id
    where e.store_id is not null
      and e.created_at between start_date and end_date
      and (target_store_id is null or e.store_id = target_store_id)
    group by e.store_id, s.name, s.city, s.chain
  ) as store_row;

  return result;
end;
$$;

-- =============================================================================
-- 6. Aggregate user behavior summary (for super admin dashboard)
-- =============================================================================

create or replace view public.analytics_aggregate_summary as
select
  date_trunc('day', created_at)::date as event_date,
  event_type,
  count(*) as event_count,
  count(distinct user_id) as unique_users
from public.analytics_events
group by date_trunc('day', created_at)::date, event_type;

comment on view public.analytics_aggregate_summary is
  'Daily aggregate of analytics events by type for dashboards.';
