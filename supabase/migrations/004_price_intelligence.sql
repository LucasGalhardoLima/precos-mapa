-- D1.5: Price Intelligence — Regional Price Index tables, RPCs, and RLS
-- Builds on price_snapshots from 003_phase2_features.sql

-- =============================================================================
-- Monthly Price Indices (one row per month per city)
-- =============================================================================

create table public.price_indices (
  id uuid primary key default gen_random_uuid(),
  city text not null,
  state text not null,
  period_start date not null,
  period_end date not null,
  index_value numeric(10,4) not null default 100,
  mom_change_percent numeric(6,2),         -- month-over-month
  yoy_change_percent numeric(6,2),         -- year-over-year
  data_quality_score integer not null default 0 check (data_quality_score between 0 and 100),
  product_count integer not null default 0,
  store_count integer not null default 0,
  snapshot_count integer not null default 0,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (city, state, period_start)
);

-- =============================================================================
-- Category-level breakdown per month
-- =============================================================================

create table public.price_index_categories (
  id uuid primary key default gen_random_uuid(),
  index_id uuid not null references public.price_indices(id) on delete cascade,
  category_id text not null references public.categories(id),
  avg_price numeric(10,2) not null,
  min_price numeric(10,2) not null,
  max_price numeric(10,2) not null,
  product_count integer not null default 0,
  mom_change_percent numeric(6,2),
  weight numeric(5,4) not null default 0,   -- category weight in overall index (0-1)
  created_at timestamptz not null default now(),
  unique (index_id, category_id)
);

-- =============================================================================
-- Product-level detail per month (top movers source)
-- =============================================================================

create table public.price_index_products (
  id uuid primary key default gen_random_uuid(),
  index_id uuid not null references public.price_indices(id) on delete cascade,
  product_id uuid not null references public.products(id),
  avg_price numeric(10,2) not null,
  min_price numeric(10,2) not null,
  max_price numeric(10,2) not null,
  snapshot_days integer not null default 0,  -- how many days had data
  mom_change_percent numeric(6,2),
  created_at timestamptz not null default now(),
  unique (index_id, product_id)
);

-- =============================================================================
-- Data quality flags (outliers, staleness)
-- =============================================================================

create table public.price_quality_flags (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id),
  store_id uuid references public.stores(id),
  promotion_id uuid references public.promotions(id),
  flag_type text not null check (flag_type in ('outlier_high', 'outlier_low', 'stale', 'missing_data', 'suspicious_pattern')),
  severity text not null default 'medium' check (severity in ('low', 'medium', 'high', 'critical')),
  detail text,
  reference_value numeric(10,2),    -- what we expected
  actual_value numeric(10,2),       -- what we found
  is_resolved boolean not null default false,
  resolved_by uuid references public.profiles(id),
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

-- =============================================================================
-- Indexes
-- =============================================================================

create index ix_price_indices_city_period on public.price_indices (city, state, period_start desc);
create index ix_price_indices_status on public.price_indices (status);
create index ix_price_index_categories_index on public.price_index_categories (index_id);
create index ix_price_index_products_index on public.price_index_products (index_id);
create index ix_price_index_products_mom on public.price_index_products (index_id, mom_change_percent desc nulls last);
create index ix_price_quality_flags_unresolved on public.price_quality_flags (is_resolved, created_at desc) where not is_resolved;
create index ix_price_quality_flags_product on public.price_quality_flags (product_id);

-- =============================================================================
-- RLS
-- =============================================================================

alter table public.price_indices enable row level security;
alter table public.price_index_categories enable row level security;
alter table public.price_index_products enable row level security;
alter table public.price_quality_flags enable row level security;

-- Published indices: public read (anon + authenticated)
create policy "price_indices_public_read" on public.price_indices
  for select using (status = 'published');

-- Super admin: full access to all indices
create policy "price_indices_admin_all" on public.price_indices
  for all using (
    exists (
      select 1 from public.profiles
      where id = (select auth.uid()) and role = 'super_admin'
    )
  );

-- Category breakdown: public read for published indices
create policy "price_index_categories_public_read" on public.price_index_categories
  for select using (
    exists (
      select 1 from public.price_indices pi
      where pi.id = index_id and pi.status = 'published'
    )
  );

-- Category breakdown: admin full access
create policy "price_index_categories_admin_all" on public.price_index_categories
  for all using (
    exists (
      select 1 from public.profiles
      where id = (select auth.uid()) and role = 'super_admin'
    )
  );

-- Product detail: public read for published indices
create policy "price_index_products_public_read" on public.price_index_products
  for select using (
    exists (
      select 1 from public.price_indices pi
      where pi.id = index_id and pi.status = 'published'
    )
  );

-- Product detail: admin full access
create policy "price_index_products_admin_all" on public.price_index_products
  for all using (
    exists (
      select 1 from public.profiles
      where id = (select auth.uid()) and role = 'super_admin'
    )
  );

-- Quality flags: admin only
create policy "price_quality_flags_admin_all" on public.price_quality_flags
  for all using (
    exists (
      select 1 from public.profiles
      where id = (select auth.uid()) and role = 'super_admin'
    )
  );

-- =============================================================================
-- Timestamp triggers
-- =============================================================================

create trigger trg_price_indices_updated_at
  before update on public.price_indices
  for each row execute function public.handle_updated_at();

-- =============================================================================
-- Add store_id to price_snapshots for richer competitive data
-- =============================================================================

alter table public.price_snapshots
  add column if not exists store_id uuid references public.stores(id);

create index if not exists ix_price_snapshots_store on public.price_snapshots (store_id);

-- =============================================================================
-- RPCs
-- =============================================================================

-- Get latest published indices for a city (last 12 months)
create or replace function public.get_latest_index(
  p_city text,
  p_state text,
  p_limit integer default 12
)
returns table (
  id uuid,
  period_start date,
  period_end date,
  index_value numeric,
  mom_change_percent numeric,
  yoy_change_percent numeric,
  data_quality_score integer,
  product_count integer,
  store_count integer,
  published_at timestamptz
)
language sql stable
as $$
  select
    pi.id,
    pi.period_start,
    pi.period_end,
    pi.index_value,
    pi.mom_change_percent,
    pi.yoy_change_percent,
    pi.data_quality_score,
    pi.product_count,
    pi.store_count,
    pi.published_at
  from public.price_indices pi
  where pi.city = p_city
    and pi.state = p_state
    and pi.status = 'published'
  order by pi.period_start desc
  limit p_limit;
$$;

-- Get top price movers (risers or fallers) for a given index
create or replace function public.get_price_movers(
  p_index_id uuid,
  p_direction text default 'up',  -- 'up' for risers, 'down' for fallers
  p_limit integer default 10
)
returns table (
  product_id uuid,
  product_name text,
  category_name text,
  avg_price numeric,
  min_price numeric,
  max_price numeric,
  mom_change_percent numeric
)
language sql stable
as $$
  select
    pip.product_id,
    pr.name as product_name,
    c.name as category_name,
    pip.avg_price,
    pip.min_price,
    pip.max_price,
    pip.mom_change_percent
  from public.price_index_products pip
  join public.products pr on pr.id = pip.product_id
  join public.categories c on c.id = pr.category_id
  where pip.index_id = p_index_id
    and pip.mom_change_percent is not null
    and (
      (p_direction = 'up' and pip.mom_change_percent > 0)
      or (p_direction = 'down' and pip.mom_change_percent < 0)
    )
  order by
    case when p_direction = 'up' then pip.mom_change_percent end desc,
    case when p_direction = 'down' then pip.mom_change_percent end asc
  limit p_limit;
$$;
