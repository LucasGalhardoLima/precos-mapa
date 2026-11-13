#!/usr/bin/env bash
# Removes the rows left in production by Maestro E2E runs made with the `e2e`
# EAS profile (mobile/eas.json). See mobile/.maestro/README.md.
#
# What is "ours": auth.users with is_anonymous AND raw_user_meta_data->>'e2e' = 'true'
# (set by signInAnonymously in E2E builds, mobile/lib/e2e.ts), plus
# analytics_events with metadata->>'e2e' = 'true'. Rows without the mark are
# never selected, counted for deletion or touched.
#
# What deleting a marked user takes with it (checked in supabase/migrations):
#   auth.users -> profiles            ON DELETE CASCADE (001_initial_schema.sql)
#   profiles   -> tracked_items       ON DELETE CASCADE (084_tracked_items.sql)
#   profiles   -> notification_preferences ON DELETE CASCADE (029)
#   auth.users -> analytics_events    ON DELETE CASCADE (020), user_id nullable since 049
# So one DELETE on auth.users is enough. Anonymous-id analytics rows (no user)
# are deleted by their own mark.
# NOT covered: city_interest (079) has no owner column. Nothing in an E2E run may
# ever fill it, so there is nothing to clean; never submit the "Fora de Matão" e-mail.
#
# Default = DRY RUN: SELECT only. Needs the Supabase CLI login (macOS Keychain);
# the token is piped straight into curl and never printed.
#
# Usage:
#   scripts/e2e-cleanup.sh            # dry run (default)
#   scripts/e2e-cleanup.sh --apply    # DELETE, after typing the confirmation phrase
#
# Runs through the Management API (not a direct Postgres connection), as postgres,
# so it bypasses RLS.
set -euo pipefail

PROJECT_REF="zyhhcfkbzfbarnxlkfri"
MODE="dry-run"
case "${1:-}" in
  "") ;;
  --apply) MODE="apply" ;;
  *) echo "usage: $0 [--apply]" >&2; exit 2 ;;
esac

USERS_WHERE="is_anonymous is true and raw_user_meta_data->>'e2e' = 'true'"

token() {
  local raw
  raw=$(security find-generic-password -s "Supabase CLI" -a supabase -w 2>/dev/null) || { echo "Supabase CLI not logged in (run: supabase login)" >&2; exit 1; }
  raw=${raw#go-keyring-base64:}
  if [[ "$raw" != sbp_* ]]; then raw=$(printf '%s' "$raw" | base64 -d); fi
  printf '%s' "$raw"
}

run_sql() {
  jq -n --arg q "$1" '{query: $q}' | curl -sS --fail-with-body \
    -H "Authorization: Bearer $(token)" -H "Content-Type: application/json" \
    --data @- "https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query"
}

MARKED="(select id from auth.users where ${USERS_WHERE})"
COUNTS_SQL="
select
  (select count(*) from ${MARKED} m) as marked_users,
  (select count(*) from public.profiles where id in ${MARKED}) as profiles,
  (select count(*) from public.tracked_items where user_id in ${MARKED}) as tracked_items,
  (select count(*) from public.notification_preferences where user_id in ${MARKED}) as notification_preferences,
  (select count(*) from public.analytics_events where metadata->>'e2e' = 'true' or user_id in ${MARKED}) as analytics_events,
  (select count(*) from auth.users where is_anonymous is true and coalesce(raw_user_meta_data->>'e2e','') <> 'true') as anonymous_users_not_marked_untouched
"

echo "== Marked rows (mode: ${MODE}) =="
run_sql "$COUNTS_SQL" | jq .
echo "== Marked users (id + created_at only) =="
run_sql "select id, created_at from auth.users where ${USERS_WHERE} order by created_at" | jq -c '.[]'

if [[ "$MODE" == "dry-run" ]]; then
  echo "Dry run: nothing was changed. Re-run with --apply to delete the marked rows (re-evaluated at apply time)."
  exit 0
fi

PHRASE="delete e2e rows"
read -r -p "This DELETES the marked rows above from PRODUCTION. Type '${PHRASE}' to continue: " answer
[[ "$answer" == "$PHRASE" ]] || { echo "Aborted."; exit 1; }

# One transaction (single statement batch). Cascades remove profiles,
# tracked_items, notification_preferences and the users' analytics_events.
run_sql "
begin;
delete from public.analytics_events where metadata->>'e2e' = 'true';
delete from auth.users where ${USERS_WHERE};
commit;
" | jq .
echo "Done. Re-run without --apply to confirm the counts are zero."
