-- Phase 2 features: shopping lists, price snapshots, competitive intelligence RPCs

-- Shopping lists
create table public.shopping_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  is_template boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.shopping_list_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.shopping_lists(id) on delete cascade,
  product_id uuid not null references public.products(id),
  quantity integer not null default 1,
  is_checked boolean not null default false,
  created_at timestamptz not null default now()
);

-- Price snapshots (daily aggregation)
create table public.price_snapshots (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id),
  date date not null default current_date,
  min_promo_price numeric(10,2) not null,
  avg_promo_price numeric(10,2) not null,
  store_count integer not null default 0,
  reference_price numeric(10,2),
  created_at timestamptz not null default now(),
  unique (product_id, date)
);

-- Indexes
create index ix_shopping_lists_user on public.shopping_lists (user_id);
create index ix_shopping_list_items_list on public.shopping_list_items (list_id);
create index ix_price_snapshots_product_date on public.price_snapshots (product_id, date);

-- Stripe fields on stores
alter table public.stores
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists trial_ends_at timestamptz;

-- RLS
alter table public.shopping_lists enable row level security;
alter table public.shopping_list_items enable row level security;
alter table public.price_snapshots enable row level security;

-- Shopping lists: users can manage their own
create policy "shopping_lists_select_own" on public.shopping_lists
  for select using (user_id = (select auth.uid()));
create policy "shopping_lists_insert_own" on public.shopping_lists
  for insert with check (user_id = (select auth.uid()));
create policy "shopping_lists_update_own" on public.shopping_lists
  for update using (user_id = (select auth.uid()));
create policy "shopping_lists_delete_own" on public.shopping_lists
  for delete using (user_id = (select auth.uid()));

-- Shopping list items: via parent list ownership
create policy "shopping_list_items_select" on public.shopping_list_items
  for select using (
    exists (
      select 1 from public.shopping_lists sl
      where sl.id = list_id and sl.user_id = (select auth.uid())
    )
  );
create policy "shopping_list_items_insert" on public.shopping_list_items
  for insert with check (
    exists (
      select 1 from public.shopping_lists sl
      where sl.id = list_id and sl.user_id = (select auth.uid())
    )
  );
create policy "shopping_list_items_update" on public.shopping_list_items
  for update using (
    exists (
      select 1 from public.shopping_lists sl
      where sl.id = list_id and sl.user_id = (select auth.uid())
    )
  );
create policy "shopping_list_items_delete" on public.shopping_list_items
  for delete using (
    exists (
      select 1 from public.shopping_lists sl
      where sl.id = list_id and sl.user_id = (select auth.uid())
    )
  );

-- Price snapshots: public read
create policy "price_snapshots_select_all" on public.price_snapshots
  for select using (true);

-- Timestamps trigger
create trigger trg_shopping_lists_updated_at
  before update on public.shopping_lists
  for each row execute function public.handle_updated_at();

-- ─── Competitive Intelligence RPCs ───────────────────────────────

-- Get competitor prices for products in a store's catalog within a radius
create or replace function public.get_competitor_prices(
  p_store_id uuid,
  p_radius_km numeric default 5
)
returns table (
  product_id uuid,
  product_name text,
  my_price numeric,
  competitor_store_name text,
  competitor_price numeric,
  price_diff_percent numeric
)
language sql stable
as $$
  with my_promos as (
    select p.product_id, pr.name as product_name, p.promo_price as my_price
    from public.promotions p
    join public.products pr on pr.id = p.product_id
    where p.store_id = p_store_id
      and p.status = 'active'
      and p.end_date > now()
  ),
  my_store as (
    select latitude, longitude from public.stores where id = p_store_id
  ),
  nearby_stores as (
    select s.id, s.name
    from public.stores s, my_store ms
    where s.id != p_store_id
      and s.is_active = true
      and (
        6371 * acos(
          cos(radians(ms.latitude)) * cos(radians(s.latitude))
          * cos(radians(s.longitude) - radians(ms.longitude))
          + sin(radians(ms.latitude)) * sin(radians(s.latitude))
        )
      ) <= p_radius_km
  )
  select
    mp.product_id,
    mp.product_name,
    mp.my_price,
    ns.name as competitor_store_name,
    cp.promo_price as competitor_price,
    round(((mp.my_price - cp.promo_price) / mp.my_price * 100)::numeric, 1) as price_diff_percent
  from my_promos mp
  join public.promotions cp on cp.product_id = mp.product_id
    and cp.status = 'active'
    and cp.end_date > now()
  join nearby_stores ns on ns.id = cp.store_id
  order by price_diff_percent desc;
$$;

-- Get store ranking within radius
create or replace function public.get_store_rankings(
  p_store_id uuid,
  p_radius_km numeric default 5
)
returns table (
  store_id uuid,
  store_name text,
  active_promotions bigint,
  avg_discount numeric,
  rank bigint
)
language sql stable
as $$
  with my_store as (
    select latitude, longitude from public.stores where id = p_store_id
  ),
  area_stores as (
    select s.id, s.name
    from public.stores s, my_store ms
    where s.is_active = true
      and (
        6371 * acos(
          cos(radians(ms.latitude)) * cos(radians(s.latitude))
          * cos(radians(s.longitude) - radians(ms.longitude))
          + sin(radians(ms.latitude)) * sin(radians(s.latitude))
        )
      ) <= p_radius_km
  ),
  store_metrics as (
    select
      ast.id as store_id,
      ast.name as store_name,
      count(p.id) as active_promotions,
      coalesce(
        round(avg(((p.original_price - p.promo_price) / nullif(p.original_price, 0)) * 100)::numeric, 1),
        0
      ) as avg_discount
    from area_stores ast
    left join public.promotions p on p.store_id = ast.id
      and p.status = 'active'
      and p.end_date > now()
    group by ast.id, ast.name
  )
  select
    sm.store_id,
    sm.store_name,
    sm.active_promotions,
    sm.avg_discount,
    row_number() over (order by sm.active_promotions desc, sm.avg_discount desc) as rank
  from store_metrics sm
  order by rank;
$$;
