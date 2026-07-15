-- 046_lock_down_engagement_rpc_family.sql
-- Extends 045's fix to the rest of the engagement-RPC family, per live
-- verification with the plain public anon key (no login at all):
--   product_engagement_report  -> returned 5 real rows
--   geo_hotzone_by_store       -> returned 1 real row
--   store_engagement_report    -> no error (empty only because that
--                                 particular store had no matching events)
-- All four are `security definer`, so RLS on analytics_events never applies
-- to them — the only gate is whatever EXECUTE grant exists, and Postgres
-- grants EXECUTE to PUBLIC by default. This project has never revoked that
-- default (see 045's comment for the same finding on user_engagement_*).

-- =============================================================================
-- 1. product_engagement_report / geo_hotzone_by_store / geo_hotzone_by_region
--    Nothing legitimate calls these except the super-admin dashboard's
--    service-role client (engajamento-queries.ts) — confirmed by grep, no
--    other caller in src/ or mobile/. Revoking from public/anon/authenticated
--    has no functional impact.
-- =============================================================================

revoke execute on function public.product_engagement_report(timestamptz, timestamptz)
  from public, anon, authenticated;
grant execute on function public.product_engagement_report(timestamptz, timestamptz) to service_role;

revoke execute on function public.geo_hotzone_by_store(timestamptz, timestamptz)
  from public, anon, authenticated;
grant execute on function public.geo_hotzone_by_store(timestamptz, timestamptz) to service_role;

revoke execute on function public.geo_hotzone_by_region(timestamptz, timestamptz)
  from public, anon, authenticated;
grant execute on function public.geo_hotzone_by_region(timestamptz, timestamptz) to service_role;

-- =============================================================================
-- 2. store_engagement_report — this one IS legitimately called by the
--    `authenticated` role: the business-owner analytics page
--    (src/app/painel/(protected)/analytics/analytics-queries.ts) calls it
--    through the session-scoped client, so EXECUTE must stay granted to
--    authenticated. The gap isn't the grant — it's that the function never
--    checked the caller owns target_store_id, contrary to spec FR-009
--    ("restrict a business owner's analytics view to only the store(s) they
--    own") and data-model.md's now-disproven assumption that RLS already
--    covers this (RLS does not apply inside a security definer function).
--
--    Fix: enforce ownership inside the function itself. Allowed callers:
--      - service_role (admin/backend/test scripts — matches how service_role
--        already bypasses RLS everywhere else in this app)
--      - super_admin (any store)
--      - a store_members row tying auth.uid() to target_store_id
--    The business page always passes session.currentMarketId, resolved
--    server-side and never user-suppliable, so this is a no-op for every
--    legitimate call and only blocks direct/malicious RPC invocation.
--    target_store_id is also now required (previously "all stores" if left
--    null — no legitimate caller ever passed null, and the super-admin
--    all-stores view already exists separately via store_engagement_summary
--    through the admin client, untouched by this change).
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
  is_authorized boolean;
begin
  if target_store_id is null then
    raise exception 'target_store_id is required' using errcode = '42501';
  end if;

  select
    auth.role() = 'service_role'
    or exists (
      select 1 from profiles
      where profiles.id = auth.uid() and profiles.role = 'super_admin'
    )
    or exists (
      select 1 from store_members
      where store_members.store_id = target_store_id
        and store_members.user_id = auth.uid()
    )
  into is_authorized;

  if not is_authorized then
    raise exception 'access denied for this store' using errcode = '42501';
  end if;

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
    where e.store_id = target_store_id
      and e.created_at between start_date and end_date
    group by e.store_id, s.name, s.city, s.chain
  ) as store_row;

  return result;
end;
$$;

comment on function public.store_engagement_report is
  'Date-range-filtered engagement for a single store. Enforces that the caller is service_role, super_admin, or a store_members owner of target_store_id — required because this function is security definer and executable by any authenticated user, so RLS on analytics_events does not apply here.';

notify pgrst, 'reload schema';
