-- 024_add_tenda_atacado_matao.sql
-- Add Tenda Atacado Matão as the third active store for Matão launch.
--
-- Context: Board directed Matão-first focus. Active stores:
--   1. Savegnago Matão  — daily automated imports via PDF journal
--   2. Jaú Serve        — daily automated imports via PDF tabloid
--   3. Tenda Atacado    — manual imports only (image-based offers, no PDFs)
--
-- Tenda Atacado's offers (tendaatacado.com.br/institucional/nossas-ofertas)
-- require JS navigation to select Matão store, then display 4 offer images.
-- No PDFs exist. The current cron pipeline is PDF-only, so the source is
-- created with is_active = false. Automated imports require a future
-- image-based crawler (headless browser + vision extraction).

-- ==========================================================================
-- 1. Add Tenda Atacado Matão (idempotent — skip if exists)
-- ==========================================================================

insert into public.stores (
  name, chain, address, city, state,
  latitude, longitude,
  logo_initial, logo_color,
  b2b_plan, is_active
)
select
  'Tenda Atacado Matao',
  'Tenda Atacado',
  'Rua Sao Lourenco, 594 - Centro, Matao/SP',
  'Matao', 'SP',
  -21.6038, -48.3665,
  'T', '#EA580C',
  'free', true
where not exists (
  select 1 from public.stores
  where name = 'Tenda Atacado Matao'
);

-- ==========================================================================
-- 2. Add store_pdf_sources for Tenda Atacado Matão (idempotent)
--    URL: tendaatacado.com.br/institucional/nossas-ofertas
--    is_active = false — pipeline is PDF-only; Tenda uses images.
--    Set is_active = true once image-based crawler is implemented.
-- ==========================================================================

insert into public.store_pdf_sources (store_id, url, label, is_active)
select s.id,
       'https://www.tendaatacado.com.br/institucional/nossas-ofertas',
       'Tenda Atacado Matao - Ofertas',
       false
from public.stores s
where s.name = 'Tenda Atacado Matao'
  and s.is_active = true
  and not exists (
    select 1 from public.store_pdf_sources ps
    where ps.store_id = s.id
      and ps.url = 'https://www.tendaatacado.com.br/institucional/nossas-ofertas'
  );
