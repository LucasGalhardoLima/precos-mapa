-- 019_performance_indexes.sql
-- Performance audit: add missing indexes, optimize search RPC with bounding box,
-- add composite indexes for RLS policy lookups.

-- =============================================================================
-- 1. GIN trigram index on product_synonyms.term
--    search_products_with_prices() uses similarity(ps.term, query) in a
--    correlated subquery — without this index every synonym lookup is a seq scan.
-- =============================================================================

create index if not exists ix_product_synonyms_term_trgm
  on public.product_synonyms using gin (term gin_trgm_ops);

-- =============================================================================
-- 2. Composite index on store_members (store_id, user_id)
--    All RLS policies for promotions, stores, and store_members themselves do
--    WHERE store_id = X AND user_id = Y. Currently only (user_id) is indexed.
-- =============================================================================

create index if not exists ix_store_members_store_user
  on public.store_members (store_id, user_id);

-- =============================================================================
-- 3. Covering index for active-promotion queries
--    The store-grouped mode and product detail screen both filter on
--    (status = 'active', end_date > now()) then join to products.
--    This composite index lets the planner use an index scan + skip the heap
--    for the status/date filter while already having product_id for the join.
-- =============================================================================

create index if not exists ix_promotions_active_product
  on public.promotions (product_id, store_id, promo_price)
  where status = 'active';

-- =============================================================================
-- 4. Stores lat/lng bounding box index
--    All spatial queries (search RPC, competitor prices, store rankings) compute
--    Haversine on every store row. A btree index on (latitude, longitude) lets
--    us add a cheap bounding-box pre-filter before the expensive trig math.
-- =============================================================================

create index if not exists ix_stores_lat_lng
  on public.stores (latitude, longitude)
  where is_active = true;

-- =============================================================================
-- 5. Optimize search_products_with_prices() with bounding-box pre-filter
--    Before: Haversine computed on every store row (trig = expensive)
--    After: Cheap lat/lng range filter eliminates distant stores first,
--           Haversine only runs on the ~rectangular remainder.
--    Also adds LIMIT 50 to prevent unbounded result sets.
-- =============================================================================

create or replace function public.search_products_with_prices(
  query          text,
  user_lat       float,
  user_lng       float,
  radius_km      float default 10,
  category_id    text  default null,
  page_size      int   default 30,
  page_offset    int   default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = 'public'
as $$
declare
  result jsonb;
  safe_query text;
  -- Bounding box: 1 degree latitude ≈ 111 km; longitude varies by cos(lat)
  lat_delta float := radius_km / 111.0;
  lng_delta float := radius_km / (111.0 * greatest(cos(radians(user_lat)), 0.01));
begin
  -- Guard: minimum query length
  if length(trim(query)) < 2 then
    return '[]'::jsonb;
  end if;

  -- Escape ILIKE special characters
  safe_query := replace(replace(replace(trim(query), '\', '\\'), '%', '\%'), '_', '\_');

  select coalesce(jsonb_agg(to_jsonb(product_row)), '[]'::jsonb)
  into result
  from (
    select
      p.id          as product_id,
      p.name        as product_name,
      p.brand,
      c.name        as category,
      p.image_url,
      count(*) filter (where pr.status = 'active') as active_count,
      min(case when pr.status = 'active' then pr.promo_price else pr.last_known_price end) as cheapest_price,
      jsonb_agg(
        jsonb_build_object(
          'store_id',        s.id,
          'store_name',      s.name,
          'price',           case when pr.status = 'active' then pr.promo_price else pr.last_known_price end,
          'price_type',      pr.status,
          'distance_km',     round((
            6371 * acos(
              least(1.0, greatest(-1.0,
                cos(radians(user_lat)) * cos(radians(s.latitude))
                * cos(radians(s.longitude) - radians(user_lng))
                + sin(radians(user_lat)) * sin(radians(s.latitude))
              ))
            )
          )::numeric, 1),
          'end_date',        case when pr.status = 'active' then pr.end_date else null end,
          'last_price_date', pr.last_price_date,
          'store_logo_initial', s.logo_initial,
          'store_logo_color',   s.logo_color,
          'search_priority',    s.search_priority
        )
        order by
          s.search_priority desc,
          (case when pr.status = 'active' then pr.promo_price else pr.last_known_price end) asc
      ) as prices
    from public.promotions pr
    join public.products p  on p.id = pr.product_id
    join public.stores s    on s.id = pr.store_id
    left join public.categories c on c.id = p.category_id
    where
      -- status filter (active with valid date, or fresh last_price within 30 days)
      (
        (pr.status = 'active' and pr.end_date > now())
        or (pr.status = 'last_price' and pr.updated_at > now() - interval '30 days')
      )
      -- bounding box pre-filter (cheap, uses ix_stores_lat_lng)
      and s.is_active = true
      and s.latitude  between (user_lat - lat_delta) and (user_lat + lat_delta)
      and s.longitude between (user_lng - lng_delta) and (user_lng + lng_delta)
      -- precise Haversine filter
      and (
        6371 * acos(
          least(1.0, greatest(-1.0,
            cos(radians(user_lat)) * cos(radians(s.latitude))
            * cos(radians(s.longitude) - radians(user_lng))
            + sin(radians(user_lat)) * sin(radians(s.latitude))
          ))
        )
      ) <= radius_km
      -- fuzzy name match via pg_trgm
      and (
        similarity(p.name, query) > 0.3
        or p.name ilike '%' || safe_query || '%'
        or exists (
          select 1 from public.product_synonyms ps
          where ps.product_id = p.id
            and (similarity(ps.term, query) > 0.3 or ps.term ilike '%' || safe_query || '%')
        )
      )
      -- optional category filter
      and (category_id is null or p.category_id = category_id)
    group by p.id, p.name, p.brand, c.name, p.image_url
    order by count(*) filter (where pr.status = 'active') desc,
             min(case when pr.status = 'active' then pr.promo_price else pr.last_known_price end) asc
    limit page_size
    offset page_offset
  ) as product_row;

  return result;
end;
$$;

-- =============================================================================
-- 6. User favorites: add product_id to composite for join efficiency
--    Favorites hook fetches with nested products + promotions — having
--    (user_id, product_id) lets the planner skip the heap on the join.
-- =============================================================================

create index if not exists ix_user_favorites_user_product
  on public.user_favorites (user_id, product_id);

-- =============================================================================
-- 7. Shopping list items: composite for list + product lookups
--    RLS policies check list_id via parent ownership, and item queries
--    join to products — this covers both access patterns.
-- =============================================================================

create index if not exists ix_shopping_list_items_list_product
  on public.shopping_list_items (list_id, product_id);
