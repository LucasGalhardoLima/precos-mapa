-- Create a super admin user for local development
-- Run with: supabase db execute --file supabase/seed-admin.sql
-- Or paste into Supabase Studio SQL Editor

-- 1. Create auth user (email: admin@precomapa.com / password: admin123456)
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
  'a0000000-0000-4000-b000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'admin@precomapa.com',
  crypt('admin123456', gen_salt('bf')),
  now(),
  now(),
  now(),
  '',
  '{"provider": "email", "providers": ["email"]}',
  '{"display_name": "Admin PrecoMapa"}'
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
  'a0000000-0000-4000-b000-000000000001',
  'a0000000-0000-4000-b000-000000000001',
  'admin@precomapa.com',
  'email',
  jsonb_build_object('sub', 'a0000000-0000-4000-b000-000000000001', 'email', 'admin@precomapa.com'),
  now(),
  now(),
  now()
) ON CONFLICT DO NOTHING;

-- 3. Set role to super_admin in profiles (trigger creates the row, so update it)
-- Wait a moment for the trigger, then update:
UPDATE public.profiles
SET role = 'super_admin', display_name = 'Admin PrecoMapa'
WHERE id = 'a0000000-0000-4000-b000-000000000001';

-- If trigger didn't fire (e.g., already existed), insert directly:
INSERT INTO public.profiles (id, role, display_name)
VALUES ('a0000000-0000-4000-b000-000000000001', 'super_admin', 'Admin PrecoMapa')
ON CONFLICT (id) DO UPDATE SET role = 'super_admin', display_name = 'Admin PrecoMapa';
