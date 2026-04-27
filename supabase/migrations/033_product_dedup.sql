-- supabase/migrations/033_product_dedup.sql
--
-- Product deduplication: merges legacy name-only products into EAN-keyed catalog entries.
--
-- HOW TO USE:
-- 1. Run the DRY RUN query below in the Supabase SQL editor. Review every row.
-- 2. If any match looks wrong (different product), note the legacy_id.
-- 3. Add those IDs to the exclusion list in the MERGE TRANSACTION below.
-- 4. Run the MERGE TRANSACTION section.
--
-- IMPORTANT: Take a pg_dump backup before running the merge transaction.
-- Command: pg_dump "<DB_URL>" --no-acl --no-owner -f backup_before_dedup_$(date +%Y%m%d).sql

-- =============================================================================
-- SECTION 1: DRY RUN — preview merges (SELECT only, no changes)
-- =============================================================================

-- Run this first. Review every row before running Section 2.

/*
WITH cosmos AS (
  SELECT id, name, brand, ean
  FROM products
  WHERE ean IS NOT NULL
),
legacy AS (
  SELECT
    p.id,
    p.name,
    p.brand,
    count(pr.id) AS promo_count
  FROM products p
  LEFT JOIN promotions pr ON pr.product_id = p.id
  WHERE p.ean IS NULL
  GROUP BY p.id, p.name, p.brand
),
matches AS (
  SELECT
    c.id            AS canonical_id,
    c.name          AS canonical_name,
    c.ean,
    l.id            AS legacy_id,
    l.name          AS legacy_name,
    l.promo_count,
    similarity(c.name, l.name) AS name_sim
  FROM cosmos c
  JOIN legacy l
    ON similarity(c.name, l.name) > 0.55
    AND (
      c.brand IS NULL
      OR l.brand IS NULL
      OR similarity(c.brand, l.brand) > 0.6
    )
)
SELECT *
FROM matches
ORDER BY name_sim DESC;
*/

-- =============================================================================
-- SECTION 2: MERGE TRANSACTION
-- =============================================================================
-- Run ONLY after reviewing dry run output.
-- Add wrong-match legacy IDs to the exclusion list below.

/*
BEGIN;

WITH cosmos AS (
  SELECT id, name, brand, ean FROM products WHERE ean IS NOT NULL
),
legacy AS (
  SELECT id, name, brand FROM products WHERE ean IS NULL
),
matches AS (
  SELECT
    c.id AS canonical_id,
    l.id AS legacy_id,
    similarity(c.name, l.name) AS name_sim
  FROM cosmos c
  JOIN legacy l
    ON similarity(c.name, l.name) > 0.55
    AND (
      c.brand IS NULL
      OR l.brand IS NULL
      OR similarity(c.brand, l.brand) > 0.6
    )
  -- Add IDs of wrong matches identified in dry run review:
  -- WHERE l.id NOT IN (
  --   'uuid-of-wrong-match-1',
  --   'uuid-of-wrong-match-2'
  -- )
),
best_match AS (
  SELECT DISTINCT ON (legacy_id) canonical_id, legacy_id
  FROM matches
  ORDER BY legacy_id, name_sim DESC
)
-- 1. Reassign promotions
UPDATE promotions pr
SET product_id = bm.canonical_id
FROM best_match bm
WHERE pr.product_id = bm.legacy_id;

-- 2. Reassign favorites (if table exists)
UPDATE favorites f
SET product_id = bm.canonical_id
FROM best_match bm
WHERE f.product_id = bm.legacy_id;

-- 3. Reassign price_alerts (if table exists)
UPDATE price_alerts pa
SET product_id = bm.canonical_id
FROM best_match bm
WHERE pa.product_id = bm.legacy_id;

-- 4. Reassign store_prices
UPDATE store_prices sp
SET product_id = bm.canonical_id
FROM best_match bm
WHERE sp.product_id = bm.legacy_id;

-- 5. Delete merged legacy products
DELETE FROM products p
USING best_match bm
WHERE p.id = bm.legacy_id;

COMMIT;
*/

-- =============================================================================
-- SECTION 3: VERIFICATION QUERY
-- =============================================================================
-- Run after the merge transaction to confirm no duplicates remain.

/*
SELECT p1.name, p2.name, similarity(p1.name, p2.name) AS sim
FROM products p1
JOIN products p2 ON p1.id < p2.id
WHERE p1.ean IS NOT NULL
  AND p2.ean IS NULL
  AND similarity(p1.name, p2.name) > 0.55
ORDER BY sim DESC;
-- Should return 0 rows
*/
