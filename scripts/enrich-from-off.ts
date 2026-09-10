/**
 * Enriches products with image_url and brand from Open Food Facts (OFF).
 * OFF allows ~100 req/min — use 700ms delay + backoff on 429.
 * Does NOT touch reference_price (Cosmos is the source of truth for that).
 *
 * Usage:
 *   node_modules/.bin/tsx scripts/enrich-from-off.ts
 *
 * Required env vars (same as seed-cosmos-catalog.ts):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL     = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const OFF_BASE         = 'https://world.openfoodfacts.org/api/v2/product';
const DELAY_MS         = 700;  // ~85 req/min — stays under OFF's ~100/min limit
const BATCH            = 2000;

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Priority 1: products already visible in the app (have store_prices) but missing image or brand
  const { data: withStorePrices } = await supabase
    .from('products')
    .select('id, ean, name, store_prices!inner(id)')
    .not('ean', 'is', null)
    .or('image_url.is.null,brand.is.null')
    .limit(BATCH);

  const priorityProducts = (withStorePrices ?? []).map(({ store_prices: _sp, ...p }) => p) as { id: string; ean: string; name: string }[];
  const toEnrich: { id: string; ean: string; name: string }[] = [...priorityProducts];

  if (toEnrich.length < BATCH) {
    const seenIds = priorityProducts.map(p => p.id);
    let restQuery = supabase
      .from('products')
      .select('id, ean, name')
      .not('ean', 'is', null)
      .or('image_url.is.null,brand.is.null')
      .limit(BATCH - toEnrich.length);
    if (seenIds.length > 0) {
      restQuery = restQuery.not('id', 'in', `(${seenIds.join(',')})`);
    }
    const { data: rest } = await restQuery;
    toEnrich.push(...(rest ?? []));
  }

  if (toEnrich.length === 0) {
    console.log('Nothing to enrich — all products already have image and brand.');
    return;
  }

  console.log(`Enriching ${toEnrich.length} products from Open Food Facts (${priorityProducts.length} with store prices first)`);

  let enriched = 0;
  let notFound = 0;
  let errors   = 0;

  for (const product of toEnrich) {
    try {
      const res = await fetch(`${OFF_BASE}/${product.ean}.json?fields=image_front_url,brands`, {
        headers: { 'User-Agent': 'Poup-Price-App/1.0 (lima.galhardo@gmail.com)' },
      });

      if (res.status === 404 || res.status === 301) { notFound++; await sleep(DELAY_MS); continue; }
      if (res.status === 429) {
        console.warn(`  Rate limited by OFF — pausing 30s`);
        await sleep(30_000);
        continue;
      }
      if (!res.ok) { errors++; await sleep(DELAY_MS); continue; }

      const json: any = await res.json();
      if (json.status !== 1 || !json.product) { notFound++; await sleep(DELAY_MS); continue; }

      const off = json.product;
      const updates: Record<string, string> = {};

      if (off.image_front_url) updates.image_url = off.image_front_url;
      if (off.brands)          updates.brand = off.brands.split(',')[0].trim();

      if (Object.keys(updates).length === 0) { await sleep(DELAY_MS); continue; }

      const { error } = await supabase.from('products').update(updates).eq('id', product.id);
      if (error) {
        console.warn(`  [${product.name}] Update error: ${error.message}`);
        errors++;
      } else {
        const got = [updates.image_url && 'image', updates.brand && `brand: ${updates.brand}`].filter(Boolean).join(', ');
        console.log(`  [${product.name}] ✓ ${got}`);
        enriched++;
      }
    } catch (err) {
      console.warn(`  [${product.name}] Fetch failed: ${err}`);
      errors++;
    }

    await sleep(DELAY_MS);
  }

  console.log('\n════════════════════════════════════');
  console.log('Open Food Facts enrichment complete');
  console.log(`  Enriched:  ${enriched}`);
  console.log(`  Not found: ${notFound}`);
  console.log(`  Errors:    ${errors}`);
  console.log('════════════════════════════════════');

  // Coverage summary
  const { count: total }     = await supabase.from('products').select('*', { count: 'exact', head: true });
  const { count: withPrice } = await supabase.from('products').select('*', { count: 'exact', head: true }).not('reference_price', 'is', null);
  const { count: withImage } = await supabase.from('products').select('*', { count: 'exact', head: true }).not('image_url', 'is', null);
  const { count: withBrand } = await supabase.from('products').select('*', { count: 'exact', head: true }).not('brand', 'is', null);
  const pct = (n: number | null) => total ? `${Math.round((n ?? 0) / total * 100)}%` : '—';

  console.log('\n════════════════════════════════════');
  console.log('Coverage summary');
  console.log(`  Total products: ${total}`);
  console.log(`  Price:  ${withPrice} / ${total} (${pct(withPrice)})`);
  console.log(`  Image:  ${withImage} / ${total} (${pct(withImage)})`);
  console.log(`  Brand:  ${withBrand} / ${total} (${pct(withBrand)})`);
  console.log('════════════════════════════════════');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
