-- get_trending_products: returns top N products ranked by active promotion
-- count and discount percentage. Used by the search discovery screen.

create or replace function public.get_trending_products(
  result_limit int default 3
)
returns table (
  id            uuid,
  name          text,
  min_price     numeric,
  max_price     numeric,
  store_count   bigint,
  discount_pct  integer
)
language plpgsql
stable
security definer
set search_path = 'public'
as $$
begin
  return query
  select
    p.id,
    p.name,
    min(pr.promo_price)          as min_price,
    max(pr.promo_price)          as max_price,
    count(distinct pr.store_id)  as store_count,
    round(
      (1 - min(pr.promo_price)::numeric / nullif(p.reference_price, 0)) * 100
    )::integer                   as discount_pct
  from public.promotions pr
  join public.products p on p.id = pr.product_id
  where pr.status = 'active'
    and pr.end_date > now()
  group by p.id, p.name, p.reference_price
  having count(distinct pr.store_id) >= 1
  order by
    count(distinct pr.store_id) desc,
    round((1 - min(pr.promo_price)::numeric / nullif(p.reference_price, 0)) * 100) desc
  limit result_limit;
end;
$$;
