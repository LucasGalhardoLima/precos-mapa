-- 026_reactivate_mortari_image_import.sql
-- Reactivate Supermercado Mortari for semi-automated image extraction.
--
-- Context: Mortari was deactivated in 023 because it had no PDF infrastructure.
-- Now we support image-based imports via /api/extract (GPT-4o Vision).
-- Admin pastes a Facebook/Instagram image URL → extract → review → publish.
--
-- Changes:
--   1. Set is_active = true for Mortari
--   2. Add a store_pdf_sources record with source_type='image' (manual marker)

-- ==========================================================================
-- 1. Reactivate Mortari store
-- ==========================================================================

update public.stores
set is_active = true,
    updated_at = now()
where lower(name) like '%mortari%'
  and is_active = false;

-- ==========================================================================
-- 2. Add manual image source marker (no automated crawl)
-- ==========================================================================
-- is_active = false on the source because there's no automated crawler for
-- Facebook/Instagram images. This record is a marker so the admin panel
-- knows Mortari uses image-based imports.

insert into public.store_pdf_sources (
  id, store_id, url, label, source_type, is_active
)
select
  gen_random_uuid(),
  s.id,
  'https://www.facebook.com/supmercadomortari/',
  'Mortari Matao - Facebook (manual)',
  'image',
  false  -- no automated crawl, admin pastes URLs manually
from public.stores s
where lower(s.name) like '%mortari%'
  and not exists (
    select 1 from public.store_pdf_sources ps
    where ps.store_id = s.id
      and ps.source_type = 'image'
  );

notify pgrst, 'reload schema';
