-- 037_match_product_returns_brand.sql
-- Add `brand` to the result tuple returned by match_product_for_upsert so the
-- TS caller can implement brand-strict policies (reject candidates whose brand
-- conflicts with the query's brand) without an extra round-trip to fetch each
-- candidate's brand from products.
--
-- Surfaced by the PDF-import false positive where two distinct brooms
--   query: "Vassoura Phenix Santa Maria"  (brand="Phenix")
--   candidate: "Vassoura Santa Maria Premium Canto" (brand=null)
-- were merged into a single catalog entry. With brand returned here, the TS
-- layer can reject candidates whose non-null brand differs from the query's.
--
-- Postgres disallows CREATE OR REPLACE that changes the RETURN type, so we
-- drop and recreate. No other code calls this RPC, so the rename is safe.

drop function if exists public.match_product_for_upsert(text, text, text, text);

create function public.match_product_for_upsert(
  query             text,
  query_brand       text default null,
  query_category_id text default null,
  query_size_token  text default null
)
returns table (
  id          uuid,
  name        text,
  brand       text,
  match_type  text,
  match_score real,
  confidence  real
)
language sql stable security definer set search_path = 'public'
as $$
  -- Priority 1: synonym → confidence 1.0
  (
    select
      p.id,
      p.name,
      p.brand,
      'synonym'::text,
      1.0::real,
      1.0::real
    from product_synonyms ps
    join products p on p.id = ps.product_id
    where lower(trim(ps.term)) = lower(trim(query))
    limit 1
  )
  union all
  -- Priority 2: fuzzy candidates with composite confidence
  (
    select
      p.id,
      p.name,
      p.brand,
      'fuzzy'::text,
      similarity(p.name, query)::real,
      (
        (similarity(p.name, query) * 0.5)
        + (case
            when query_brand is null or p.brand is null then 0.5
            when lower(trim(p.brand)) = lower(trim(query_brand)) then 1.0
            else 0.0
          end * 0.25)
        + (case
            when query_size_token is null or extract_size_token(p.name) is null then 0.5
            when query_size_token = extract_size_token(p.name) then 1.0
            else 0.0
          end * 0.15)
        + (case
            when query_category_id is null or p.category_id is null then 0.5
            when p.category_id = query_category_id then 1.0
            else 0.0
          end * 0.10)
      )::real
    from products p
    where similarity(p.name, query) > (
      case
        when query_brand is not null
          and p.brand is not null
          and lower(trim(p.brand)) = lower(trim(query_brand))
        then 0.4
        else 0.55
      end
    )
    order by 6 desc, 5 desc
    limit 5
  )
  order by 6 desc, 5 desc;
$$;

notify pgrst, 'reload schema';
