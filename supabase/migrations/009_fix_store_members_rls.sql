-- 009_fix_store_members_rls.sql
-- Fix infinite recursion in store_members INSERT/DELETE policies.
-- The original policies query store_members from within store_members RLS,
-- causing PostgreSQL to detect infinite recursion.
-- Solution: SECURITY DEFINER helper that bypasses RLS.
-- Also adds missing super_admin policies on store_members.

-- =============================================================================
-- Helper function: check store ownership without triggering RLS
-- =============================================================================

create or replace function public.is_store_member_owner(p_store_id uuid)
returns boolean
language sql security definer stable set search_path = ''
as $$
  select exists (
    select 1 from public.store_members
    where store_id = p_store_id
      and user_id = (select auth.uid())
      and role = 'owner'
  );
$$;

-- =============================================================================
-- Fix store_members INSERT policy (was self-referencing → recursion)
-- =============================================================================

drop policy "store_members_insert_owner" on public.store_members;
create policy "store_members_insert_owner" on public.store_members
  for insert with check (
    user_id = (select auth.uid())
    or public.is_store_member_owner(store_members.store_id)
  );

-- =============================================================================
-- Fix store_members DELETE policy (was self-referencing → recursion)
-- =============================================================================

drop policy "store_members_delete_owner" on public.store_members;
create policy "store_members_delete_owner" on public.store_members
  for delete using (
    public.is_store_member_owner(store_members.store_id)
  );

-- =============================================================================
-- Super admin full access on store_members (was missing from 005)
-- =============================================================================

create policy "store_members_select_super_admin" on public.store_members
  for select using (public.is_super_admin());

create policy "store_members_insert_super_admin" on public.store_members
  for insert with check (public.is_super_admin());

create policy "store_members_delete_super_admin" on public.store_members
  for delete using (public.is_super_admin());

-- =============================================================================
-- Fix stores policies to use helper (cross-table, but consistent)
-- =============================================================================

drop policy "stores_update_members" on public.stores;
create policy "stores_update_members" on public.stores
  for update using (
    public.is_store_member_owner(stores.id)
    or exists (
      select 1 from public.store_members
      where store_id = stores.id
        and user_id = (select auth.uid())
        and role = 'admin'
    )
  );

drop policy "stores_delete_owner" on public.stores;
create policy "stores_delete_owner" on public.stores
  for delete using (public.is_store_member_owner(stores.id));
