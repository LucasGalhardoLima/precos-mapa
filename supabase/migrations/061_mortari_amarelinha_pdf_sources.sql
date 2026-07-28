-- supabase/migrations/061_mortari_amarelinha_pdf_sources.sql
--
-- Adds automated PDF-import sources for two retailers that already publish
-- plain, discoverable PDF links on their own websites, plus manual markers
-- for three Instagram-only retailers that genuinely can't be automated
-- (confirmed: headless-browser access to Instagram profile pages is
-- blocked by Meta's bot detection — same reasoning as Mortari's old
-- Facebook marker from migration 026).

-- =============================================================================
-- 1. Mortari — fix stale source config
-- =============================================================================
-- Migration 026 marked Mortari as Facebook-only (source_type='image',
-- is_active=false) because it had no PDF infrastructure at the time. It now
-- publishes a static "CLIQUE AQUI PARA VER AS OFERTAS" PDF link on
-- /ofertas/, replaced every 5-6 days — exactly what the existing PDF-link
-- discovery scraper already handles for other 'pdf' sources.

UPDATE public.store_pdf_sources
SET url          = 'https://supermercadomortari.com.br/ofertas/',
    label        = 'Mortari Matão - Ofertas (PDF)',
    source_type  = 'pdf',
    is_active    = true,
    render_config = null,
    updated_at   = now()
WHERE store_id = (SELECT id FROM public.stores WHERE lower(name) LIKE '%mortari%' LIMIT 1)
  AND source_type = 'image';

-- =============================================================================
-- 2. Amarelinha — 3 new Matão stores (Loja 15/7162, 16, 17)
-- =============================================================================
-- Only "Amarelinha Loja 18" and "Loja 21" existed before this. Address/
-- phone/hours scraped directly from each store's page at
-- grupoamarelinha.com.br/nossas_lojas/{slug}. Coordinates geocoded via
-- OpenStreetMap Nominatim — street-level for Loja 15/16; Loja 17's street
-- wasn't in OSM at all, so its coordinate is postal-code-level (still
-- correctly within the right neighborhood, per ViaCEP confirming the CEP).

INSERT INTO public.stores (
  name, chain, address, city, state,
  latitude, longitude, phone,
  logo_initial, logo_color,
  b2b_plan, search_priority, is_active, opening_hours
) VALUES
  (
    'Amarelinha Loja 15', 'Amarelinha Supermercados',
    'R. Acre, 123 - Jardim do Bosque, Matão - SP, 15910-000',
    'Matão', 'SP',
    -21.5971478, -48.3482303, '(16) 3382-1152',
    'A', '#F59E0B',
    'free', 0, true,
    '{"0":{"open":"07:00","close":"14:00"},"1":{"open":"07:00","close":"21:00"},"2":{"open":"07:00","close":"21:00"},"3":{"open":"07:00","close":"21:00"},"4":{"open":"07:00","close":"21:00"},"5":{"open":"07:00","close":"21:00"},"6":{"open":"07:00","close":"21:00"}}'::jsonb
  ),
  (
    'Amarelinha Loja 16', 'Amarelinha Supermercados',
    'Av. Trolesi, 3400 - Jardim Buscardi, Matão - SP, 15990-540',
    'Matão', 'SP',
    -21.6082905, -48.3501963, '(16) 3382-6822',
    'A', '#F59E0B',
    'free', 0, true,
    '{"0":{"open":"07:00","close":"14:00"},"1":{"open":"07:00","close":"21:00"},"2":{"open":"07:00","close":"21:00"},"3":{"open":"07:00","close":"21:00"},"4":{"open":"07:00","close":"21:00"},"5":{"open":"07:00","close":"21:00"},"6":{"open":"07:00","close":"21:00"}}'::jsonb
  ),
  (
    'Amarelinha Loja 17', 'Amarelinha Supermercados',
    'Rua São Lourenço, 395 - Centro, Matão - SP, 15990-200',
    'Matão', 'SP',
    -21.5993261, -48.3649869, '(16) 3384-8344',
    'A', '#F59E0B',
    'free', 0, true,
    '{"0":{"open":"07:00","close":"14:00"},"1":{"open":"07:00","close":"21:00"},"2":{"open":"07:00","close":"21:00"},"3":{"open":"07:00","close":"21:00"},"4":{"open":"07:00","close":"21:00"},"5":{"open":"07:00","close":"21:00"},"6":{"open":"07:00","close":"21:00"}}'::jsonb
  )
ON CONFLICT DO NOTHING;

-- =============================================================================
-- 3. PDF sources for the 3 new Amarelinha stores
-- =============================================================================
-- Same "Clique para ampliar" static-PDF-link pattern as Mortari — a plain
-- discoverable link on a store-specific page, no render_config needed.

INSERT INTO public.store_pdf_sources (store_id, url, label, source_type, is_active)
SELECT id, 'https://grupoamarelinha.com.br/nossas_ofertas/7162/', 'Amarelinha Loja 15 - Ofertas (PDF)', 'pdf', true
FROM public.stores WHERE name = 'Amarelinha Loja 15'
UNION ALL
SELECT id, 'https://grupoamarelinha.com.br/nossas_ofertas/loja-16/', 'Amarelinha Loja 16 - Ofertas (PDF)', 'pdf', true
FROM public.stores WHERE name = 'Amarelinha Loja 16'
UNION ALL
SELECT id, 'https://grupoamarelinha.com.br/nossas_ofertas/loja-17/', 'Amarelinha Loja 17 - Ofertas (PDF)', 'pdf', true
FROM public.stores WHERE name = 'Amarelinha Loja 17';

-- =============================================================================
-- 4. Instagram-only retailers — manual markers, no automated crawl
-- =============================================================================
-- source_type='image', is_active=false: mirrors Mortari's old pattern
-- (migration 026). No automated crawler exists for Instagram — confirmed
-- headless-browser access to profile pages is blocked by Meta's bot
-- detection, and building around that would mean adversarial scraping
-- against their ToS. These rows exist so the admin panel surfaces "this
-- store needs a manually-pasted image" instead of having no source at all.
-- Paulista also has a physical pamphlet; Milla's also runs a WhatsApp offer
-- club — neither reachable by any crawler either.

INSERT INTO public.store_pdf_sources (store_id, url, label, source_type, is_active)
SELECT id, 'https://www.instagram.com/supermercadopaulistamatao/', 'Supermercado Paulista - Instagram (manual)', 'image', false
FROM public.stores WHERE lower(name) LIKE '%paulista%'
UNION ALL
SELECT id, 'https://www.instagram.com/supermillas/', 'Milla''s Supermercado - Instagram (manual)', 'image', false
FROM public.stores WHERE lower(name) LIKE '%milla%'
UNION ALL
SELECT id, 'https://www.instagram.com/supermercadosimoni/', 'Supermercado Simoni - Instagram (manual)', 'image', false
FROM public.stores WHERE lower(name) LIKE '%simoni%'
ON CONFLICT DO NOTHING;

NOTIFY pgrst, 'reload schema';
