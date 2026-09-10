/**
 * Enriches the 500 products with the highest real-world visibility — those
 * that already have a promotions row (i.e. actually shown in the app today,
 * from PDF encarte imports) — but are still missing reference_price or
 * image_url. Uses Cosmos's /gtins/{ean} lookup, which returns price + image
 * + brand in one call, unlike the /products search endpoint used for bulk
 * catalog seeding.
 *
 * Deliberately targets `promotions`, not `store_prices` — the latter is a
 * table built ahead of a future ERP price feed (migration 030) and is
 * currently empty in production. `promotions` is what actually drives
 * product visibility in the app right now.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/enrich-top-500-store-prices.ts
 *
 * Required env vars:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   COSMOS_API_TOKEN        (COSMOS_API_TOKEN_2/_3/_4 also honored if set)
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL         = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const COSMOS_TOKENS = [
  process.env.COSMOS_API_TOKEN   ?? '',
  process.env.COSMOS_API_TOKEN_2 ?? '',
  process.env.COSMOS_API_TOKEN_3 ?? '',
  process.env.COSMOS_API_TOKEN_4 ?? '',
].filter(Boolean);

const COSMOS_BASE = 'https://api.cosmos.bluesoft.com.br';
const DELAY_MS    = 400;
const BATCH       = 500;

interface CosmosGtinResponse {
  brand?:     { name: string };
  thumbnail?: string;
  avg_price?: number | null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

const exhaustedTokens = new Set<string>();
let tokenIndex = 0;
function nextToken(): { token: string; number: number } | null {
  const available = COSMOS_TOKENS.filter((t) => !exhaustedTokens.has(t));
  if (available.length === 0) return null;
  const idx = tokenIndex % available.length;
  tokenIndex++;
  return { token: available[idx], number: COSMOS_TOKENS.indexOf(available[idx]) + 1 };
}

async function main() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }
  if (COSMOS_TOKENS.length === 0) {
    console.error('Missing COSMOS_API_TOKEN');
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const { data, error } = await supabase
    .from('products')
    .select('id, ean, name, promotions!inner(id)')
    .not('ean', 'is', null)
    .or('reference_price.is.null,image_url.is.null')
    .limit(BATCH);

  if (error) {
    console.error('Query failed:', error.message);
    process.exit(1);
  }

  const toEnrich = (data ?? []).map(({ promotions: _p, ...p }) => p) as {
    id: string;
    ean: string;
    name: string;
  }[];

  if (toEnrich.length === 0) {
    console.log('Nothing to enrich — every product with a promotion already has price and image.');
    return;
  }

  console.log(`Enriching ${toEnrich.length} store-visible products via Cosmos /gtins/{ean}`);

  let priced = 0;
  let imaged = 0;
  let noData = 0;
  let errors = 0;

  productLoop:
  for (const product of toEnrich) {
    retry: while (true) {
      const next = nextToken();
      if (!next) {
        console.error('All Cosmos tokens exhausted. Stopping.');
        break productLoop;
      }
      const { token, number: tokenNum } = next;

      try {
        const res = await fetch(`${COSMOS_BASE}/gtins/${product.ean}`, {
          headers: {
            'X-Cosmos-Token': token,
            'User-Agent':     'Cosmos-API-Request',
            'Content-Type':   'application/json',
          },
        });

        if (!res.ok) {
          if (res.status === 429) {
            exhaustedTokens.add(token);
            console.warn(`  [${product.name}] Token ${tokenNum} exhausted — ${COSMOS_TOKENS.length - exhaustedTokens.size} token(s) remaining`);
            if (exhaustedTokens.size >= COSMOS_TOKENS.length) {
              console.error('All Cosmos tokens exhausted. Stopping.');
              break productLoop;
            }
            continue retry;
          }
          if (res.status !== 404) errors++;
          else noData++;
          break retry;
        }

        const cp: CosmosGtinResponse = await res.json();
        const avgPrice = cp.avg_price && cp.avg_price > 0 ? cp.avg_price : null;

        const updates: Record<string, unknown> = { cosmos_synced_at: new Date().toISOString() };
        if (avgPrice)       updates.reference_price = avgPrice;
        if (cp.thumbnail)   updates.image_url = cp.thumbnail;
        if (cp.brand?.name) updates.brand = cp.brand.name;

        if (avgPrice == null && !cp.thumbnail) {
          noData++;
        } else {
          const { error: updateError } = await supabase.from('products').update(updates).eq('id', product.id);
          if (updateError) {
            console.error(`  [${product.ean}] Update error:`, updateError.message);
            errors++;
          } else {
            if (avgPrice) priced++;
            if (cp.thumbnail) imaged++;
            const got = [avgPrice && `price: R$${avgPrice}`, cp.thumbnail && 'image', cp.brand?.name && `brand: ${cp.brand.name}`]
              .filter(Boolean)
              .join(', ');
            console.log(`  [${product.name}] ✓ ${got} (token ${tokenNum})`);
          }
        }
        break retry;
      } catch (err) {
        console.warn(`  [${product.ean}] Fetch failed:`, err);
        errors++;
        break retry;
      }
    }

    await sleep(DELAY_MS);
  }

  console.log('\nDone.');
  console.log(`  Priced:   ${priced}`);
  console.log(`  Imaged:   ${imaged}`);
  console.log(`  No data:  ${noData}`);
  console.log(`  Errors:   ${errors}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
