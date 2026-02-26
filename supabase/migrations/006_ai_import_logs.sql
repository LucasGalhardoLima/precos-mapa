-- 006_ai_import_logs.sql
-- Track AI extraction accuracy for training data

create table public.ai_import_logs (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  accuracy_percent integer not null,
  total_ai_products integer not null,
  total_manual_products integer not null,
  total_deleted_products integer not null,
  imported_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

alter table public.ai_import_logs enable row level security;

-- Business users can insert their own logs
create policy "ai_import_logs_insert_member" on public.ai_import_logs
  for insert with check (
    exists (
      select 1 from public.store_members
      where store_id = ai_import_logs.store_id and user_id = (select auth.uid())
    )
  );

-- Super admins can read all logs for AI training
create policy "ai_import_logs_select_super_admin" on public.ai_import_logs
  for select using (public.is_super_admin());
