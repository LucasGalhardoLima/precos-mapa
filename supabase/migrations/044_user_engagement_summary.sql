-- 044_user_engagement_summary.sql
-- Feature 014-usage-hotzones follow-up: per-user engagement leaderboard and
-- drill-down for the super-admin dashboard ("heatzone"/top-items per user).
--
-- Geography note: analytics_events.region (self-reported city, gated on
-- location permission — see 043_analytics_region_and_geo_summary.sql) is not
-- yet populated by any mobile client in production. Per-user geography here
-- is therefore keyed off the *store's* known city/state (always populated
-- via store_id) rather than region, mirroring the existing
-- geo_hotzone_by_store / geo_hotzone_by_region split. region is still
-- surfaced in the drill-down as a forward-compatible breakdown.
--
-- No new RLS policy needed: both RPCs select from analytics_events, already
-- governed by analytics_events_select_admin (super_admin read-all).

-- =============================================================================
-- 1. Per-user engagement leaderboard (date-range filtered)
-- =============================================================================

create or replace function public.user_engagement_report(
  start_date timestamptz default (now() - interval '30 days'),
  end_date   timestamptz default now()
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
  with scoped as (
    select e.*
    from analytics_events e
    where e.created_at between start_date and end_date
  ),
  product_counts as (
    select user_id, product_id, count(*) as cnt,
           row_number() over (partition by user_id order by count(*) desc) as rn
    from scoped
    where product_id is not null
    group by user_id, product_id
  ),
  store_counts as (
    select user_id, store_id, count(*) as cnt,
           row_number() over (partition by user_id order by count(*) desc) as rn
    from scoped
    where store_id is not null
    group by user_id, store_id
  ),
  city_counts as (
    select s.user_id, st.city, st.state, count(*) as cnt,
           row_number() over (partition by s.user_id order by count(*) desc) as rn
    from scoped s
    join stores st on st.id = s.store_id
    group by s.user_id, st.city, st.state
  ),
  per_user as (
    select
      e.user_id,
      p.display_name,
      count(*) filter (where e.event_type = 'search_result_viewed') as search_impressions,
      count(*) filter (where e.event_type = 'product_detail_viewed') as detail_views,
      count(*) filter (where e.event_type = 'list_item_added') as list_adds,
      count(*) filter (where e.event_type = 'alert_created') as alerts_created,
      count(*) filter (where e.event_type = 'map_pin_tapped') as map_taps,
      count(*) as total_events,
      tp.product_id as top_product_id,
      tpp.name as top_product_name,
      tp.cnt as top_product_events,
      ts.store_id as top_store_id,
      tss.name as top_store_name,
      ts.cnt as top_store_events,
      tc.city as top_city,
      tc.state as top_state,
      tc.cnt as top_city_events,
      min(e.created_at) as first_event_at,
      max(e.created_at) as last_event_at
    from scoped e
    left join profiles p on p.id = e.user_id
    left join product_counts tp on tp.user_id = e.user_id and tp.rn = 1
    left join products tpp on tpp.id = tp.product_id
    left join store_counts ts on ts.user_id = e.user_id and ts.rn = 1
    left join stores tss on tss.id = ts.store_id
    left join city_counts tc on tc.user_id = e.user_id and tc.rn = 1
    group by e.user_id, p.display_name, tp.product_id, tpp.name, tp.cnt,
             ts.store_id, tss.name, ts.cnt, tc.city, tc.state, tc.cnt
  )
  select coalesce(jsonb_agg(per_user order by total_events desc), '[]'::jsonb)
  into result
  from per_user;

  return result;
end;
$$;

comment on function public.user_engagement_report is
  'Per-user engagement leaderboard for the super-admin dashboard: total events, event-type breakdown, and each user''s top product/store/city (by event count) within the date range.';

-- =============================================================================
-- 2. Per-user drill-down: top products, top stores, geography, for one user
-- =============================================================================

create or replace function public.user_engagement_detail(
  target_user_id uuid,
  start_date     timestamptz default (now() - interval '30 days'),
  end_date       timestamptz default now(),
  top_n          integer default 5
)
returns jsonb
language plpgsql
stable
security definer
set search_path = 'public'
as $$
declare
  top_products jsonb;
  top_stores jsonb;
  top_cities jsonb;
  top_regions jsonb;
  totals jsonb;
begin
  select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) into top_products
  from (
    select p.id as product_id, p.name as product_name, count(*) as events
    from analytics_events e
    join products p on p.id = e.product_id
    where e.user_id = target_user_id
      and e.created_at between start_date and end_date
      and e.product_id is not null
    group by p.id, p.name
    order by events desc
    limit top_n
  ) t;

  select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) into top_stores
  from (
    select s.id as store_id, s.name as store_name, s.city, s.state, count(*) as events
    from analytics_events e
    join stores s on s.id = e.store_id
    where e.user_id = target_user_id
      and e.created_at between start_date and end_date
      and e.store_id is not null
    group by s.id, s.name, s.city, s.state
    order by events desc
    limit top_n
  ) t;

  select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) into top_cities
  from (
    select s.city, s.state, count(*) as events
    from analytics_events e
    join stores s on s.id = e.store_id
    where e.user_id = target_user_id
      and e.created_at between start_date and end_date
      and e.store_id is not null
    group by s.city, s.state
    order by events desc
    limit top_n
  ) t;

  select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) into top_regions
  from (
    select region, count(*) as events
    from analytics_events
    where user_id = target_user_id
      and created_at between start_date and end_date
      and region is not null
    group by region
    order by events desc
    limit top_n
  ) t;

  select jsonb_build_object(
    'search_impressions', count(*) filter (where event_type = 'search_result_viewed'),
    'detail_views', count(*) filter (where event_type = 'product_detail_viewed'),
    'list_adds', count(*) filter (where event_type = 'list_item_added'),
    'alerts_created', count(*) filter (where event_type = 'alert_created'),
    'map_taps', count(*) filter (where event_type = 'map_pin_tapped'),
    'total_events', count(*)
  ) into totals
  from analytics_events
  where user_id = target_user_id
    and created_at between start_date and end_date;

  return jsonb_build_object(
    'top_products', top_products,
    'top_stores', top_stores,
    'top_cities', top_cities,
    'top_regions', top_regions,
    'totals', totals
  );
end;
$$;

comment on function public.user_engagement_detail is
  'Per-user drill-down for the super-admin dashboard: top N products/stores/cities/self-reported regions by event count within the date range, plus event-type totals.';

notify pgrst, 'reload schema';
