-- supabase/migrations/071_crawler_promotions_partial_unique.sql
--
-- Safety net for the upcoming crawler->promotions write path (scrape-*.ts
-- scripts will start upserting promotions rows with source='crawler' when
-- is_promo=true). Scoped to status='active' (not just source) so it never
-- collides with the 'last_price' row expire-promotions creates for the same
-- product+store pair once a crawler-sourced promotion expires.

CREATE UNIQUE INDEX IF NOT EXISTS uq_promotions_crawler_active
  ON public.promotions (product_id, store_id)
  WHERE source = 'crawler' AND status = 'active';
