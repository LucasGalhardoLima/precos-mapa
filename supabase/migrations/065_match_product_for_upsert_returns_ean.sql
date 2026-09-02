-- supabase/migrations/065_match_product_for_upsert_returns_ean.sql
--
-- Purely additive: return each candidate's own `ean` alongside the existing
-- columns, so callers can hard-reject a fuzzy match whose EAN differs from
-- the query's — the gap that caused migration 064's data loss (two
-- different-EAN wines from the same brand+size family both fuzzy-matched
-- the same product). No WHERE/scoring change; see product-match.ts's new
-- isEanCompatible() for the actual gate, applied the same way
-- isBrandCompatible() already gates brand.

-- Postgres refuses CREATE OR REPLACE when the RETURNS TABLE shape changes
-- (adding the `ean` column counts as a shape change), so drop first.
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
  ean         text,
  match_type  text,
  match_score real,
  confidence  real
)
language sql stable security definer set search_path = 'public'
as $$
  select * from (
    -- Priority 1: synonym → confidence 1.0
    (
      select
        p.id           as id,
        p.name         as name,
        p.brand        as brand,
        p.ean          as ean,
        'synonym'::text as match_type,
        1.0::real      as match_score,
        1.0::real      as confidence
      from product_synonyms ps
      join products p on p.id = ps.product_id
      where lower(trim(ps.term)) = lower(trim(query))
      limit 1
    )
    union all
    -- Priority 2: fuzzy candidates with composite confidence (unchanged
    -- formula/scale/ordering — only the extra `ean` column is new)
    (
      select
        p.id           as id,
        p.name         as name,
        p.brand        as brand,
        p.ean          as ean,
        'fuzzy'::text  as match_type,
        similarity(p.name, query)::real as match_score,
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
        )::real as confidence
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
      order by (p.ean is not null) desc, 6 desc, 5 desc
      limit 5
    )
  ) results
  order by
    (select (p2.ean is not null) from products p2 where p2.id = results.id) desc,
    results.confidence desc,
    results.match_score desc;
$$;

notify pgrst, 'reload schema';
