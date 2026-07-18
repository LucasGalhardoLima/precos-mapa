-- supabase/migrations/052_matao_store_corrections_and_new.sql
--
-- Full audit of all active Matão stores against live Google Maps listings
-- (user request: "double check every store we have active now"), plus a
-- sweep of Matão's map for real stores we were missing (user request:
-- "also check Matão's map for stores we could be missing").
--
-- Part 1: corrections to existing rows — each verified against the live
-- Google Maps listing for that exact address before changing anything.
--
-- Part 2: 4 new real stores, bringing the active Matão count to 10.
-- opening_hours left null for all 4 — the full weekly table wasn't
-- reliably extractable from the Maps UI for any of them (same honest-gap
-- call as Milla's in migration 051); inventing precise hours would be
-- worse than the gap.

-- =============================================================================
-- Part 1: corrections
-- =============================================================================

-- Jaú Serve — address was already correct, but coordinates were ~550m off
-- (verified against the live listing for the same address).
UPDATE public.stores
SET    latitude   = -21.612191,
       longitude  = -48.3719252,
       updated_at = now()
WHERE  id = '13fb45bb-7ba2-4910-8194-760e4cc4eaf0';

-- Savegnago — coordinates were ~550m off, and Friday hours were wrong
-- (20:30 close vs. the actual 22:00 — live listing shows "Fecha em breve
-- · 22:00" on a Friday, matching every other weekday, not the early close
-- previously stored).
UPDATE public.stores
SET    latitude   = -21.6015665,
       longitude  = -48.3615659,
       opening_hours = jsonb_set(opening_hours, '{5}', '{"open":"07:30","close":"22:00"}'::jsonb),
       updated_at = now()
WHERE  id = 'd5912ae4-2aa3-44e6-bcf6-9d6503c57bfe';

-- Supermercado Mortari — neighborhood was wrong ("Jardim Buscardi" is not
-- this address's actual district per Google; the correct address prefixes
-- "Vila Buscardi" as an area note but the formal neighborhood is "Jardim
-- Pereira"). Coordinates were already accurate (~10m), left unchanged.
UPDATE public.stores
SET    address    = 'Vila Buscardi - R. Sinharinha Frota, 1671 - Jardim Pereira, Matão - SP, 15990-838',
       updated_at = now()
WHERE  id = 'f0538599-d750-46ea-973d-e7268b5149a7';

-- Tenda Atacado — name and address were missing accents throughout, the
-- address was missing its postal code, and coordinates were over 1km off
-- (would have placed the map pin in the wrong part of town).
UPDATE public.stores
SET    name       = 'Tenda Atacado - Matão',
       address    = 'R. São Lourenço, 594 - Centro, Matão - SP, 15990-250',
       latitude   = -21.6015716,
       longitude  = -48.3559906,
       updated_at = now()
WHERE  id = '83f44bb1-b079-42de-98b5-81d4c4f040eb';

-- =============================================================================
-- Part 2: new stores found sweeping Matão's map, bringing the active count
-- to 10 (name/address/phone/coordinates pulled live from Google Maps)
-- =============================================================================

INSERT INTO public.stores (
  name, chain, address, city, state,
  latitude, longitude,
  logo_initial, logo_color,
  b2b_plan, search_priority, is_active
) VALUES
  (
    'Supermercado Paulista',
    'Supermercado Paulista',
    'Via Narciso Baldan, 61 - Vila Santa Cruz, Matão - SP, 15990-415',
    'Matão', 'SP',
    -21.6072472, -48.3556751,
    'P', '#0EA5E9',
    'free', 0, true
  ),
  (
    'Supermercado Simoni',
    'Supermercado Simoni',
    'Av. Ângelo Ragassi, 336 - Jardim São José, Matão - SP, 15996-018',
    'Matão', 'SP',
    -21.5910102, -48.3750284,
    'S', '#8B5CF6',
    'free', 0, true
  ),
  (
    'Supermercado São Lucas',
    'Supermercado São Lucas',
    'R. Durval de Souza, 663 - Jardim Santa Rosa, Matão - SP, 15995-016',
    'Matão', 'SP',
    -21.6001721, -48.3863892,
    'S', '#D946EF',
    'free', 0, true
  ),
  (
    'Amarelinha Loja 21 Flamboyant',
    'Amarelinha Supermercados',
    'Av. João Marchesan, 873 - Conj. Res. João Vital, Matão - SP, 15994-004',
    'Matão', 'SP',
    -21.6043661, -48.3858794,
    'A', '#F59E0B',
    'free', 0, true
  )
ON CONFLICT DO NOTHING;
