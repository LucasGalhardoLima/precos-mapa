-- supabase/migrations/051_add_millas_supermercado.sql
--
-- Adds a 6th real Matão store (P1-6 punch-list item — still short of the
-- 10+ target, more to follow as sourced). Name/address/coordinates/phone
-- pulled live from Google Maps (user-supplied listing); opening_hours left
-- null — the full weekly table wasn't reliably extractable from the Maps UI
-- and inventing precise open/close times would be worse than admitting the
-- gap. computeIsOpen() already handles null opening_hours as "unknown"
-- (renders as closed until real hours are added — same as any newly added
-- store before its hours are backfilled).

INSERT INTO public.stores (
  name, chain, address, city, state,
  latitude, longitude,
  logo_initial, logo_color,
  b2b_plan, search_priority, is_active
) VALUES (
  'Milla''s Supermercado - Laranjeiras',
  'Milla''s Supermercado',
  'R. José Gonçalves, 2359 - Parque das Laranjeiras 2, Matão - SP, 15994-750',
  'Matão', 'SP',
  -21.602533, -48.399288,
  'M', '#EC4899',
  'free', 0, true
)
ON CONFLICT DO NOTHING;
