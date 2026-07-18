-- supabase/migrations/050_fix_matao_city_typo.sql
--
-- "Tenda Atacado Matao" was inserted with city='Matao' (missing the accent),
-- while every other Matão store uses city='Matão'. Any exact city-match
-- filter/grouping (map screen, geo_hotzone_by_store, etc.) silently drops
-- this store from "Matão" results.

UPDATE public.stores
SET    city = 'Matão',
       updated_at = now()
WHERE  city = 'Matao';
