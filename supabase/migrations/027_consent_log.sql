-- consent_log: LGPD compliance — tracks consent actions (accept, withdrawal, deletion)
-- user_id is NOT a FK to auth.users because rows must survive account deletion

create table public.consent_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  action text not null check (action in ('privacy_policy_accepted', 'account_deletion', 'terms_accepted')),
  version text,
  ip_address text,
  created_at timestamptz not null default now()
);

-- RLS: users can insert their own consent records
alter table public.consent_log enable row level security;

create policy "consent_log_insert_own" on public.consent_log
  for insert with check (user_id = auth.uid());

-- Service role (Edge Functions) can insert for any user via bypassing RLS
-- No select/update/delete policies — consent records are append-only for users

create index ix_consent_log_user on public.consent_log (user_id);
