-- 012_list_item_store.sql
-- Add store_id to shopping_list_items so items track their origin store

alter table public.shopping_list_items
  add column if not exists store_id uuid references public.stores(id);
