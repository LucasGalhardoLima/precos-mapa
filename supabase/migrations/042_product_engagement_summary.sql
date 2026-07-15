-- 042_product_engagement_summary.sql
-- Feature 014-usage-hotzones, User Story 1: platform-wide product engagement
-- ranking. Mirrors store_engagement_summary / store_engagement_report from
-- 020_analytics_events.sql, grouped by product instead of store.
--
-- No new RLS policy needed: both objects select from analytics_events, already
-- governed by analytics_events_select_admin / analytics_events_select_business
-- (020_analytics_events.sql:56-77) — confirmed in tasks.md T003.

-- =============================================================================
-- 1. Per-product engagement summary view
-- =============================================================================

create or replace view public.product_engagement_summary as
select
  e.product_id,
  p.name as product_name,
  count(*) filter (where e.event_type = 'search_result_viewed') as search_impressions,
  count(distinct e.user_id) filter (where e.event_type = 'search_result_viewed') as search_unique_users,
  count(*) filter (where e.event_type = 'product_detail_viewed') as detail_views,
  count(distinct e.user_id) filter (where e.event_type = 'product_detail_viewed') as detail_unique_users,
  count(*) as total_events,
  count(distinct e.user_id) as total_unique_users,
  min(e.created_at) as first_event_at,
  max(e.created_at) as last_event_at
from public.analytics_events e
join public.products p on p.id = e.product_id
where e.product_id is not null
group by e.product_id, p.name;

comment on view public.product_engagement_summary is
  'Per-product engagement metrics — platform-wide ranking of most-viewed/most-searched products.';

-- =============================================================================
-- 2. Date-range-filtered product engagement report function
-- =============================================================================

create or replace function public.product_engagement_report(
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
  select coalesce(jsonb_agg(product_row order by total_events desc), '[]'::jsonb)
  into result
  from (
    select
      e.product_id,
      p.name as product_name,
      count(*) filter (where e.event_type = 'search_result_viewed') as search_impressions,
      count(distinct e.user_id) filter (where e.event_type = 'search_result_viewed') as search_unique_users,
      count(*) filter (where e.event_type = 'product_detail_viewed') as detail_views,
      count(distinct e.user_id) filter (where e.event_type = 'product_detail_viewed') as detail_unique_users,
      count(*) as total_events,
      count(distinct e.user_id) as total_unique_users
    from analytics_events e
    join products p on p.id = e.product_id
    where e.product_id is not null
      and e.created_at between start_date and end_date
    group by e.product_id, p.name
  ) as product_row;

  return result;
end;
$$;

comment on function public.product_engagement_report is
  'Date-range-filtered product engagement ranking, mirroring store_engagement_report''s shape.';

notify pgrst, 'reload schema';
