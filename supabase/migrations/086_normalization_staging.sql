-- Catalog normalization, phase C (docs/poup-prd-normalizacao-catalogo.md):
-- where the LLM pass (scripts/normalize-catalog-llm.ts) lands its proposals
-- before anything reaches `products`, and the RPC that lists the products the
-- pass works on. Nothing here writes to `products`.

create table public.product_normalization_staging (
  id            uuid primary key default gen_random_uuid(),
  run_id        text not null,
  product_id    uuid not null references public.products(id) on delete cascade,
  model         text not null,
  batch_id      text not null,
  -- The proposal. Null fields mean "the model said null or its answer failed
  -- validation" — never a guess. `invalid_reason` says which when a whole item
  -- was unusable (missing from the response, wrong shape, unknown category).
  category_l2   text references public.product_categories(id),
  brand_norm    text,
  base_name     text,
  size_value    numeric,
  size_unit     text check (size_unit in ('g', 'ml', 'un', 'm')),
  confidence    numeric check (confidence between 0 and 1),
  invalid_reason text,
  created_at    timestamptz not null default now(),
  unique (run_id, product_id)
);

-- Service-role only: RLS on with no policies denies anon/authenticated.
alter table public.product_normalization_staging enable row level security;
grant all on public.product_normalization_staging to service_role;

-- Fresh cohort = has a store_prices row updated in the last 14 days (the same
-- window the consumer RPCs use). One row per product; `markets` is the chains
-- with a fresh price. Ordered by id so callers can page with .range().
create or replace function public.normalization_fresh_products()
returns table (
  id uuid,
  name text,
  ean text,
  size_value numeric,
  size_unit text,
  category_l2 text,
  brand_norm text,
  base_name text,
  normalized_by text,
  markets text[]
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.name, p.ean, p.size_value, p.size_unit,
         p.category_l2, p.brand_norm, p.base_name, p.normalized_by,
         array_agg(distinct coalesce(s.chain, s.name) order by coalesce(s.chain, s.name)) as markets
  from products p
  join store_prices sp on sp.product_id = p.id and sp.updated_at > now() - interval '14 days'
  join stores s on s.id = sp.store_id
  group by p.id
  order by p.id
$$;

revoke all on function public.normalization_fresh_products() from public, anon, authenticated;
grant execute on function public.normalization_fresh_products() to service_role;
