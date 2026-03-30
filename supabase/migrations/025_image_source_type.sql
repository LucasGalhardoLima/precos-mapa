-- 025_image_source_type.sql
-- Extend store_pdf_sources to support image-based offer sources.
--
-- Adds:
--   source_type  — 'pdf' (default) or 'image'
--   render_config — headless browser settings (selectors, steps, timeout)
--
-- Also creates the image-imports storage bucket and activates Tenda Atacado.

-- ==========================================================================
-- 1. Add source_type column
-- ==========================================================================

alter table public.store_pdf_sources
  add column if not exists source_type text not null default 'pdf';

-- Add CHECK constraint separately so existing rows pass validation
alter table public.store_pdf_sources
  drop constraint if exists store_pdf_sources_source_type_check;

alter table public.store_pdf_sources
  add constraint store_pdf_sources_source_type_check
    check (source_type in ('pdf', 'image'));

-- ==========================================================================
-- 2. Add render_config column (headless browser settings for image sources)
-- ==========================================================================

alter table public.store_pdf_sources
  add column if not exists render_config jsonb;

comment on column public.store_pdf_sources.render_config is
  'Headless browser config for image sources: { steps: [{action, selector, value?}], imageSelector, timeout }';

-- ==========================================================================
-- 3. Update Tenda Atacado source: set source_type=image, activate, add config
-- ==========================================================================

update public.store_pdf_sources
set source_type = 'image',
    is_active = true,
    render_config = '{
      "steps": [
        {"action": "waitForSelector", "selector": ".city-selector, [data-city], .store-list, .loja-item"},
        {"action": "click", "selector": "text=Matão"},
        {"action": "waitForNetworkIdle", "timeout": 5000}
      ],
      "imageSelector": "img[src*=\"oferta\"], img[src*=\"encarte\"], img[src*=\"promo\"], .offer-images img, .ofertas img, main img[src*=\".jpg\"], main img[src*=\".png\"], main img[src*=\".webp\"]",
      "minImageWidth": 300,
      "timeout": 30000
    }'::jsonb
where label = 'Tenda Atacado Matao - Ofertas';

-- ==========================================================================
-- 4. Create image-imports storage bucket (idempotent)
-- ==========================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'image-imports',
  'image-imports',
  false,
  10485760,  -- 10 MB
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do nothing;

notify pgrst, 'reload schema';
