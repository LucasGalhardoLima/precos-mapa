-- Multi-store product search RPC: returns products grouped by product
-- with nested store prices (active + last_price), filtered by Haversine radius.
--
-- Used by the consumer search screen in "product-grouped" mode so users can
-- compare prices across stores for the same product.

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
      -- count of active prices (more data = more useful, used for ordering)
      count(*) filter (where pr.status = 'active') as active_count,
      -- cheapest price across all stores
      min(case when pr.status = 'active' then pr.promo_price else pr.last_known_price end) as cheapest_price,
      -- nested array of store prices
      jsonb_agg(
        jsonb_build_object(
          'store_id',        s.id,
          'store_name',      s.name,
          'price',           case when pr.status = 'active' then pr.promo_price else pr.last_known_price end,
          'original_price',  pr.original_price,
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
          -- paid stores first
          s.search_priority desc,
          -- then cheapest price
          (case when pr.status = 'active' then pr.promo_price else pr.last_known_price end) asc
      ) as prices
    from public.promotions pr
    join public.products p  on p.id = pr.product_id
    join public.stores s    on s.id = pr.store_id
    left join public.categories c on c.id = p.category_id
    where
      -- only visible promotions (active with valid date, or fresh last_price)
      (
        (pr.status = 'active' and pr.end_date > now())
        or (pr.status = 'last_price' and pr.updated_at > now() - interval '30 days')
      )
      -- store is active
      and s.is_active = true
      -- within radius (Haversine, clamped to prevent NaN)
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

-- Index to speed up the product name fuzzy search within this RPC
create index if not exists ix_promotions_status_active_last
  on public.promotions (product_id, store_id)
  where status in ('active', 'last_price');
