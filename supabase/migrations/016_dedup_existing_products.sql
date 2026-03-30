-- 016_dedup_existing_products.sql
-- Merge duplicate products: group by normalized name + brand + size_token,
-- keep the one with the most promotions as canonical, re-point all FKs.

-- Step 1: Identify duplicates and pick canonical product per group
-- A "group" is defined by: lower(name) + coalesce(lower(brand), '') + coalesce(extract_size_token(name), '')
-- The canonical product is the one with the most promotions (ties broken by earliest created_at).

do $$
declare
  dup record;
  canon_id uuid;
begin
  -- Loop over each group that has more than 1 product
  for dup in
    select
      lower(p.name) as norm_name,
      coalesce(lower(p.brand), '') as norm_brand,
      coalesce(public.extract_size_token(p.name), '') as size_tok,
      array_agg(p.id order by promo_count desc, p.created_at asc) as product_ids,
      count(*) as cnt
    from public.products p
    left join lateral (
      select count(*) as promo_count
      from public.promotions pr
      where pr.product_id = p.id
    ) pc on true
    group by lower(p.name), coalesce(lower(p.brand), ''), coalesce(public.extract_size_token(p.name), '')
    having count(*) > 1
  loop
    -- First element is the canonical product (most promotions, oldest)
    canon_id := dup.product_ids[1];

    -- Re-point all FK references from duplicates to canonical
    -- promotions
    update public.promotions
    set product_id = canon_id
    where product_id = any(dup.product_ids[2:]);

    -- user_favorites (avoid unique constraint conflicts: user_id + product_id)
    -- Delete favorites that would conflict, then update the rest
    delete from public.user_favorites f
    where f.product_id = any(dup.product_ids[2:])
      and exists (
        select 1 from public.user_favorites f2
        where f2.user_id = f.user_id and f2.product_id = canon_id
      );
    update public.user_favorites
    set product_id = canon_id
    where product_id = any(dup.product_ids[2:]);

    -- user_alerts (avoid unique constraint conflicts: user_id + product_id)
    delete from public.user_alerts a
    where a.product_id = any(dup.product_ids[2:])
      and exists (
        select 1 from public.user_alerts a2
        where a2.user_id = a.user_id and a2.product_id = canon_id
      );
    update public.user_alerts
    set product_id = canon_id
    where product_id = any(dup.product_ids[2:]);

    -- product_synonyms (avoid unique term conflicts — just delete dups pointing to non-canonical)
    delete from public.product_synonyms
    where product_id = any(dup.product_ids[2:]);

    -- shopping_list_items
    update public.shopping_list_items
    set product_id = canon_id
    where product_id = any(dup.product_ids[2:]);

    -- price_snapshots
    update public.price_snapshots
    set product_id = canon_id
    where product_id = any(dup.product_ids[2:]);

    -- price_index_products (avoid unique constraint: index_id + product_id)
    delete from public.price_index_products pip
    where pip.product_id = any(dup.product_ids[2:])
      and exists (
        select 1 from public.price_index_products pip2
        where pip2.index_id = pip.index_id and pip2.product_id = canon_id
      );
    update public.price_index_products
    set product_id = canon_id
    where product_id = any(dup.product_ids[2:]);

    -- price_quality_flags
    update public.price_quality_flags
    set product_id = canon_id
    where product_id = any(dup.product_ids[2:]);

    -- Delete the duplicate products (all except canonical)
    delete from public.products
    where id = any(dup.product_ids[2:]);

    raise notice 'Merged % duplicates into canonical product % (%)',
      array_length(dup.product_ids, 1) - 1, canon_id, dup.norm_name;
  end loop;
end;
$$;
