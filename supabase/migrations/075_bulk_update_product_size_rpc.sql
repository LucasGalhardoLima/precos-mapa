-- supabase/migrations/075_bulk_update_product_size_rpc.sql
--
-- scripts/backfill-product-size.ts originally tried a bulk .upsert({id,
-- size_value, size_unit}, {onConflict: 'id'}) to write many rows in one
-- call. That fails on every row: PostgREST upsert compiles to
-- INSERT ... ON CONFLICT DO UPDATE, and Postgres validates the INSERT's
-- NOT NULL columns (name, category_id) against the proposed row BEFORE
-- conflict resolution ever kicks in — so a payload with only
-- {id, size_value, size_unit} can never upsert against a NOT NULL column
-- it doesn't include, no matter that the row already exists.
--
-- A real bulk UPDATE has no such requirement — this RPC takes a JSON array
-- and does one UPDATE ... FROM jsonb_array_elements(...) per batch instead
-- of one HTTP round trip per row. service_role only.

CREATE OR REPLACE FUNCTION public.bulk_update_product_size(updates jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  UPDATE public.products p
  SET size_value = (u->>'size_value')::numeric,
      size_unit  = u->>'size_unit'
  FROM jsonb_array_elements(updates) AS u
  WHERE p.id = (u->>'id')::uuid;
END;
$$;

COMMENT ON FUNCTION public.bulk_update_product_size(jsonb) IS
  'Bulk-updates products.size_value/size_unit from a JSON array of {id, size_value, size_unit}. service_role only — used by scripts/backfill-product-size.ts.';

REVOKE ALL ON FUNCTION public.bulk_update_product_size(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bulk_update_product_size(jsonb) TO service_role;
