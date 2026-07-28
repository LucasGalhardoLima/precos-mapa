-- supabase/migrations/062_merge_fruit_shoot_duplicate_products.sql
--
-- One-off cleanup: 3 product rows existed for the same physical item
-- (Maguary "Fruit Shoot" 150ml juice box), found while reviewing a real
-- device test session:
--
--   1. 78c83e8d... "Bebida Mista Fruit Shoot Maguary 150ml" — Cosmos-seeded,
--      has a real EAN + image (ean=7896000597267, cosmos_synced_at set).
--   2. 50cecfcf... same name/brand, no EAN/image — a pre-existing duplicate
--      from the Cosmos seeder's own upsert: Phase 1 inserts with ean=null,
--      and `onConflict: 'ean'` can't dedupe two null-ean rows against each
--      other (Postgres treats NULL <> NULL in a unique index — the same gap
--      already known from price_reports' own unique_daily_report index).
--   3. 521185d5... "Suco Fruit Shoot 150ml" — created today by a real NFC-e
--      scan. Its receipt phrasing didn't clear match_product_for_upsert's
--      fuzzy-similarity threshold against row 1 (missing brand, different
--      word order), so findOrCreateProduct created a third row instead of
--      reusing it. See the find-or-create-product.ts synonym-learning fix
--      deployed alongside this migration, which prevents this specific
--      failure mode going forward.
--
-- Canonical: row 1, the only one with real EAN/image data. Every FK
-- reference from rows 2 and 3 gets repointed, except where doing so would
-- create an exact duplicate of a row the canonical already has (checked by
-- hand against live data before writing this) — those get dropped instead.

DO $$
DECLARE
  canonical_id  uuid := '78c83e8d-7126-4789-9270-364fdd43251d';
  dup_seeder_id uuid := '50cecfcf-eca2-44ed-bfd1-34bb5ceebfbf'; -- old Cosmos-seeder duplicate
  dup_today_id  uuid := '521185d5-75f9-4416-a32d-f36c8a464922'; -- created by today's Mode B test session
BEGIN
  -- store_prices: dup_seeder's row (Tenda Atacado) is an exact duplicate of
  -- the canonical's own row for that store — drop it. dup_today's row
  -- (Savegnago) has no equivalent on the canonical — repoint it.
  DELETE FROM public.store_prices WHERE product_id = dup_seeder_id;
  UPDATE public.store_prices SET product_id = canonical_id WHERE product_id = dup_today_id;

  -- promotions: same pattern (dup_seeder's Tenda Atacado row duplicates the
  -- canonical's; dup_today's Savegnago rows don't exist on the canonical).
  DELETE FROM public.promotions WHERE product_id = dup_seeder_id;
  UPDATE public.promotions SET product_id = canonical_id WHERE product_id = dup_today_id;

  -- price_snapshots: dup_seeder's two rows are exact duplicates of the
  -- canonical's own snapshots for the same dates — drop them. dup_today has
  -- no snapshot rows yet (created today, before the daily job ran).
  DELETE FROM public.price_snapshots WHERE product_id = dup_seeder_id;

  -- price_reports: no conflict risk — its dedup key is anonymous_id/ean/
  -- store_id/day, not product_id. Repoint everything from both duplicates.
  UPDATE public.price_reports SET product_id = canonical_id WHERE product_id IN (dup_seeder_id, dup_today_id);

  -- Now safe to remove both duplicate product rows.
  DELETE FROM public.products WHERE id IN (dup_seeder_id, dup_today_id);

  -- Learn today's receipt phrasing as a synonym so it matches the canonical
  -- product directly next time, same reasoning as the code fix.
  INSERT INTO public.product_synonyms (term, product_id)
  VALUES ('Suco Fruit Shoot 150ml', canonical_id)
  ON CONFLICT (term) DO NOTHING;
END $$;

NOTIFY pgrst, 'reload schema';
