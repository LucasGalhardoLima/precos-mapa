-- 021_security_hardening.sql
-- Fix critical and high RLS/auth vulnerabilities from security review (LUM-178).
--
-- C1. Prevent client-side role escalation to super_admin
-- C7. Promotions price validation + status enforcement for non-admins
-- H1. Analytics events RLS — use is_super_admin() to avoid recursion
-- H2. Inactive store access gap — store owners can see their own inactive stores
-- H3. Products — scope UPDATE to creator, not any business user

-- =============================================================================
-- C1. Profiles — block role escalation via RLS
-- =============================================================================
-- Replace the unrestricted profiles_update_own with a WITH CHECK that prevents
-- any user from setting their role to 'super_admin' via client-side UPDATE.
-- Super admin role must be assigned server-side (edge function / migration).

drop policy if exists "profiles_update_own" on public.profiles;

create policy "profiles_update_own" on public.profiles
  for update
  using (id = (select auth.uid()))
  with check (
    id = (select auth.uid())
    and role is distinct from 'super_admin'
  );

-- =============================================================================
-- C7. Promotions — price validation + status enforcement
-- =============================================================================

-- CHECK constraint: promo_price must be positive and <= original_price
-- NOT VALID skips existing rows; validate after data cleanup if needed.
alter table public.promotions
  add constraint promo_price_valid
    check (promo_price > 0 and promo_price <= original_price)
    not valid;

-- Replace INSERT policy: non-admin inserts must have status = 'pending_review'
drop policy if exists "promotions_insert_member" on public.promotions;

create policy "promotions_insert_member" on public.promotions
  for insert with check (
    exists (
      select 1 from public.store_members
      where store_id = promotions.store_id
        and user_id = (select auth.uid())
    )
    and public.check_promotion_limit(store_id)
    and status = 'pending_review'
  );

-- Restrict UPDATE of price fields to store owner/admin only
drop policy if exists "promotions_update_member" on public.promotions;

create policy "promotions_update_member" on public.promotions
  for update using (
    exists (
      select 1 from public.store_members
      where store_id = promotions.store_id
        and user_id = (select auth.uid())
        and role in ('owner', 'admin')
    )
  );

-- =============================================================================
-- H1. Analytics events — fix RLS recursion in admin policy
-- =============================================================================
-- The original policy queries profiles directly instead of using the
-- SECURITY DEFINER helper, which can trigger RLS recursion.

drop policy if exists "analytics_events_select_admin" on public.analytics_events;

create policy "analytics_events_select_admin" on public.analytics_events
  for select to authenticated
  using (public.is_super_admin());

-- =============================================================================
-- H2. Inactive stores — owners can see their own inactive store
-- =============================================================================
-- The original stores_select_active blocks store owners from seeing their own
-- inactive store (e.g., freshly created stores or deactivated stores).

drop policy if exists "stores_select_active" on public.stores;

create policy "stores_select_active" on public.stores
  for select using (
    is_active = true
    or exists (
      select 1 from public.store_members
      where store_members.store_id = stores.id
        and store_members.user_id = (select auth.uid())
    )
  );

-- =============================================================================
-- H3. Products — scope UPDATE to creator (not any business user)
-- =============================================================================
-- Add created_by column to track who created each product.
-- Scope UPDATE to the creator or super_admin.

alter table public.products
  add column if not exists created_by uuid references auth.users(id);

-- Backfill: mark existing products as created by nobody (only super_admin can update them)
-- No backfill needed — NULL created_by means only super_admin can update.

-- Replace the overly permissive products_update_business policy
drop policy if exists "products_update_business" on public.products;

create policy "products_update_owner" on public.products
  for update using (
    -- Product creator can update
    (created_by is not null and created_by = (select auth.uid()))
    -- Super admin can always update
    or public.is_super_admin()
  );

-- Also scope INSERT to record the creator
drop policy if exists "products_insert_business" on public.products;

create policy "products_insert_business" on public.products
  for insert with check (
    exists (
      select 1 from public.profiles
      where id = (select auth.uid()) and role in ('business', 'super_admin')
    )
    and (created_by is null or created_by = (select auth.uid()))
  );
