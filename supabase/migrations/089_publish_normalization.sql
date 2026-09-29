-- Catalog normalization, phase C: publishes one staging run into `products`.
-- Set-based, guarded, and dry-run by default (service role only).
--
--  * Only products with normalized_by IS NULL are touched: nothing a previous pass
--    (savegnago_tree, ean_inherit, llm) wrote is overwritten.
--  * A staging row whose category, brand and base name are all null (the model
--    said null or the answer failed validation) is skipped, so the product stays
--    unnormalized and the next run retries it.
--  * size_value/size_unit are written only when the product has no size yet.
--
-- Returns one row of counts; with p_dry_run = true (the default) nothing is written.

create or replace function public.publish_normalization(p_run_id text, p_dry_run boolean default true)
returns table (eligible integer, with_category integer, with_size integer, written integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_eligible integer;
  v_with_category integer;
  v_with_size integer;
  v_written integer := 0;
begin
  create temporary table _publishable on commit drop as
    select st.product_id, st.category_l2, st.brand_norm, st.base_name, st.size_value, st.size_unit, st.model,
           (p.size_unit is null and st.size_unit is not null) as writes_size
    from product_normalization_staging st
    join products p on p.id = st.product_id
    where st.run_id = p_run_id
      and p.normalized_by is null
      and (st.category_l2 is not null or st.brand_norm is not null or st.base_name is not null);

  select count(*), count(category_l2), count(*) filter (where writes_size)
    into v_eligible, v_with_category, v_with_size
  from _publishable;

  if not p_dry_run then
    update products p
       set category_l2 = s.category_l2,
           brand_norm = s.brand_norm,
           base_name = s.base_name,
           size_value = case when s.writes_size then s.size_value else p.size_value end,
           size_unit = case when s.writes_size then s.size_unit else p.size_unit end,
           normalized_by = 'llm',
           normalized_at = now(),
           normalized_model = s.model
      from _publishable s
     where p.id = s.product_id
       and p.normalized_by is null;
    get diagnostics v_written = row_count;
  end if;

  return query select v_eligible, v_with_category, v_with_size, v_written;
end;
$$;

revoke all on function public.publish_normalization(text, boolean) from public, anon, authenticated;
grant execute on function public.publish_normalization(text, boolean) to service_role;
