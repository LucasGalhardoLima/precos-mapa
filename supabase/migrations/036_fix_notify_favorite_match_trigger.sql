-- 036_fix_notify_favorite_match_trigger.sql
-- Wrap notify_favorite_match_trigger in a defensive EXCEPTION block so that
-- failures in pg_net / invoke_edge_function (e.g. missing GUCs, pg_net queue
-- errors) do not roll back the originating INSERT into promotions.
--
-- Symptom this fixes: cron worker imports were marked done with 0 published
-- because every promotion INSERT failed with
--   XX000: Quote command returned error
-- coming from net.http_post inside this trigger.
--
-- Trade-off: notification delivery becomes best-effort. If the edge function
-- call fails, the INSERT still succeeds and a WARNING is emitted to the
-- Postgres logs. Notification reliability should be addressed separately by
-- fixing the underlying pg_net configuration (app.settings.base_url and
-- app.settings.edge_secret).

CREATE OR REPLACE FUNCTION public.notify_favorite_match_trigger()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  BEGIN
    PERFORM public.invoke_edge_function(
      'notify-favorite-match',
      jsonb_build_object(
        'type',   'INSERT',
        'table',  'promotions',
        'record', row_to_json(NEW)::jsonb
      )
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'notify_favorite_match_trigger failed for promotion %: %',
      NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$$;
