-- 011_profile_location.sql
-- Add address and coordinates to profiles for map centering and location display

alter table public.profiles
  add column if not exists address text,
  add column if not exists latitude double precision,
  add column if not exists longitude double precision;
