-- Create a consumer test user for local development
-- Run with: supabase db execute --file supabase/seed-consumer.sql
-- Or paste into Supabase Studio SQL Editor

-- 1. Create auth user (email: consumer@poup.com.br / password: consumer123456)
INSERT INTO auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  confirmation_token,
  raw_app_meta_data,
  raw_user_meta_data
) VALUES (
  'c0000000-0000-4000-b000-000000000002',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'consumer@poup.com.br',
  crypt('consumer123456', gen_salt('bf')),
  now(),
  now(),
  now(),
  '',
  '{"provider": "email", "providers": ["email"]}',
  '{"display_name": "Lucas Teste"}'
) ON CONFLICT (id) DO NOTHING;

-- 2. Create identity for email auth
INSERT INTO auth.identities (
  id,
  user_id,
  provider_id,
  provider,
  identity_data,
  last_sign_in_at,
  created_at,
  updated_at
) VALUES (
  'c0000000-0000-4000-b000-000000000002',
  'c0000000-0000-4000-b000-000000000002',
  'consumer@poup.com.br',
  'email',
  jsonb_build_object('sub', 'c0000000-0000-4000-b000-000000000002', 'email', 'consumer@poup.com.br'),
  now(),
  now(),
  now()
) ON CONFLICT DO NOTHING;

-- 3. Set role to consumer in profiles
INSERT INTO public.profiles (id, role, display_name, city, b2c_plan)
VALUES ('c0000000-0000-4000-b000-000000000002', 'consumer', 'Lucas Teste', 'Matão', 'free')
ON CONFLICT (id) DO UPDATE SET role = 'consumer', display_name = 'Lucas Teste', city = 'Matão', b2c_plan = 'free';
