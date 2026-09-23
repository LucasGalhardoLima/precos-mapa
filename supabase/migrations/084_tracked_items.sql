-- tracked_items: replaces the Etapa 4 onboarding-AsyncStorage shortcut
-- (mobile/lib/onboarding.ts's `poup:onboarding` key) with a real, synced
-- "acompanhar este item" backend (Etapa 5, docs/poup-mlp-decisoes.md
-- decisão 10). Requires Supabase anonymous auth (enable_anonymous_sign_ins,
-- flipped by Lucas via dashboard 2026-09-23) — there is no login in the MLP
-- (decisão 9), so `auth.uid()` here is always an anonymous user's id.
--
-- Same FK-to-profiles / RLS-by-owner shape as user_favorites/user_alerts
-- (001_initial_schema.sql) — `handle_new_user()`'s trigger on auth.users
-- fires for anonymous sign-ins too, so profiles(id) always exists once
-- signInAnonymously() has run.
--
-- Two ways to track something, matching Raiz's own "item genérico vs.
-- item-produto" distinction (doc linha 42): a specific product (EAN
-- resolved), or a generic category+size (no product pinned yet, e.g. "Arroz
-- · 5 kg" before onboarding's "escolher tipo"). Exactly one of the two
-- shapes must be set, never both, never neither.
create table public.tracked_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  product_id uuid references public.products(id) on delete cascade,
  category_label text,
  category_size text,
  target_price numeric(10,2),
  created_at timestamptz not null default now(),
  constraint tracked_items_exactly_one_identity check (
    (product_id is not null and category_label is null and category_size is null)
    or (product_id is null and category_label is not null and category_size is not null)
  )
);

create unique index tracked_items_user_product_uidx
  on public.tracked_items (user_id, product_id)
  where product_id is not null;

create unique index tracked_items_user_category_uidx
  on public.tracked_items (user_id, category_label, category_size)
  where category_label is not null;

create index ix_tracked_items_user_id on public.tracked_items (user_id);
create index ix_tracked_items_product_id on public.tracked_items (product_id) where product_id is not null;

alter table public.tracked_items enable row level security;

create policy "tracked_items_select_own" on public.tracked_items
  for select using (user_id = (select auth.uid()));

create policy "tracked_items_insert_own" on public.tracked_items
  for insert with check (user_id = (select auth.uid()));

create policy "tracked_items_update_own" on public.tracked_items
  for update using (user_id = (select auth.uid()));

create policy "tracked_items_delete_own" on public.tracked_items
  for delete using (user_id = (select auth.uid()));
