-- 047_user_engagement_consumers_only.sql
-- The app is consumer-only in practice, but analytics_events.user_id has no
-- role constraint — a handful of business/super_admin accounts also have
-- rows (e.g. from testing/dogfooding). Scope the per-user leaderboard to
-- profiles.role = 'consumer' so internal/business accounts never show up
-- alongside real end users, matching /painel/super/usuarios' inverse filter
-- (that page shows only super_admin/business — this one should show only
-- consumer).
--
-- CREATE OR REPLACE preserves the existing GRANT from
-- 045_lock_down_user_engagement_rpcs.sql (service_role only) — only the
-- function body changes here.

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
    join profiles p on p.id = e.user_id and p.role = 'consumer'
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
  'Per-user engagement leaderboard for the super-admin dashboard, scoped to profiles.role = ''consumer'' only. Total events, event-type breakdown, and each user''s top product/store/city (by event count) within the date range.';

notify pgrst, 'reload schema';
