import { SupabaseClient } from "@supabase/supabase-js";

// No real validity window comes from any of the 4 scraped retailers (VTEX
// commertialOffer, Salesforce price.list, OpenCart old-price and Tenda's
// listing API all lack a usable end-date field — see
// docs/scraping-viabilidade-matao.md). end_date is instead a rolling window,
// pushed back out to now + this many days on every run that still confirms
// the promo; expire-promotions (supabase/functions/expire-promotions) takes
// over once a run stops confirming it. 3 days survives ~2-3 missed/failed
// daily scrape runs (cron runs 03:00 BRT, expire-promotions runs 00:00 BRT)
// while staying far tighter than a PDF flyer's week-plus window.
const ROLLING_WINDOW_DAYS = 3;

export interface SyncCrawlerPromotionInput {
  productId: string;
  storeId: string;
  originalPrice: number;
  promoPrice: number;
}

/**
 * Upserts the crawler's read of a promotional price into `promotions`
 * (source='crawler'), letting the existing sync_promotion_to_store_price
 * trigger (supabase/migrations/054, 056) derive store_prices from it. Call
 * this AFTER the caller's own store_prices upsert for the same item —
 * the trigger sets store_prices.valid_until from this row's end_date, which
 * a later store_prices upsert (hardcoding valid_until: null) would clobber
 * back to null if this ran first.
 */
export async function syncCrawlerPromotion(
  supabase: SupabaseClient,
  input: SyncCrawlerPromotionInput,
): Promise<void> {
  const endDate = new Date(Date.now() + ROLLING_WINDOW_DAYS * 86_400_000).toISOString();

  const { data: existing } = await supabase
    .from("promotions")
    .select("id")
    .eq("product_id", input.productId)
    .eq("store_id", input.storeId)
    .eq("source", "crawler")
    .eq("status", "active")
    .maybeSingle();

  if (existing) {
    await supabase
      .from("promotions")
      .update({
        original_price: input.originalPrice,
        promo_price: input.promoPrice,
        end_date: endDate,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
  } else {
    await supabase.from("promotions").insert({
      product_id: input.productId,
      store_id: input.storeId,
      original_price: input.originalPrice,
      promo_price: input.promoPrice,
      start_date: new Date().toISOString(),
      end_date: endDate,
      status: "active",
      source: "crawler",
      verified: true,
    });
  }
}
