-- 045_lock_down_user_engagement_rpcs.sql
-- Security fix for the two RPCs added in 044_user_engagement_summary.sql.
--
-- Both are `security definer`, which means they execute with the owning
-- role's privileges and bypass the underlying analytics_events RLS
-- policies entirely. Postgres grants EXECUTE on newly created functions to
-- PUBLIC by default, and this project has never revoked that default
-- (confirmed: no prior migration contains a `revoke execute` statement).
-- Combined with Supabase exposing every public-schema function as a
-- `/rest/v1/rpc/...` endpoint callable by any authenticated request, this
-- means, prior to this migration, any logged-in mobile app user (not just
-- super_admin) could call user_engagement_report()/user_engagement_detail()
-- directly and pull every user's display_name plus their individual
-- shopping behavior — the exact per-user data these RPCs exist to report,
-- with none of the analytics_events_select_admin restriction applied.
--
-- This is the most sensitive instance of a pattern shared by the other
-- engagement RPCs in this feature (product_engagement_report,
-- store_engagement_report, geo_hotzone_by_store/region) — those return
-- platform-wide aggregates rather than per-user identifiable rows, so they
-- were flagged separately rather than locked down in this migration.
--
-- Fix: explicitly revoke EXECUTE from public/anon/authenticated and grant it
-- only to service_role, which is what the admin-panel server code already
-- exclusively uses to call these two RPCs (see engajamento-queries.ts /
-- user-engagement-detail-action.ts, both routed through getSupabaseAdmin()).

revoke execute on function public.user_engagement_report(timestamptz, timestamptz)
  from public, anon, authenticated;

revoke execute on function public.user_engagement_detail(uuid, timestamptz, timestamptz, integer)
  from public, anon, authenticated;

grant execute on function public.user_engagement_report(timestamptz, timestamptz) to service_role;
grant execute on function public.user_engagement_detail(uuid, timestamptz, timestamptz, integer) to service_role;

notify pgrst, 'reload schema';
