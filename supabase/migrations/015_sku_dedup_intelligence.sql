-- 015_sku_dedup_intelligence.sql
-- Enhanced product matching with brand, size_token, category scoring.
-- Adds needs_review_reason to pdf_imports for confidence flagging.

-- =============================================================================
-- 1. Add needs_review_reason to pdf_imports for confidence flagging
-- =============================================================================
alter table public.pdf_imports
  add column if not exists needs_review_reason text;

-- =============================================================================
-- 2. Helper: extract size token from product name (e.g., "5kg", "350ml")
-- =============================================================================
create or replace function public.extract_size_token(product_name text)
returns text
language sql immutable
as $$
  select lower(
    (regexp_match(product_name, '(\d+(?:[.,]\d+)?)\s*(ml|l|g|kg|un|pct|pack)', 'i'))[1]
    || (regexp_match(product_name, '(\d+(?:[.,]\d+)?)\s*(ml|l|g|kg|un|pct|pack)', 'i'))[2]
  );
$$;

-- =============================================================================
-- 3. Enhanced match_product_for_upsert with composite confidence scoring
-- =============================================================================
create or replace function public.match_product_for_upsert(
  query text,
  query_brand text default null,
  query_category_id text default null,
  query_size_token text default null
)
returns table (
  id uuid,
  name text,
  match_type text,
  match_score real,
  confidence real
)
language sql stable security definer set search_path = 'public'
as $$
  -- Priority 1: Exact synonym match → confidence 1.0
  (
    select
      p.id,
      p.name,
      'synonym'::text as match_type,
      1.0::real as match_score,
      1.0::real as confidence
    from product_synonyms ps
    join products p on p.id = ps.product_id
    where lower(trim(ps.term)) = lower(trim(query))
    limit 1
  )
  union all
  -- Priority 2: Fuzzy candidates with composite confidence score
  (
    select
      p.id,
      p.name,
      'fuzzy'::text as match_type,
      similarity(p.name, query) as match_score,
      -- Composite confidence: weighted average of dimensions
      (
        -- Name similarity: 50% weight
        (similarity(p.name, query) * 0.5)
        -- Brand match: 25% weight (1.0 if both match, 0.5 if either is null, 0.0 if mismatch)
        + (case
            when query_brand is null or p.brand is null then 0.5
            when lower(trim(p.brand)) = lower(trim(query_brand)) then 1.0
            else 0.0
          end * 0.25)
        -- Size match: 15% weight
        + (case
            when query_size_token is null or extract_size_token(p.name) is null then 0.5
            when query_size_token = extract_size_token(p.name) then 1.0
            else 0.0
          end * 0.15)
        -- Category match: 10% weight
        + (case
            when query_category_id is null or p.category_id is null then 0.5
            when p.category_id = query_category_id then 1.0
            else 0.0
          end * 0.10)
      )::real as confidence
    from products p
    where
      -- Lower the fuzzy threshold when brand matches
      similarity(p.name, query) > (
        case
          when query_brand is not null
            and p.brand is not null
            and lower(trim(p.brand)) = lower(trim(query_brand))
          then 0.4
          else 0.55
        end
      )
    order by confidence desc, similarity(p.name, query) desc
    limit 5
  )
  order by confidence desc, match_score desc;
$$;

-- =============================================================================
-- 4. Index to speed up brand-based lookups
-- =============================================================================
create index if not exists ix_products_brand on public.products (lower(brand))
  where brand is not null;

create index if not exists ix_products_category_id on public.products (category_id);

notify pgrst, 'reload schema';
