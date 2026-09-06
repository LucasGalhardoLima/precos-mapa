-- supabase/migrations/069_produce_exact_match_rpc.sql
--
-- Fruits/vegetables scraped without an EAN get named inconsistently across
-- retailers ("Maçã Fuji" / "Maca Fuji" / "Maçã Fuji Unidade" / "Maçã Fujii
-- Nacional") — same real generic item, different spelling. Confirmed live
-- that match_product_for_upsert's trigram similarity() doesn't bridge this:
-- querying "Maçã Fuji" never returns "Maca Fuji" as a candidate at all (the
-- accent difference alone drops it below the RPC's 0.55 threshold, or at
-- least out of its top-5), so no amount of loosening the comparison in
-- product-match.ts would help — the candidate never arrives there.
--
-- This adds a narrow, separate exact-match lookup scoped to cat_hortifruti
-- only: accent-insensitive (via unaccent) and stripping a small set of pure
-- packaging/origin filler words that don't carry price-relevant info on
-- their own. Deliberately NOT a fuzzy/similarity match and NOT touching
-- match_product_for_upsert — real size tokens (e.g. "600g", "Bandeja") are
-- left untouched so "Maçã Fuji Bandeja 600g" still doesn't merge with the
-- generic "Maçã Fuji". Scoped to hortifruti specifically because that's
-- where genuine flavor-variant risk (the failure mode migrations 064/066/
-- 067 fixed) doesn't really exist — an apple is an apple, unlike pizzas or
-- wine flavors.

CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE OR REPLACE FUNCTION public.normalize_produce_name(raw text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT trim(regexp_replace(
    regexp_replace(
      unaccent(lower(trim(raw))),
      '\y(unidade|unidades|un|nacional|importada|importado)\y', '', 'g'
    ),
    '\s+', ' ', 'g'
  ));
$$;

CREATE OR REPLACE FUNCTION public.find_produce_exact_match(query_name text)
RETURNS TABLE (id uuid, name text, brand text, ean text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT p.id, p.name, p.brand, p.ean
  FROM public.products p
  WHERE p.category_id = 'cat_hortifruti'
    AND public.normalize_produce_name(p.name) = public.normalize_produce_name(query_name)
  ORDER BY (p.ean IS NOT NULL) DESC, p.created_at ASC
  LIMIT 5;
$$;

NOTIFY pgrst, 'reload schema';
