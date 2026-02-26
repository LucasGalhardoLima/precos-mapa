-- 010_automated_imports.sql
-- Automated PDF import pipeline with 3-pass consistency checking.
-- New tables: store_pdf_sources, pdf_imports
-- Alter: promotions.source CHECK to include 'cron', add pdf_import_id FK

-- =============================================================================
-- 1. store_pdf_sources — URLs de PDFs cadastradas por mercado
-- =============================================================================
create table public.store_pdf_sources (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  url text not null,
  label text,
  is_active boolean not null default true,
  last_checked_at timestamptz,
  last_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_store_pdf_sources_store on public.store_pdf_sources(store_id);
create index idx_store_pdf_sources_active on public.store_pdf_sources(is_active) where is_active = true;

-- =============================================================================
-- 2. pdf_imports — Historico de cada importacao automatizada
-- =============================================================================
create table public.pdf_imports (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  source_id uuid references public.store_pdf_sources(id) on delete set null,
  filename text not null,
  file_hash text not null,
  source_url text,
  storage_path text,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'done', 'needs_review', 'error')),
  extraction_pass_1 jsonb,
  extraction_pass_2 jsonb,
  extraction_pass_3 jsonb,
  consensus_result jsonb,
  consensus_type text check (consensus_type in ('unanimous', 'majority') or consensus_type is null),
  confidence_score numeric(5,2),
  ofertas_count integer,
  error_message text,
  processed_at timestamptz,
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  selected_pass integer check (selected_pass in (1, 2, 3) or selected_pass is null),
  created_at timestamptz not null default now(),
  constraint uq_pdf_imports_store_hash unique (store_id, file_hash)
);

create index idx_pdf_imports_store on public.pdf_imports(store_id);
create index idx_pdf_imports_status on public.pdf_imports(status);
create index idx_pdf_imports_needs_review on public.pdf_imports(status) where status = 'needs_review';

-- =============================================================================
-- 3. Alter promotions: add pdf_import_id FK and update source CHECK
-- =============================================================================
alter table public.promotions
  add column if not exists pdf_import_id uuid references public.pdf_imports(id);

-- Drop and recreate the source CHECK constraint to include 'cron'
alter table public.promotions
  drop constraint if exists promotions_source_check;

alter table public.promotions
  add constraint promotions_source_check
    check (source in ('manual', 'importador_ia', 'crawler', 'cron'));

-- =============================================================================
-- 4. RLS Policies
-- =============================================================================

-- Helper: check if user is super_admin (reuses existing pattern)
-- The function is_super_admin() already exists from previous migrations, just reference it.

-- store_pdf_sources
alter table public.store_pdf_sources enable row level security;

create policy "store_pdf_sources_select"
  on public.store_pdf_sources for select
  using (
    public.is_super_admin()
    or public.is_store_member_owner(store_id)
  );

create policy "store_pdf_sources_insert"
  on public.store_pdf_sources for insert
  with check (public.is_super_admin());

create policy "store_pdf_sources_update"
  on public.store_pdf_sources for update
  using (public.is_super_admin());

create policy "store_pdf_sources_delete"
  on public.store_pdf_sources for delete
  using (public.is_super_admin());

-- pdf_imports
alter table public.pdf_imports enable row level security;

create policy "pdf_imports_select"
  on public.pdf_imports for select
  using (
    public.is_super_admin()
    or public.is_store_member_owner(store_id)
  );

create policy "pdf_imports_update"
  on public.pdf_imports for update
  using (public.is_super_admin());

-- Service role (used by Edge Functions and cron) bypasses RLS automatically.
-- No INSERT policy needed since Edge Functions use service_role key.

-- =============================================================================
-- 5. Updated_at triggers
-- =============================================================================
create trigger set_updated_at_store_pdf_sources
  before update on public.store_pdf_sources
  for each row execute function public.set_updated_at();

-- =============================================================================
-- 6. Grants for PostgREST
-- =============================================================================
grant select on public.store_pdf_sources to authenticated;
grant select on public.pdf_imports to authenticated;

-- Allow service_role full access (used by Edge Functions / cron)
grant all on public.store_pdf_sources to service_role;
grant all on public.pdf_imports to service_role;

notify pgrst, 'reload schema';
