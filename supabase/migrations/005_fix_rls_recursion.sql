-- 005_fix_rls_recursion.sql
-- Fix infinite recursion in super_admin RLS policies.
-- All policies that checked `profiles.role = 'super_admin'` caused recursion
-- because profiles' own SELECT policy also checked profiles.
-- Solution: SECURITY DEFINER function that bypasses RLS.

-- =============================================================================
-- Helper function (bypasses RLS via security definer)
-- =============================================================================

create or replace function public.is_super_admin()
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'super_admin'
  );
$$;

-- =============================================================================
-- Drop and recreate all recursive super_admin policies
-- =============================================================================

-- profiles
drop policy if exists "profiles_select_super_admin" on public.profiles;
create policy "profiles_select_super_admin" on public.profiles
  for select using (public.is_super_admin());

-- stores
drop policy if exists "stores_select_super_admin" on public.stores;
create policy "stores_select_super_admin" on public.stores
  for select using (public.is_super_admin());

-- Super admins can create stores (was missing)
create policy "stores_insert_super_admin" on public.stores
  for insert with check (public.is_super_admin());

-- Super admins can update any store
create policy "stores_update_super_admin" on public.stores
  for update using (public.is_super_admin());

-- promotions
drop policy if exists "promotions_select_super_admin" on public.promotions;
create policy "promotions_select_super_admin" on public.promotions
  for select using (public.is_super_admin());

drop policy if exists "promotions_update_super_admin" on public.promotions;
create policy "promotions_update_super_admin" on public.promotions
  for update using (public.is_super_admin());

-- Super admins can insert promotions (bypasses store membership check)
create policy "promotions_insert_super_admin" on public.promotions
  for insert with check (public.is_super_admin());

-- price_indices
drop policy if exists "price_indices_admin_all" on public.price_indices;
create policy "price_indices_admin_all" on public.price_indices
  for all using (public.is_super_admin());

-- price_index_categories
drop policy if exists "price_index_categories_admin_all" on public.price_index_categories;
create policy "price_index_categories_admin_all" on public.price_index_categories
  for all using (public.is_super_admin());

-- price_index_products
drop policy if exists "price_index_products_admin_all" on public.price_index_products;
create policy "price_index_products_admin_all" on public.price_index_products
  for all using (public.is_super_admin());

-- price_quality_flags
drop policy if exists "price_quality_flags_admin_all" on public.price_quality_flags;
create policy "price_quality_flags_admin_all" on public.price_quality_flags
  for all using (public.is_super_admin());
