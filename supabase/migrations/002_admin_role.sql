-- Extend profiles role to support super_admin for admin panel access
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('consumer', 'business', 'super_admin'));

-- Super admins can see all promotions (any status)
create policy "promotions_select_super_admin" on public.promotions
  for select using (
    exists (
      select 1 from public.profiles
      where id = (select auth.uid()) and role = 'super_admin'
    )
  );

-- Super admins can update promotions (approve/reject moderation)
create policy "promotions_update_super_admin" on public.promotions
  for update using (
    exists (
      select 1 from public.profiles
      where id = (select auth.uid()) and role = 'super_admin'
    )
  );

-- Super admins can see all stores
create policy "stores_select_super_admin" on public.stores
  for select using (
    exists (
      select 1 from public.profiles
      where id = (select auth.uid()) and role = 'super_admin'
    )
  );

-- Super admins can see all profiles
create policy "profiles_select_super_admin" on public.profiles
  for select using (
    exists (
      select 1 from public.profiles
      where id = (select auth.uid()) and role = 'super_admin'
    )
  );
