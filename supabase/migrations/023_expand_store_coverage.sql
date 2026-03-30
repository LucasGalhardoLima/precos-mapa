-- 023_expand_store_coverage.sql
-- Expand store coverage: add Savegnago Araraquara + São Carlos,
-- deactivate Mortari, and configure PDF sources for automated imports.
--
-- Context: Production has 3 stores (Jaú Serve, Savegnago Matão, Mortari).
-- Mortari has no PDF infrastructure — deactivate it.
-- Adding Savegnago's Araraquara and São Carlos locations leverages
-- existing PDF journal infrastructure (same domain, different city slug).
-- Result: 4 active stores with automated daily imports.

-- ==========================================================================
-- 1. Deactivate Mortari (no PDF source, Instagram-only offers)
-- ==========================================================================

update public.stores
set is_active = false,
    updated_at = now()
where lower(name) like '%mortari%'
  and is_active = true;

-- ==========================================================================
-- 2. Add Savegnago Araraquara (idempotent — skip if exists)
-- ==========================================================================

insert into public.stores (
  name, chain, address, city, state,
  latitude, longitude,
  logo_initial, logo_color,
  b2b_plan, is_active
)
select
  'Savegnago Araraquara',
  'Savegnago',
  'Av. Portugal, 2500 - Vila Xavier, Araraquara/SP',
  'Araraquara', 'SP',
  -21.7946, -48.1756,
  'S', '#DC2626',
  'premium', true
where not exists (
  select 1 from public.stores
  where name = 'Savegnago Araraquara'
);

-- ==========================================================================
-- 3. Add Savegnago São Carlos (idempotent — skip if exists)
-- ==========================================================================

insert into public.stores (
  name, chain, address, city, state,
  latitude, longitude,
  logo_initial, logo_color,
  b2b_plan, is_active
)
select
  'Savegnago Sao Carlos',
  'Savegnago',
  'Av. Sao Carlos, 2880 - Centro, Sao Carlos/SP',
  'Sao Carlos', 'SP',
  -22.0087, -47.8909,
  'S', '#DC2626',
  'premium', true
where not exists (
  select 1 from public.stores
  where name = 'Savegnago Sao Carlos'
);

-- ==========================================================================
-- 4. Add store_pdf_sources for new stores
--    URL pattern: https://www.savegnago.com.br/jornal-de-ofertas/{city}
--    (same infrastructure as Matão — crawler discovers PDFs from the page)
-- ==========================================================================

-- Savegnago Araraquara — weekly offers journal
insert into public.store_pdf_sources (store_id, url, label, is_active)
select s.id,
       'https://www.savegnago.com.br/jornal-de-ofertas/araraquara',
       'Savegnago Araraquara - Jornal Semanal',
       true
from public.stores s
where s.name = 'Savegnago Araraquara'
  and s.is_active = true
  and not exists (
    select 1 from public.store_pdf_sources ps
    where ps.store_id = s.id
      and ps.url = 'https://www.savegnago.com.br/jornal-de-ofertas/araraquara'
  );

-- Savegnago São Carlos — weekly offers journal
insert into public.store_pdf_sources (store_id, url, label, is_active)
select s.id,
       'https://www.savegnago.com.br/jornal-de-ofertas/sao-carlos',
       'Savegnago Sao Carlos - Jornal Semanal',
       true
from public.stores s
where s.name = 'Savegnago Sao Carlos'
  and s.is_active = true
  and not exists (
    select 1 from public.store_pdf_sources ps
    where ps.store_id = s.id
      and ps.url = 'https://www.savegnago.com.br/jornal-de-ofertas/sao-carlos'
  );
