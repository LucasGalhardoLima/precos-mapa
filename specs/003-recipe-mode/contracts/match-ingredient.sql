-- Contract: match_ingredient RPC
-- Migration: 040_recipe_mode.sql
-- Called client-side once per ingredient (in parallel) to find catalog product candidates.
-- Extends the existing search_products / match_product_for_upsert pattern.

CREATE OR REPLACE FUNCTION match_ingredient(query text)
RETURNS TABLE (
  product_id      uuid,
  name            text,
  brand           text,
  ean             text,
  reference_price numeric,
  similarity_score numeric
)
LANGUAGE sql STABLE
AS $$
  -- Priority 1: Exact synonym match (score 1.0)
  SELECT
    p.id            AS product_id,
    p.name,
    p.brand,
    p.ean,
    p.reference_price,
    1.0::numeric    AS similarity_score
  FROM product_synonyms ps
  JOIN products p ON p.id = ps.product_id
  WHERE lower(ps.term) = lower(query)

  UNION ALL

  -- Priority 2: Trigram + ilike fuzzy match on product name
  SELECT
    p.id            AS product_id,
    p.name,
    p.brand,
    p.ean,
    p.reference_price,
    GREATEST(
      similarity(p.name, query),
      similarity(p.name, query)  -- placeholder; real impl uses word_similarity too
    )::numeric      AS similarity_score
  FROM products p
  WHERE
    similarity(p.name, query) > 0.3
    OR p.name ILIKE '%' || replace(replace(replace(query, '\', '\\'), '%', '\%'), '_', '\_') || '%'

  ORDER BY similarity_score DESC
  LIMIT 3;
$$;

-- Usage example (from client):
-- SELECT * FROM match_ingredient('feijão preto');
-- Returns up to 3 rows, ordered by similarity_score DESC.
-- Client auto-selects row 1 if similarity_score >= 0.5; otherwise marks as 'unmatched' for user review.
