/**
 * Scrapes Jaú Serve's product catalog and writes current, store-scoped
 * prices into store_prices for "Jaú Serve" (Matão).
 *
 * Revalidated 2026-09-01 (see docs/scraping-viabilidade-matao.md): price
 * and availability DO vary by store on this site — this reverses the
 * earlier, under-sampled validation that said otherwise. Tested 20 SKUs
 * across "no store selected" / Matão / Avaré: 60% identical everywhere,
 * 10% genuinely different price by store, and 30% vanish from the store's
 * price book entirely (`isInAPriceBook: false`, `price.sales.value: null`)
 * even though the site's own `availability.messages`/`available` fields
 * keep claiming "Em estoque" for them — those two fields lie about real
 * per-store sellability and must never be used as the stock signal.
 *
 * Store context is set once per run via a plain HTTP call:
 *   GET Delivery-SetPickupStore?postcode=<Matão CEP>
 * which returns `dw_storeid`/`dw_shippostalcode` cookies (non-HttpOnly).
 * Confirmed live that those two cookies alone are sufficient — a request
 * carrying only them, with no session/`dwsid` cookie at all, still reflects
 * the selected store — so they're captured once and replayed on every
 * subsequent product request via a manual `Cookie` header. No cookie-jar
 * dependency needed.
 *
 * Product data now comes from the JSON AJAX endpoint
 *   GET Product-Variation?pid={id}&format=ajax
 * instead of regexing the SSR HTML — more reliable, and gives brand,
 * images, and `isInAPriceBook`/`availableCount` for free. `pid` is the
 * numeric slug from the discovered product URL; most are real 13-digit
 * EANs (matching stays EAN-first, same as before), but hortifruti/padaria
 * items use a short internal SKU (3-4 digits, e.g. pid `7116` = "Farinha
 * de Rosca") that the page mislabels as "EAN: 7116" — only a `pid` that is
 * exactly 13 digits is treated as `products.ean`; anything shorter falls
 * through to the name-based fuzzy match, same path as a product with no
 * EAN at all.
 *
 * Products absent from the Matão price book (`isInAPriceBook: false` or
 * `price.sales.value === null`) are skipped entirely — never written with
 * the site-wide/no-store price, which would misrepresent what's actually
 * buyable at this store. Counted separately in the run summary.
 *
 * DRY_RUN defaults to true (writes a review CSV, no DB writes) — same
 * caution as enrich-from-off.ts / enrich-images-from-retailers.ts. Flip to
 * false once a sample run looks right.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/scrape-jauserve-prices.ts
 *   npx tsx --env-file=.env.local scripts/scrape-jauserve-prices.ts --limit=5   (caps this run to N products — manual testing)
 *
 * Required env vars:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Optional env var:
 *   SCRAPER_DATABASE_URL — when set, every DB read/write goes through a
 *   direct Postgres connection (see src/lib/scraper-db.ts) instead of
 *   supabase-js/REST. Bridge for when PostgREST itself is unreachable
 *   (2026-09 Storage-quota restriction, which 402s reads too, not just
 *   writes). Parsing and matching logic are untouched either way — only the
 *   transport changes. shortcut: only this one scraper is wired to the
 *   bridge so far — upgrade: the other 3 (scrape-{savegnago,amarelinha,
 *   tenda-atacado}-prices.ts) can adopt the same createDirectScraperDb once
 *   this one is confirmed against production.
 */

import { createClient } from '@supabase/supabase-js';
import type { Client } from 'pg';
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { connectAsServiceRole, createDirectScraperDb, createRestScraperDb, type ScraperDb } from '../src/lib/scraper-db';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const STORE_NAME_PATTERN = '%ja_ serve%'; // ilike wildcard matches "jaú"/"jau" either way
const BASE = 'https://www.jauserve.com.br';
const SITE_PATH = 'on/demandware.store/Sites-JauServe-Site/pt_BR';
const USER_AGENT = 'Mozilla/5.0 (compatible; PoupBot/1.0; +lima.galhardo@gmail.com)';
const DELAY_MS = 500;
const BATCH = 12000; // deliberately >> catalog size (~8,953) — clears everything in one run, required for the unattended GH Actions cron (its checkpoint doesn't survive across daily runs)
const PAGE_SIZE = 16;
const MAX_PAGES_PER_CATEGORY = 60; // safety cap — 960 products/category, generous but bounded

// Jaú Serve Matão's registered CEP — confirmed 2026-09-01 against
// stores.address for store id 13fb45bb-7ba2-4910-8194-760e4cc4eaf0
// ("Av. Baldan, 1513 - Nova Matão, Matão - SP, 15993-000").
// shortcut: hardcoded for the one Jaú Serve store this script targets —
// upgrade: if a second Jaú Serve store is ever added to `stores`, loop
// per store (CEP from `store.address`) instead of a single constant, and
// key store_prices/checkpoints per store too.
const MATAO_POSTCODE = '15993-000';

const DISCOVERY_CACHE_FILE = resolve(process.cwd(), 'scripts/.scrape-jauserve-urls.json');
const CHECKPOINT_FILE = resolve(process.cwd(), 'scripts/.scrape-jauserve-checkpoint.json');
const REVIEW_FILE = resolve(process.cwd(), 'scripts/.scrape-jauserve-review.csv');

// Top-level category IDs from the site's menu (Search-Show?cgid=...).
const CATEGORY_IDS = [
  'EC01', 'EC02', 'EC03', 'EC04', 'EC05', 'EC06', 'EC07', 'EC08', 'EC09',
  'EC10', 'EC11', 'EC12', 'EC13', 'EC14', 'EC15', 'EC16', 'EC17',
];

// Maps each category id to our internal categories.id taxonomy (12 rows —
// see the `categories` table) — real names confirmed live via each
// category's own breadcrumb/<h1>. EC08 (Sazonais/seasonal), EC14
// (Jardinagem/gardening) and EC15 (Bazar) don't map cleanly to any single
// internal category — cat_outros rather than guessing. EC17 (Proteínas) is
// protein supplements/shakes, not the meat aisle (that's EC03) — cat_alimentos.
const CATEGORY_TO_INTERNAL: Record<string, string> = {
  EC01: 'cat_bebidas', // Bebidas alcoólicas
  EC02: 'cat_bebidas', // Bebidas não alcoólicas
  EC03: 'cat_carnes', // Carnes, aves e peixes
  EC04: 'cat_congelados', // Congelados
  EC05: 'cat_laticinios', // Frios e laticínios
  EC06: 'cat_alimentos', // Mercearia
  EC07: 'cat_hortifruti', // Hortifruti
  EC08: 'cat_outros', // Sazonais
  EC09: 'cat_padaria', // Padaria, confeitaria e pizzaria
  EC10: 'cat_higiene', // Higiene e beleza
  EC11: 'cat_limpeza', // Limpeza
  EC12: 'cat_pet', // Pet shop
  EC13: 'cat_alimentos', // Alimentos saudáveis
  EC14: 'cat_outros', // Jardinagem
  EC15: 'cat_outros', // Bazar
  EC16: 'cat_alimentos', // Empório (deli/specialty foods)
  EC17: 'cat_alimentos', // Proteínas (supplements)
};

// Set to false only after reviewing a sample run's output.
const DRY_RUN = false;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchWithTimeout(url: string, timeoutMs = 20000, extraHeaders: Record<string, string> = {}): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { headers: { 'User-Agent': USER_AGENT, ...extraHeaders }, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Activates the Matão store context once per run. Reads the `dw_storeid`
 * and `dw_shippostalcode` cookies off the Set-Cookie headers (the site
 * sets `dw_shippostalcode` twice — cleared, then re-set with the real
 * value — a Map naturally keeps the last write) and returns them as a
 * ready-to-send `Cookie` header string for every subsequent product fetch.
 * shortcut: only these two documented store-context cookies are captured
 * and replayed, not the full session cookie set (sid/dwsid/etc.) — upgrade:
 * if store-scoped filtering ever silently stops working (isInAPriceBook
 * always true), capture and replay the entire Set-Cookie jar instead.
 */
async function getStoreCookies(): Promise<string> {
  const url = `${BASE}/${SITE_PATH}/Delivery-SetPickupStore?postcode=${encodeURIComponent(MATAO_POSTCODE)}`;
  const res = await fetchWithTimeout(url, 20000);
  if (!res.ok) {
    throw new Error(`Delivery-SetPickupStore failed: HTTP ${res.status}`);
  }

  const cookies = new Map<string, string>();
  for (const setCookie of res.headers.getSetCookie()) {
    const pair = setCookie.split(';', 1)[0];
    const eq = pair.indexOf('=');
    if (eq === -1) continue;
    const name = pair.slice(0, eq).trim();
    const value = pair.slice(eq + 1).trim();
    if (name === 'dw_storeid' || name === 'dw_shippostalcode') {
      cookies.set(name, value);
    }
  }

  const storeId = cookies.get('dw_storeid');
  const postalCode = cookies.get('dw_shippostalcode');
  if (!storeId || !postalCode) {
    throw new Error(
      `Delivery-SetPickupStore did not return the expected cookies (got: ${[...cookies.keys()].join(', ') || 'none'})`,
    );
  }

  console.log(`Store context set: dw_storeid=${storeId} dw_shippostalcode=${postalCode}\n`);
  return `dw_storeid=${storeId}; dw_shippostalcode=${postalCode}`;
}

interface DiscoveredUrl {
  url: string;
  categoryId: string; // our internal categories.id, from the first category grid this URL was seen under
}

async function discoverProductUrls(storeCookie: string): Promise<DiscoveredUrl[]> {
  if (existsSync(DISCOVERY_CACHE_FILE)) {
    console.log('Loading cached product URL list...');
    return JSON.parse(readFileSync(DISCOVERY_CACHE_FILE, 'utf-8'));
  }

  console.log('Crawling category grids to discover product URLs (first run — cached afterwards)...');
  const byUrl = new Map<string, DiscoveredUrl>();

  for (const cgid of CATEGORY_IDS) {
    let pageUrls = 0;
    for (let page = 0; page < MAX_PAGES_PER_CATEGORY; page++) {
      const start = page * PAGE_SIZE;
      const gridUrl = `${BASE}/${SITE_PATH}/Search-UpdateGrid?cgid=${cgid}&start=${start}&sz=${PAGE_SIZE}`;
      try {
        // Store context is required here, not just on Product-Variation below —
        // without it the grid renders "0 de 0 produtos" for every store-scoped
        // category (confirmed live: this silently produced a 127-URL "catalog"
        // instead of the real ~4,000+ before this fix).
        const res = await fetchWithTimeout(gridUrl, 20000, { Cookie: storeCookie });
        if (!res.ok) break;
        const html = await res.text();
        const hrefs = [...html.matchAll(/href="(\/[a-zA-Z0-9-]+\.html)"/g)].map((m) => m[1]);
        if (hrefs.length === 0) break;
        for (const h of hrefs) {
          const url = BASE + h;
          if (byUrl.has(url)) continue; // first category grid a URL appears under wins
          byUrl.set(url, { url, categoryId: CATEGORY_TO_INTERNAL[cgid] ?? 'cat_alimentos' });
          pageUrls++;
        }
      } catch (err) {
        console.warn(`  [${cgid} page ${page}] error: ${err instanceof Error ? err.message : err}`);
        break;
      }
      await sleep(300);
    }
    console.log(`  ${cgid}: ${pageUrls} product links found`);
  }

  const result = [...byUrl.values()];
  writeFileSync(DISCOVERY_CACHE_FILE, JSON.stringify(result));
  console.log(`Total unique product URLs discovered: ${result.length}\n`);
  return result;
}

/** Extracts the `pid` Product-Variation expects from a discovered product URL. */
function pidFromUrl(url: string): string | null {
  const m = url.match(/\/([a-zA-Z0-9-]+)\.html$/);
  return m ? m[1] : null;
}

interface ScrapedProduct {
  rawId: string; // product.id as returned by the API — may or may not be a real EAN
  ean: string | null; // rawId, but only when it's exactly 13 digits
  name: string;
  brand: string | null;
  price: number | null; // null when isInAPriceBook is false
  isPromo: boolean;
  originalPrice: number | null; // price.list.value when isPromo — null otherwise
  imageUrl: string | null;
  isInAPriceBook: boolean;
}

interface ProductVariationResponse {
  product?: {
    id?: string;
    productName?: string;
    brand?: string | null;
    price?: {
      sales?: { value?: number | null } | null;
      list?: { value?: number | null } | null;
    } | null;
    images?: {
      large?: { url?: string }[];
      small?: { url?: string }[];
    } | null;
    isInAPriceBook?: boolean;
  };
}

/** Fetches Product-Variation?pid=X&format=ajax with the store cookies attached. */
async function fetchProductVariation(pid: string, storeCookie: string): Promise<ScrapedProduct | null> {
  const url = `${BASE}/${SITE_PATH}/Product-Variation?pid=${encodeURIComponent(pid)}&format=ajax`;
  const res = await fetchWithTimeout(url, 20000, { Cookie: storeCookie, Accept: 'application/json' });
  if (!res.ok) return null;

  let json: ProductVariationResponse;
  try {
    json = await res.json();
  } catch {
    return null;
  }

  const product = json.product;
  if (!product || !product.productName) return null;

  const rawId = product.id ?? pid;
  const ean = /^\d{13}$/.test(rawId) ? rawId : null;
  const salesValue = product.price?.sales?.value;
  const price = typeof salesValue === 'number' ? salesValue : null;
  const listValue = product.price?.list?.value;
  const originalPrice = typeof listValue === 'number' ? listValue : null;
  const isPromo = originalPrice != null && price != null && originalPrice > price;
  const imageUrl = product.images?.large?.[0]?.url ?? product.images?.small?.[0]?.url ?? null;

  return {
    rawId,
    ean,
    name: product.productName.replace(/\s+/g, ' ').trim(),
    brand: product.brand?.trim() || null,
    price,
    isPromo,
    originalPrice: isPromo ? originalPrice : null,
    imageUrl,
    isInAPriceBook: product.isInAPriceBook === true,
  };
}

function csvField(v: string): string {
  return `"${v.replace(/"/g, '""')}"`;
}

/** --limit=N caps this run to the first N pending URLs — manual/bridge testing only, unrelated to BATCH (the unattended-cron ceiling). */
function limitArg(): number | undefined {
  const raw = process.argv.find((a) => a.startsWith('--limit='))?.slice('--limit='.length);
  return raw ? Number(raw) : undefined;
}

async function main() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const directUrl = process.env.SCRAPER_DATABASE_URL;
  let directClient: Client | null = null;
  let db: ScraperDb;
  if (directUrl) {
    directClient = await connectAsServiceRole(directUrl); // throws with a clear message if the role can't SET ROLE service_role
    db = createDirectScraperDb(directClient);
  } else {
    db = createRestScraperDb(createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY));
  }
  console.log(`DB transport: ${directClient ? 'direct (SCRAPER_DATABASE_URL)' : 'REST (supabase-js)'}`);

  const store = await db.getStoreIdByName(STORE_NAME_PATTERN);
  if (!store) {
    console.error(`Store not found matching "${STORE_NAME_PATTERN}"`);
    if (directClient) await directClient.end();
    process.exit(1);
  }
  console.log(`Store: ${store.name} (${store.id})`);

  let storeCookie: string;
  try {
    storeCookie = await getStoreCookies();
  } catch (err) {
    console.error('Failed to activate Matão store context:', err instanceof Error ? err.message : err);
    process.exit(1);
  }

  const allUrls = await discoverProductUrls(storeCookie);

  const processed = existsSync(CHECKPOINT_FILE)
    ? new Set<string>(JSON.parse(readFileSync(CHECKPOINT_FILE, 'utf-8')).processedUrls ?? [])
    : new Set<string>();
  const limit = limitArg();
  const pending = allUrls.filter((u) => !processed.has(u.url)).slice(0, limit ?? BATCH);
  console.log(`${processed.size} already processed in prior runs. Processing ${pending.length} this run (${DRY_RUN ? 'DRY RUN' : 'LIVE — writing to DB'}).\n`);

  const reviewRows: string[] = ['url,pid,ean,name,brand,price,is_promo,image_url,status,matched_product_id,is_new_product'];
  let matchedByEan = 0;
  let matchedByFuzzy = 0;
  let created = 0;
  let notInPriceBook = 0;
  let skipped = 0;
  let failed = 0;

  for (const { url, categoryId } of pending) {
    try {
      const pid = pidFromUrl(url);
      if (!pid) {
        console.warn(`  [no pid parsed from URL] ${url}`);
        skipped++;
        processed.add(url);
        continue;
      }

      const parsed = await fetchProductVariation(pid, storeCookie);
      if (!parsed) {
        console.warn(`  [no product data / HTTP error] ${url}`);
        skipped++;
        processed.add(url);
        continue;
      }

      if (!parsed.isInAPriceBook || parsed.price === null) {
        console.warn(`  [not in Matão price book] ${parsed.name}`);
        notInPriceBook++;
        reviewRows.push(
          [url, parsed.rawId, parsed.ean ?? '', csvField(parsed.name), csvField(parsed.brand ?? ''), '', '', parsed.imageUrl ?? '', 'not_in_matao_pricebook', '', ''].join(','),
        );
        processed.add(url);
        continue;
      }

      const price = parsed.price; // narrowed non-null above

      if (DRY_RUN) {
        reviewRows.push(
          [url, parsed.rawId, parsed.ean ?? '', csvField(parsed.name), csvField(parsed.brand ?? ''), String(price), String(parsed.isPromo), parsed.imageUrl ?? '', 'dry_run', '', ''].join(','),
        );
      } else {
        let productId: string;
        let isNew = false;

        if (parsed.ean) {
          const existing = await db.findProductByEan(parsed.ean);
          if (existing) {
            productId = existing.id;
            matchedByEan++;
          } else {
            const result = await db.findOrCreateProduct({ name: parsed.name, categoryId, brand: parsed.brand ?? undefined, ean: parsed.ean, referencePrice: price, strictNoEanMatch: true });
            productId = result.id;
            isNew = result.isNew;
            if (result.isNew) {
              created++;
              // Set the real, retailer-confirmed EAN directly — more reliable
              // than findOrCreateProduct's own best-effort Cosmos name-search.
              // Guarded the same as Cosmos enrichment, so whichever write
              // lands first wins without clobbering the other.
              await db.updateProductIfNull(productId, 'ean', parsed.ean);
            } else {
              matchedByFuzzy++;
            }
          }
        } else {
          const result = await db.findOrCreateProduct({ name: parsed.name, categoryId, brand: parsed.brand ?? undefined, referencePrice: price, strictNoEanMatch: true });
          productId = result.id;
          isNew = result.isNew;
          if (result.isNew) created++;
          else matchedByFuzzy++;
        }

        if (parsed.imageUrl) {
          // Same guarded-once convention as the ean backfill above — never
          // overwrites an image another source already set.
          await db.updateProductIfNull(productId, 'image_url', parsed.imageUrl);
        }

        await db.upsertStorePrice({
          productId,
          storeId: store.id,
          price,
          isPromo: parsed.isPromo,
          source: 'crawler',
          confidence: 1.0,
          validUntil: null,
        });

        if (parsed.isPromo && parsed.originalPrice != null) {
          await db.syncCrawlerPromotion({
            productId,
            storeId: store.id,
            originalPrice: parsed.originalPrice,
            promoPrice: price,
          });
        }

        reviewRows.push(
          [url, parsed.rawId, parsed.ean ?? '', csvField(parsed.name), csvField(parsed.brand ?? ''), String(price), String(parsed.isPromo), parsed.imageUrl ?? '', 'written', productId, String(isNew)].join(','),
        );
      }

      console.log(`  [${parsed.name}] R$ ${price.toFixed(2)}${parsed.ean ? ` (EAN ${parsed.ean})` : ' (sem EAN)'}${parsed.isPromo ? ' [OFERTA]' : ''}`);
    } catch (err) {
      console.warn(`  [error] ${url}: ${err instanceof Error ? err.message : err}`);
      failed++;
    }

    processed.add(url);
    writeFileSync(CHECKPOINT_FILE, JSON.stringify({ processedUrls: [...processed] }));
    await sleep(DELAY_MS);
  }

  writeFileSync(REVIEW_FILE, reviewRows.join('\n'));

  console.log('\n════════════════════════════════════');
  console.log(`Processed this run: ${pending.length}`);
  console.log(`  Matched by EAN: ${matchedByEan}`);
  console.log(`  Matched by fuzzy name: ${matchedByFuzzy}`);
  console.log(`  New products created: ${created}`);
  console.log(`  Not in Matão price book (skipped): ${notInPriceBook}`);
  console.log(`  Skipped (no product data found): ${skipped}`);
  console.log(`  Failed: ${failed}`);
  console.log(`Total processed across all runs: ${processed.size} / ${allUrls.length}`);
  console.log(`Review file: ${REVIEW_FILE}`);
  if (DRY_RUN) console.log('\nDRY_RUN is true — nothing was written to the database. Review the CSV, then set DRY_RUN = false to apply.');

  // A checkpoint that only ever grows would make every future run a no-op
  // once the catalog is fully covered — fine for a one-time backfill, wrong
  // for a script meant to be re-run periodically to refresh prices. Clearing
  // it on a clean full pass (not on DRY_RUN, which never actually commits
  // anything) makes the next invocation a fresh full re-scrape instead of
  // permanently skipping every already-seen URL.
  if (!DRY_RUN && processed.size >= allUrls.length && existsSync(CHECKPOINT_FILE)) {
    unlinkSync(CHECKPOINT_FILE);
    console.log('Full catalog covered — checkpoint cleared so the next run does a fresh refresh.');
  }
  console.log('════════════════════════════════════');
  if (directClient) await directClient.end();
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
