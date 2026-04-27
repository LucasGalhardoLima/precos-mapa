-- supabase/migrations/031_search_rpc_catalog.sql

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
  if length(trim(query)) < 2 then
    return '[]'::jsonb;
  end if;

  safe_query := replace(replace(replace(trim(query), '\', '\\'), '%', '\%'), '_', '\_');

  select coalesce(jsonb_agg(to_jsonb(product_row)), '[]'::jsonb)
  into result
  from (
    select
      p.id              as product_id,
      p.name            as product_name,
      p.brand,
      c.name            as category,
      p.image_url,
      p.reference_price,
      -- true when at least one active (non-expired) promotion exists within radius
      (count(*) filter (
        where pr.status = 'active' and pr.end_date > now()
      ) > 0)            as has_active_price,
      count(*) filter (where pr.status = 'active') as active_count,
      min(case when pr.status = 'active' then pr.promo_price else pr.last_known_price end) as cheapest_price,
      jsonb_agg(
        jsonb_build_object(
          'store_id',           s.id,
          'store_name',         s.name,
          'price',              case when pr.status = 'active' then pr.promo_price else pr.last_known_price end,
          'original_price',     pr.original_price,
          'price_type',         pr.status,
          'distance_km',        round((
            6371 * acos(
              least(1.0, greatest(-1.0,
                cos(radians(user_lat)) * cos(radians(s.latitude))
                * cos(radians(s.longitude) - radians(user_lng))
                + sin(radians(user_lat)) * sin(radians(s.latitude))
              ))
            )
          )::numeric, 1),
          'end_date',           case when pr.status = 'active' then pr.end_date else null end,
          'last_price_date',    pr.last_price_date,
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
      -- active (with valid date) OR last_price (indefinitely — 30-day window removed)
      (
        (pr.status = 'active' and pr.end_date > now())
        or pr.status = 'last_price'
      )
      and s.is_active = true
      and (
        6371 * acos(
          least(1.0, greatest(-1.0,
            cos(radians(user_lat)) * cos(radians(s.latitude))
            * cos(radians(s.longitude) - radians(user_lng))
            + sin(radians(user_lat)) * sin(radians(s.latitude))
          ))
        )
      ) <= radius_km
      and (
        similarity(p.name, query) > 0.3
        or p.name ilike '%' || safe_query || '%'
        or exists (
          select 1 from public.product_synonyms ps
          where ps.product_id = p.id
            and (similarity(ps.term, query) > 0.3 or ps.term ilike '%' || safe_query || '%')
        )
      )
      and (category_id is null or p.category_id = category_id)
    group by p.id, p.name, p.brand, c.name, p.image_url, p.reference_price
    order by
      count(*) filter (where pr.status = 'active') desc,
      min(case when pr.status = 'active' then pr.promo_price else pr.last_known_price end) asc
    limit page_size
    offset page_offset
  ) as product_row;

  return result;
end;
$$;
