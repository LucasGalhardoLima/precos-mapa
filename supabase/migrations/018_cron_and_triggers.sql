-- 018_cron_and_triggers.sql
-- Enable pg_cron + pg_net and wire up Edge Function schedules + webhook trigger.
--
-- Prerequisites (operator must set before cron jobs work):
--   SELECT vault.create_secret('https://<project-ref>.supabase.co', 'supabase_url');
--   SELECT vault.create_secret('<service-role-key>', 'supabase_service_role_key');
--   SELECT vault.create_secret('<random-32+-char-secret>', 'edge_function_secret');
--
-- Edge functions must be deployed with --no-verify-jwt since we use
-- EDGE_FUNCTION_SECRET for auth instead of the default JWT check.
-- Also set the secret in Supabase Edge Function env:
--   supabase secrets set EDGE_FUNCTION_SECRET=<same-secret-as-vault>

-- ─── Extensions ────────────────────────────────────────────────────────────────

create extension if not exists pg_cron   with schema pg_catalog;
create extension if not exists pg_net    with schema extensions;

-- ─── Helper: invoke an Edge Function via pg_net ────────────────────────────────

create or replace function public.invoke_edge_function(
  function_name text,
  body jsonb default '{}'::jsonb
) returns void as $$
declare
  base_url    text;
  svc_key     text;
  edge_secret text;
begin
  select decrypted_secret into base_url
    from vault.decrypted_secrets
    where name = 'supabase_url'
    limit 1;

  select decrypted_secret into svc_key
    from vault.decrypted_secrets
    where name = 'supabase_service_role_key'
    limit 1;

  select decrypted_secret into edge_secret
    from vault.decrypted_secrets
    where name = 'edge_function_secret'
    limit 1;

  if base_url is null or svc_key is null then
    raise warning '[invoke_edge_function] Missing vault secrets: supabase_url or supabase_service_role_key — skipping %', function_name;
    return;
  end if;

  if edge_secret is null then
    raise warning '[invoke_edge_function] Missing vault secret: edge_function_secret — skipping %', function_name;
    return;
  end if;

  perform net.http_post(
    url     := base_url || '/functions/v1/' || function_name,
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || edge_secret
    ),
    body    := body
  );
end;
$$ language plpgsql security definer;

comment on function public.invoke_edge_function(text, jsonb)
  is 'Call a Supabase Edge Function via pg_net. Reads URL + key from Vault.';

-- ─── Cron Schedules ────────────────────────────────────────────────────────────
-- Times in UTC. Brazil (BRT) = UTC-3, so 03:00 UTC ≈ 00:00 BRT.

-- Expire promotions daily at 03:00 UTC (midnight BRT)
select cron.schedule(
  'expire-promotions',
  '0 3 * * *',
  $$select public.invoke_edge_function('expire-promotions')$$
);

-- Daily price snapshot at 04:00 UTC (01:00 BRT)
select cron.schedule(
  'daily-price-snapshot',
  '0 4 * * *',
  $$select public.invoke_edge_function('daily-price-snapshot')$$
);

-- Trial reminders at 12:00 UTC (09:00 BRT)
select cron.schedule(
  'trial-reminders',
  '0 12 * * *',
  $$select public.invoke_edge_function('trial-reminders')$$
);

-- Daily competitive digest at 11:00 UTC (08:00 BRT)
select cron.schedule(
  'daily-digest',
  '0 11 * * *',
  $$select public.invoke_edge_function('daily-digest')$$
);

-- Monthly price index on the 1st at 05:00 UTC (02:00 BRT)
select cron.schedule(
  'monthly-price-index',
  '0 5 1 * *',
  $$select public.invoke_edge_function('monthly-price-index')$$
);

-- ─── Webhook Trigger: notify-favorite-match on promotions INSERT ───────────────

create or replace function public.notify_favorite_match_trigger()
returns trigger as $$
begin
  perform public.invoke_edge_function(
    'notify-favorite-match',
    jsonb_build_object(
      'type',   'INSERT',
      'table',  'promotions',
      'record', row_to_json(NEW)::jsonb
    )
  );
  return NEW;
end;
$$ language plpgsql security definer;

create trigger on_promotion_insert
  after insert on promotions
  for each row
  execute function public.notify_favorite_match_trigger();
