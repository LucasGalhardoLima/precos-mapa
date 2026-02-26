-- Ensure PostgREST can expose price intelligence tables via the API.
-- Required because 004_price_intelligence.sql may have been applied without
-- default privilege grants for anon/authenticated/service_role.

GRANT SELECT, INSERT, UPDATE, DELETE ON public.price_indices TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.price_index_categories TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.price_index_products TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.price_quality_flags TO anon, authenticated, service_role;

-- Reload PostgREST schema cache so tables become visible
NOTIFY pgrst, 'reload schema';
