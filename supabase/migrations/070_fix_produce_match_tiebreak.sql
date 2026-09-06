-- supabase/migrations/070_fix_produce_match_tiebreak.sql
--
-- find_produce_exact_match (069) ordered ties only by (ean IS NOT NULL) and
-- created_at — several pre-existing candidates commonly share the exact
-- same created_at (bulk-seeded rows, same microsecond), so the ordering
-- among them wasn't guaranteed stable across calls. A different scraper run
-- could then "win" a different candidate each time and scatter
-- store_prices across several products instead of consolidating them onto
-- one — the same fragmentation this whole feature exists to fix. Adding
-- `id` as a final tiebreak makes the pick deterministic.

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
  ORDER BY (p.ean IS NOT NULL) DESC, p.created_at ASC, p.id ASC
  LIMIT 5;
$$;

NOTIFY pgrst, 'reload schema';
