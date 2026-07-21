-- 059_pdf_imports_attempt_count.sql
--
-- process-import's dedup step resets any non-'done' pdf_imports row back to
-- 'pending' and redispatches it on every cron run, with no cap. A row whose
-- extraction fails the same way every time (e.g. exceeds Vercel's function
-- duration limit) got retried indefinitely, burning a full worker invocation
-- and AI call each run with zero chance of succeeding. attempt_count lets
-- application code stop redispatching past a fixed cap.

alter table public.pdf_imports
  add column if not exists attempt_count integer not null default 0;

comment on column public.pdf_imports.attempt_count is
  'Incremented each time discoverAndPrepare re-dispatches a non-done row. Capped in application code to stop infinite retry loops on rows that fail the same way every time.';
