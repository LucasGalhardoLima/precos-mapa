-- Last-price retention: keep the most recent expired promotion visible
-- so products don't vanish from search when their promo ends.
--
-- Adds 'last_price' status, new columns, updated RLS, and a trigger
-- that auto-expires old last_price rows when a new active promo arrives.

-- 1. Add columns for last-known price tracking
alter table public.promotions
  add column last_known_price numeric(10,2),
  add column last_price_date  timestamptz;

-- 2. Update status check constraint to allow 'last_price'
alter table public.promotions
  drop constraint if exists promotions_status_check;

alter table public.promotions
  add constraint promotions_status_check
    check (status in ('active', 'expired', 'pending_review', 'last_price'));

-- 3. Update RLS: consumers can see active + last_price promotions
drop policy if exists "promotions_select_active" on public.promotions;

create policy "promotions_select_active" on public.promotions
  for select to anon, authenticated using (
    (status = 'active' and end_date > now())
    or status = 'last_price'
  );

-- 4. Trigger: when a new 'active' promotion is inserted for a (product_id, store_id),
--    expire any existing 'last_price' row for that same pair.
create or replace function public.expire_last_price_on_new_active()
returns trigger
language plpgsql
security definer
as $$
begin
  if new.status = 'active' then
    update public.promotions
    set status = 'expired',
        updated_at = now()
    where product_id = new.product_id
      and store_id  = new.store_id
      and status    = 'last_price'
      and id       != new.id;
  end if;
  return new;
end;
$$;

create trigger trg_expire_last_price_on_new_active
  after insert on public.promotions
  for each row
  execute function public.expire_last_price_on_new_active();

-- 5. Index for efficient last_price lookups
create index ix_promotions_last_price
  on public.promotions (product_id, store_id)
  where status = 'last_price';
