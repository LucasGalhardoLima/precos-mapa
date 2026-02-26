-- 001_initial_schema.sql
-- PrecoMapa: Grocery Price Comparison Platform
-- All tables, RLS policies, functions, triggers, and indexes

-- =============================================================================
-- Extensions
-- =============================================================================

create extension if not exists "pg_trgm" with schema public;

-- =============================================================================
-- Tables
-- =============================================================================

-- profiles: User profile linked to Supabase Auth
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'consumer' check (role in ('consumer', 'business')),
  display_name text,
  avatar_url text,
  city text,
  state text,
  search_radius_km integer not null default 5 check (search_radius_km between 1 and 50),
  b2c_plan text not null default 'free' check (b2c_plan in ('free', 'plus', 'family')),
  rc_customer_id text,
  push_token text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- stores: Physical supermarket locations
create table public.stores (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  chain text,
  address text not null,
  city text not null,
  state text not null,
  latitude double precision not null,
  longitude double precision not null,
  logo_url text,
  logo_initial text not null,
  logo_color text not null,
  phone text,
  b2b_plan text not null default 'free' check (b2b_plan in ('free', 'premium', 'premium_plus', 'enterprise')),
  stripe_customer_id text,
  stripe_subscription_id text,
  trial_ends_at timestamptz,
  search_priority integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- store_members: Links users to stores they manage
create table public.store_members (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner', 'admin', 'staff')),
  created_at timestamptz not null default now(),
  unique (store_id, user_id)
);

-- categories: Product categories for browsing tabs
create table public.categories (
  id text primary key,
  name text not null,
  icon text not null,
  sort_order integer not null default 0
);

-- products: Grocery items
create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category_id text not null references public.categories(id),
  brand text,
  reference_price numeric(10,2) not null,
  image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- product_synonyms: Synonym mapping for fuzzy search (FR-012)
create table public.product_synonyms (
  id uuid primary key default gen_random_uuid(),
  term text not null unique,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- promotions: Time-bound price offers (core table, Realtime enabled)
create table public.promotions (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id),
  store_id uuid not null references public.stores(id) on delete cascade,
  original_price numeric(10,2) not null,
  promo_price numeric(10,2) not null,
  start_date timestamptz not null,
  end_date timestamptz not null,
  status text not null default 'active' check (status in ('active', 'expired', 'pending_review')),
  verified boolean not null default false,
  source text not null default 'manual' check (source in ('manual', 'importador_ia', 'crawler')),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- user_favorites: Consumer's saved products
create table public.user_favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, product_id)
);

-- user_alerts: Consumer's price alert subscriptions
create table public.user_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  target_price numeric(10,2),
  radius_km integer not null default 5,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (user_id, product_id)
);

-- testimonials: Platform testimonials for onboarding
create table public.testimonials (
  id uuid primary key default gen_random_uuid(),
  user_name text not null,
  text text not null,
  savings_amount numeric(10,2) not null,
  sort_order integer not null default 0
);

-- platform_stats: Singleton row for social proof stats
create table public.platform_stats (
  id integer primary key default 1 check (id = 1),
  user_count text not null,
  city_name text not null,
  avg_monthly_savings text not null,
  updated_at timestamptz not null default now()
);

-- =============================================================================
-- Indexes
-- =============================================================================

-- Promotions
create index ix_promotions_store_id on public.promotions (store_id);
create index ix_promotions_product_id on public.promotions (product_id);
create index ix_promotions_status_end_date on public.promotions (status, end_date);
create index ix_promotions_store_created on public.promotions (store_id, created_at);

-- Products fuzzy search (pg_trgm)
create index ix_products_name_trgm on public.products using gin (name gin_trgm_ops);

-- Stores
create index ix_stores_is_active on public.stores (is_active) where is_active = true;
create index ix_stores_search_priority on public.stores (search_priority desc);

-- Store members
create index ix_store_members_user_id on public.store_members (user_id);

-- User favorites
create index ix_user_favorites_user_id on public.user_favorites (user_id);

-- User alerts
create index ix_user_alerts_user_id on public.user_alerts (user_id);
create index ix_user_alerts_product_id on public.user_alerts (product_id);

-- =============================================================================
-- Database Functions (must be before RLS policies that reference them)
-- =============================================================================

-- check_promotion_limit: Check if store can create more promotions this month
create or replace function public.check_promotion_limit(p_store_id uuid)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select case
    when s.b2b_plan in ('premium', 'premium_plus', 'enterprise') then true
    else (
      select count(*) < 5
      from public.promotions
      where store_id = p_store_id
        and created_at >= date_trunc('month', now() at time zone 'America/Sao_Paulo')
        and created_at < date_trunc('month', now() at time zone 'America/Sao_Paulo') + interval '1 month'
    )
  end
  from public.stores s where s.id = p_store_id;
$$;

-- check_favorite_limit: Check B2C plan-based favorite limit
create or replace function public.check_favorite_limit(p_user_id uuid)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select case
    when p.b2c_plan in ('plus', 'family') then true
    else (
      select count(*) < 10 from public.user_favorites
      where user_id = p_user_id
    )
  end
  from public.profiles p where p.id = p_user_id;
$$;

-- check_alert_limit: Check B2C plan-based alert limit
create or replace function public.check_alert_limit(p_user_id uuid)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select case
    when p.b2c_plan in ('plus', 'family') then true
    else (
      select count(*) < 3 from public.user_alerts
      where user_id = p_user_id and is_active = true
    )
  end
  from public.profiles p where p.id = p_user_id;
$$;

-- =============================================================================
-- Enable RLS on all tables
-- =============================================================================

alter table public.profiles enable row level security;
alter table public.stores enable row level security;
alter table public.store_members enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_synonyms enable row level security;
alter table public.promotions enable row level security;
alter table public.user_favorites enable row level security;
alter table public.user_alerts enable row level security;
alter table public.testimonials enable row level security;
alter table public.platform_stats enable row level security;

-- =============================================================================
-- RLS Policies
-- =============================================================================

-- profiles
create policy "profiles_select_own" on public.profiles
  for select using (id = (select auth.uid()));

create policy "profiles_update_own" on public.profiles
  for update using (id = (select auth.uid()));

-- stores (public read for active stores)
create policy "stores_select_active" on public.stores
  for select using (is_active = true);

create policy "stores_insert_business" on public.stores
  for insert with check (
    exists (
      select 1 from public.profiles
      where id = (select auth.uid()) and role = 'business'
    )
  );

create policy "stores_update_members" on public.stores
  for update using (
    exists (
      select 1 from public.store_members
      where store_id = stores.id
        and user_id = (select auth.uid())
        and role in ('owner', 'admin')
    )
  );

create policy "stores_delete_owner" on public.stores
  for delete using (
    exists (
      select 1 from public.store_members
      where store_id = stores.id
        and user_id = (select auth.uid())
        and role = 'owner'
    )
  );

-- store_members
create policy "store_members_select_own" on public.store_members
  for select using (user_id = (select auth.uid()));

create policy "store_members_insert_owner" on public.store_members
  for insert with check (
    -- Allow self-insert (store creation) or existing owner adding member
    user_id = (select auth.uid())
    or exists (
      select 1 from public.store_members
      where store_id = store_members.store_id
        and user_id = (select auth.uid())
        and role = 'owner'
    )
  );

create policy "store_members_delete_owner" on public.store_members
  for delete using (
    exists (
      select 1 from public.store_members sm
      where sm.store_id = store_members.store_id
        and sm.user_id = (select auth.uid())
        and sm.role = 'owner'
    )
  );

-- categories (public read)
create policy "categories_select_all" on public.categories
  for select to anon, authenticated using (true);

-- products (public read)
create policy "products_select_all" on public.products
  for select to anon, authenticated using (true);

create policy "products_insert_business" on public.products
  for insert with check (
    exists (
      select 1 from public.profiles
      where id = (select auth.uid()) and role = 'business'
    )
  );

create policy "products_update_business" on public.products
  for update using (
    exists (
      select 1 from public.profiles
      where id = (select auth.uid()) and role = 'business'
    )
  );

-- product_synonyms (public read)
create policy "product_synonyms_select_all" on public.product_synonyms
  for select to anon, authenticated using (true);

-- promotions
create policy "promotions_select_active" on public.promotions
  for select to anon, authenticated using (
    status = 'active' and end_date > now()
  );

-- Business users can also see their own store's promotions (any status)
create policy "promotions_select_own_store" on public.promotions
  for select using (
    exists (
      select 1 from public.store_members
      where store_id = promotions.store_id
        and user_id = (select auth.uid())
    )
  );

create policy "promotions_insert_member" on public.promotions
  for insert with check (
    exists (
      select 1 from public.store_members
      where store_id = promotions.store_id
        and user_id = (select auth.uid())
    )
    and public.check_promotion_limit(store_id)
  );

create policy "promotions_update_member" on public.promotions
  for update using (
    exists (
      select 1 from public.store_members
      where store_id = promotions.store_id
        and user_id = (select auth.uid())
    )
  );

create policy "promotions_delete_member" on public.promotions
  for delete using (
    exists (
      select 1 from public.store_members
      where store_id = promotions.store_id
        and user_id = (select auth.uid())
    )
  );

-- user_favorites
create policy "favorites_select_own" on public.user_favorites
  for select using (user_id = (select auth.uid()));

create policy "favorites_insert_own" on public.user_favorites
  for insert with check (
    user_id = (select auth.uid())
    and public.check_favorite_limit((select auth.uid()))
  );

create policy "favorites_delete_own" on public.user_favorites
  for delete using (user_id = (select auth.uid()));

-- user_alerts
create policy "alerts_select_own" on public.user_alerts
  for select using (user_id = (select auth.uid()));

create policy "alerts_insert_own" on public.user_alerts
  for insert with check (
    user_id = (select auth.uid())
    and public.check_alert_limit((select auth.uid()))
  );

create policy "alerts_update_own" on public.user_alerts
  for update using (user_id = (select auth.uid()));

create policy "alerts_delete_own" on public.user_alerts
  for delete using (user_id = (select auth.uid()));

-- testimonials (public read)
create policy "testimonials_select_all" on public.testimonials
  for select to anon, authenticated using (true);

-- platform_stats (public read)
create policy "platform_stats_select_all" on public.platform_stats
  for select to anon, authenticated using (true);

-- =============================================================================
-- Additional Database Functions
-- =============================================================================

-- update_search_priority: Trigger function to set search_priority on plan change
create or replace function public.update_search_priority()
returns trigger
language plpgsql
as $$
begin
  new.search_priority := case
    when new.b2b_plan = 'enterprise' then 30
    when new.b2b_plan = 'premium_plus' then 20
    when new.b2b_plan = 'premium' then 10
    else 0
  end;
  return new;
end;
$$;

create trigger trg_stores_search_priority
  before insert or update of b2b_plan on public.stores
  for each row execute function update_search_priority();

-- check_store_limit: Check if business user can create another store
create or replace function public.check_store_limit(p_user_id uuid)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select case
    when p.role != 'business' then false
    when exists (
      select 1 from public.store_members sm
      join public.stores s on s.id = sm.store_id
      where sm.user_id = p_user_id
      and s.b2b_plan in ('premium_plus', 'enterprise')
    ) then (
      select count(*) < 5 from public.store_members
      where user_id = p_user_id and role = 'owner'
    )
    else (
      select count(*) < 1 from public.store_members
      where user_id = p_user_id and role = 'owner'
    )
  end
  from public.profiles p where p.id = p_user_id;
$$;

-- search_products: Fuzzy search via pg_trgm + synonyms (FR-012)
create or replace function public.search_products(query text)
returns table (id uuid, name text, similarity_score real)
language sql
stable
security definer
set search_path = 'public'
as $$
  select p.id, p.name, similarity(p.name, query) as similarity_score
  from public.products p
  where similarity(p.name, query) > 0.3
  union
  select p.id, p.name, similarity(ps.term, query) as similarity_score
  from public.product_synonyms ps
  join public.products p on p.id = ps.product_id
  where similarity(ps.term, query) > 0.3
  order by similarity_score desc
  limit 20;
$$;

-- handle_new_user: Trigger to create profile on auth.users INSERT
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- updated_at trigger function
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Apply updated_at triggers
create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.handle_updated_at();

create trigger trg_stores_updated_at
  before update on public.stores
  for each row execute function public.handle_updated_at();

create trigger trg_products_updated_at
  before update on public.products
  for each row execute function public.handle_updated_at();

create trigger trg_promotions_updated_at
  before update on public.promotions
  for each row execute function public.handle_updated_at();

-- =============================================================================
-- Enable Realtime on promotions table
-- =============================================================================

alter publication supabase_realtime add table public.promotions;
