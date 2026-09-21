-- supabase/migrations/079_city_interest.sql
--
-- Onboarding "Fora de Matão" (docs/poup-mlp-decisoes.md, decisão 9 and the
-- "Onboarding (8a–8c)" screen): the one place the MLP collects a contact. A
-- person outside Matão may leave an e-mail and the city they asked about, only
-- so the Poup can announce it arrived there. Nothing else is stored — no
-- user id, no device id.
--
-- Written by the app with the anon key, so this is insert-only: nobody can
-- read, update or delete rows through the API (no SELECT/UPDATE/DELETE
-- policy, and the privileges are revoked). Reading the list is a
-- service-role/SQL-editor job. The CHECKs are the only server-side guard on
-- what an anonymous caller can write.
--
-- Not covered here: unsubscribe/erasure on request (LGPD) and rate limiting.
-- Both are handled by hand until the volume justifies more.

CREATE TABLE public.city_interest (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  city       text        NOT NULL CHECK (char_length(btrim(city)) BETWEEN 1 AND 120),
  email      text        NOT NULL CHECK (char_length(email) <= 254 AND email ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$'),
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.city_interest IS
  'E-mails left in onboarding "Fora de Matão" to be told when the Poup reaches a city. Insert-only from the app; read with the service role.';

ALTER TABLE public.city_interest ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.city_interest FROM PUBLIC, anon, authenticated;
GRANT INSERT ON public.city_interest TO anon, authenticated;

CREATE POLICY "city_interest_insert_only" ON public.city_interest
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);
