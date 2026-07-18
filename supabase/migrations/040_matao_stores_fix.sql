-- supabase/migrations/040_matao_stores_fix.sql
--
-- 1. Fix Jaú Serve coordinates (address is Av. Baldan 1513, Nova Matão — old coords were ~2km off)
-- 2. Minor correction to Mortari coordinates
-- 3. Deactivate non-Matão stores (focusing on Matão only for now)
-- 4. Add Amarelinha Supermercados Loja 18

UPDATE public.stores
SET    latitude  = -21.6148,
       longitude = -48.3674,
       updated_at = now()
WHERE  id = '13fb45bb-7ba2-4910-8194-760e4cc4eaf0'; -- Jaú Serve

UPDATE public.stores
SET    latitude   = -21.6095,
       longitude  = -48.3577,
       updated_at = now()
WHERE  id = 'f0538599-d750-46ea-973d-e7268b5149a7'; -- Supermercado Mortari

UPDATE public.stores
SET    is_active  = false,
       updated_at = now()
WHERE  id IN (
  '1b03367d-91ba-413c-8181-ced2a9a241eb', -- Savegnago Araraquara
  'd8bd4f78-9670-49aa-af98-7cb165b955d7'  -- Savegnago Sao Carlos
);

INSERT INTO public.stores (
  name, chain, address, city, state,
  latitude, longitude,
  logo_initial, logo_color,
  b2b_plan, search_priority, is_active
) VALUES (
  'Amarelinha Loja 18',
  'Amarelinha Supermercados',
  'Av. Siqueira Campos, 469 - Centro, Matão - SP, 15990-640',
  'Matão', 'SP',
  -21.6080, -48.3699,
  'A', '#F59E0B',
  'free', 0, true
)
ON CONFLICT DO NOTHING;
