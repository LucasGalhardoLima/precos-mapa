-- supabase/migrations/063_prefer_ean_products_in_matching.sql
--
-- When multiple candidates clear match_product_for_upsert's fuzzy-similarity
-- threshold, prefer whichever one already carries a real EAN/GTIN. A
-- catalog entry with a verified code is a better merge target than a
-- name-only one — the same reasoning used by hand in migration 062 to pick
-- which of 3 duplicate rows to keep as canonical (the one with a real EAN).
--
-- Deliberately reorders candidates WITHOUT changing the returned confidence
-- value itself: src/app/api/cron/process-single-pdf/route.ts:278 uses
-- `result.confidence < 0.7` to flag PDF-import matches for manual review,
-- and that threshold's meaning must stay exactly as before. Only the
-- ordering (which candidate a caller iterating in order picks first)
-- changes, at both the inner subquery's own limit 5 (so an EAN'd candidate
-- ranked outside the old top-5-by-confidence isn't clipped before the
-- outer reorder ever sees it) and the final result order.

create or replace function public.match_product_for_upsert(
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
  select * from (
    -- Priority 1: synonym → confidence 1.0
    (
      select
        p.id           as id,
        p.name         as name,
        p.brand        as brand,
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
    -- formula/scale — only the ordering below is new)
    (
      select
        p.id           as id,
        p.name         as name,
        p.brand        as brand,
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
