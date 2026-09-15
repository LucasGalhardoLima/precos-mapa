-- supabase/migrations/074_product_size_columns.sql
--
-- Adds structured pack size to products, backfilled by a one-off regex
-- parser (src/lib/parse-product-size.ts, scripts/backfill-product-size.ts)
-- run against the existing catalog after this migration. Normalized to a
-- fixed base-unit set (g, ml, un, m) so different pack sizes/units are
-- directly comparable (e.g. price-per-unit) without every consumer having
-- to convert kg->g / L->ml itself.
--
-- Measured coverage on the full 48,302-row catalog before backfilling:
-- ~64% parseable with confidence from the name alone. The remaining ~36%
-- (missing unit, ambiguous abbreviation, no size in the name at all) is
-- deliberately left NULL here for a future LLM-based pass, not guessed at.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS size_value numeric(10,2),
  ADD COLUMN IF NOT EXISTS size_unit  text CHECK (size_unit IN ('g', 'ml', 'un', 'm'));

-- size_unit must be set whenever size_value is, and vice versa.
ALTER TABLE public.products
  ADD CONSTRAINT products_size_value_unit_together
  CHECK ((size_value IS NULL) = (size_unit IS NULL));

CREATE INDEX IF NOT EXISTS idx_products_size_unit ON public.products(size_unit) WHERE size_unit IS NOT NULL;
