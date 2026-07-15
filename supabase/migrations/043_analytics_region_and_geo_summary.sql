-- 043_analytics_region_and_geo_summary.sql
-- Feature 014-usage-hotzones, User Story 2: geographic hot-zone view.
--
-- No new RLS policy needed: `region` is just another column on a row already
-- governed by analytics_events_insert / _select_admin / _select_business
-- (020_analytics_events.sql:52-77) — confirmed in tasks.md T003. The two new
-- RPCs below select from analytics_events (joined to stores for the
-- store-location grouping), inheriting the same policies.

-- =============================================================================
-- 1. region column — coarse city/state, never precise coordinates (FR-007)
-- =============================================================================

alter table public.analytics_events
  add column if not exists region text;

comment on column public.analytics_events.region is
  'City/state string (e.g. "Matão, SP") from the client''s already-resolved '
  'location at tracking time. Only ever a genuinely resolved location (manual '
  'city choice or successful geocode) — never a permission-denied fallback '
  'default. Null when unavailable. Never precise device coordinates.';

-- =============================================================================
-- 2. Geo hot zone by store location — always available, no client change
--    needed. Every event with a store_id inherits that store's known
--    city/state (stores.city/state are NOT NULL for every row).
-- =============================================================================

create or replace function public.geo_hotzone_by_store(
  start_date timestamptz default (now() - interval '30 days'),
  end_date   timestamptz default now()
)
returns table (
  city text,
  state text,
  total_events bigint,
  total_unique_users bigint,
  store_count bigint
)
language sql
stable
security definer
set search_path = 'public'
as $$
  select
    s.city,
    s.state,
    count(*) as total_events,
    count(distinct e.user_id) as total_unique_users,
    count(distinct e.store_id) as store_count
  from analytics_events e
  join stores s on s.id = e.store_id
  where e.store_id is not null
    and e.created_at between start_date and end_date
  group by s.city, s.state
  order by total_events desc;
$$;

comment on function public.geo_hotzone_by_store is
  'Engagement grouped by each event''s store''s city/state — covers every store-tied event regardless of user location permission.';

-- =============================================================================
-- 3. Geo hot zone by user-derived region — only rows where region was
--    captured (permission granted and genuinely resolved, or manual choice).
-- =============================================================================

create or replace function public.geo_hotzone_by_region(
  start_date timestamptz default (now() - interval '30 days'),
  end_date   timestamptz default now()
)
returns table (
  region text,
  total_events bigint,
  total_unique_users bigint
)
language sql
stable
security definer
set search_path = 'public'
as $$
  select
    e.region,
    count(*) as total_events,
    count(distinct e.user_id) as total_unique_users
  from analytics_events e
  where e.region is not null
    and e.created_at between start_date and end_date
  group by e.region
  order by total_events desc;
$$;

comment on function public.geo_hotzone_by_region is
  'Engagement grouped by the user''s own resolved city/state, independent of which store (if any) the event was tied to.';

notify pgrst, 'reload schema';
