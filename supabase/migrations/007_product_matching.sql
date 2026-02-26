-- match_product_for_upsert: Fuzzy product matching for find-or-create flows
-- Returns synonym matches first (score 1.0), then up to 5 fuzzy candidates (threshold 0.55)
-- App code applies size-token guard to pick the right match

create or replace function public.match_product_for_upsert(query text)
returns table (id uuid, name text, match_type text, match_score real)
language sql stable security definer set search_path = 'public'
as $$
  -- Priority 1: Exact synonym match (case-insensitive) → score 1.0
  (
    select p.id, p.name, 'synonym'::text as match_type, 1.0::real as match_score
    from product_synonyms ps
    join products p on p.id = ps.product_id
    where lower(trim(ps.term)) = lower(trim(query))
    limit 1
  )
  union all
  -- Priority 2: Top 5 fuzzy candidates (threshold 0.55)
  (
    select p.id, p.name, 'fuzzy'::text as match_type, similarity(p.name, query) as match_score
    from products p
    where similarity(p.name, query) > 0.55
    order by similarity(p.name, query) desc
    limit 5
  )
  order by match_score desc;
$$;
