/**
 * Scrapes Amarelinha Supermercados' public product catalog (OpenCart,
 * `online.grupoamarelinha.com.br`) and writes current prices into
 * store_prices for all 5 active "Amarelinha Loja N" rows in Matão.
 *
 * Validated live 2026-09-01 (see docs/scraping-viabilidade-matao.md, which
 * only confirmed the site *reaches* Matão — the mechanism, per-store price
 * question, and Loja 18 question below were this script's job to resolve):
 *
 * 1. STORE-SELECTION MECHANISM: pure HTTP, no browser/JS needed. The site's
 *    "Selecione sua loja favorita" modal is powered by two OpenCart routes:
 *      - GET /index.php?route=product/storebyproduct/stores&product_id=0
 *        → JSON list of `{store_id, store_title}`.
 *      - GET /index.php?route=product/storebyproduct/selectStore&store_id=N&pickup=0
 *        → sets a plain, non-httpOnly `favorite_store1=N` cookie (plus the
 *        OCSESSION cookie every request gets). Reproduced end-to-end with
 *        curl, zero cookies pre-seeded, confirmed via the page's
 *        "Você está na loja: N - ..." header text changing accordingly.
 *        `pickup=1` (a second code path found in the shared theme's JS,
 *        `common.js`) was tested too — byte-identical result to `pickup=0`.
 *
 * 2. CRITICAL FINDING — this "store" selector is per CITY, not per physical
 *    branch. The dropdown has exactly 8 options (one per city Amarelinha
 *    serves: Araraquara, Barrinha, Franca, Matão, Monte Alto, Pitangueiras,
 *    Ribeirão Preto, Sertãozinho) — "Matão - SP" is store_id 17. There is no
 *    second-stage picker anywhere on the site for the 5 individual physical
 *    Matão addresses (Lojas 15/16/17/18/21) — a `product/storebyproduct`
 *    zipcode/geolocation endpoint referencing per-branch resolution exists
 *    in the shared theme JS but errors out ("Latitude não definida" even
 *    with valid coords) and isn't wired to any live UI trigger — dead code
 *    from the template, not a real second flow.
 *
 * 3. PRICE DOES NOT VARY — not by branch (there's no mechanism to even
 *    select a branch) and, more surprisingly, not even by CITY. Tested 129
 *    products across 2 categories (meat/poultry — corporate-contract
 *    pricing — and beverages — the category most likely to carry regional
 *    promos) comparing Matão (store_id 17) against Araraquara (store_id
 *    19, ~150km away, independent session/cookie jar each): 129/129
 *    identical prices, zero diffs. Conclusion: Amarelinha runs one shared
 *    price list for the whole online catalog. All 5 Matão store rows get
 *    the same scraped price — no per-store loop needed.
 *
 * 4. LOJA 18: not "unavailable online" in any way distinguishable from the
 *    other 4 — none of the 5 physical addresses has an individual online
 *    identity; only the shared "Matão" city catalog (store_id 17) does. So
 *    Loja 18 is written the same as the other 4, not excluded.
 *
 * EAN: product detail pages expose a real barcode via "Código de Barras: X"
 * (separate from "Código Interno: Y", the internal/slug id) plus a "Marca:
 * X" field. For weight-based (Kg) items this "Código de Barras" is a
 * zero-padded internal code, not a real GS1 barcode — it still passes the
 * EAN-13 check-digit algorithm (verified on a sample), so checksum alone
 * doesn't discriminate real from fake here. isLikelyRealEan() below rejects
 * codes with 3+ leading zeros as the discriminator instead.
 *
 * DRY_RUN defaults to true (writes a review CSV, no DB writes) — same
 * caution as the other scrape-*.ts scripts. Flip to false once a sample
 * run looks right.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/scrape-amarelinha-prices.ts
 *
 * Required env vars:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js';
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { findOrCreateProduct } from '../src/lib/product-match';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const STORE_NAME_PATTERN = 'Amarelinha%'; // matches all 5 "Amarelinha Loja N" rows
const BASE = 'https://online.grupoamarelinha.com.br';
const USER_AGENT = 'Mozilla/5.0 (compatible; PoupBot/1.0; +lima.galhardo@gmail.com)';
const DELAY_MS = 500;
const BATCH = 3000; // deliberately >> catalog size (~1.4k) — clears everything in one run, required for the unattended GH Actions cron (its checkpoint doesn't survive across daily runs)

// OpenCart's internal store_id for the CITY of Matão (see file header —
// this is a city-wide id, not tied to any single "Loja N" physical address).
const MATAO_CITY_STORE_ID = 17;

const DISCOVERY_CACHE_FILE = resolve(process.cwd(), 'scripts/.scrape-amarelinha-urls.json');
const CHECKPOINT_FILE = resolve(process.cwd(), 'scripts/.scrape-amarelinha-checkpoint.json');
const REVIEW_FILE = resolve(process.cwd(), 'scripts/.scrape-amarelinha-review.csv');

// Top-level category IDs from the site's nav menu (product/category&path=).
// Confirmed each top-level id returns the FULL rolled-up product list for
// all its subcategories on a single page (subcategory products are a
// strict subset of the parent's listing; page=2 is a no-op) — no
// pagination needed, unlike Jaú Serve/Tenda.
const CATEGORY_IDS = [
  '10002', '10003', '10004', '10006', '10007', '10008', '10009', '10014',
  '10015', '10017', '10021', '10024', '10025', '10058', '10066', '10817',
];

// Maps each category id to our internal categories.id taxonomy (12 rows —
// see the `categories` table) — real names confirmed live via each
// category page's own <h1>. Several map to the same internal bucket
// (Matinais/Cereais e Farináceos/Molhos.../Doces e Sobremesas/Naturais e
// Dietéticos/Biscoitos e Salgadinhos are all cat_alimentos) since our
// taxonomy is coarser than the site's own.
const CATEGORY_TO_INTERNAL: Record<string, string> = {
  '10002': 'cat_bebidas', // Bebidas
  '10003': 'cat_limpeza', // Limpeza
  '10004': 'cat_higiene', // Higiene e Perfumaria
  '10006': 'cat_carnes', // Açougue
  '10007': 'cat_laticinios', // Frios e Laticínios
  '10008': 'cat_padaria', // Padaria
  '10009': 'cat_hortifruti', // Hortifrúti
  '10014': 'cat_alimentos', // Matinais
  '10015': 'cat_alimentos', // Cereais e Farináceos
  '10017': 'cat_alimentos', // Molhos, Conservas e Condimentos
  '10021': 'cat_alimentos', // Doces e Sobremesas
  '10024': 'cat_alimentos', // Naturais e Dietéticos
  '10025': 'cat_alimentos', // Biscoitos e Salgadinhos
  '10058': 'cat_bebes', // Higiene Infantil
  '10066': 'cat_outros', // Bazar
  '10817': 'cat_pet', // Pet Shop
};

// Set to false only after reviewing a sample run's output.
const DRY_RUN = false;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchWithTimeout(url: string, cookie: string, timeoutMs = 20000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Cookie: cookie },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Establishes the Matão store context via plain HTTP (no browser needed —
 * see file header point 1) and returns a Cookie header string to reuse on
 * every subsequent request.
 */
async function getMataoSessionCookie(): Promise<string> {
  const jar = new Map<string, string>();
  const absorb = (res: Response) => {
    for (const raw of res.headers.getSetCookie()) {
      const [pair] = raw.split(';');
      const eq = pair.indexOf('=');
      if (eq > 0) jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
    }
  };

  const home = await fetch(BASE + '/', { headers: { 'User-Agent': USER_AGENT } });
  absorb(home);

  const cookieHeader = () => [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ');

  const select = await fetch(
    `${BASE}/index.php?route=product/storebyproduct/selectStore&store_id=${MATAO_CITY_STORE_ID}&pickup=0`,
    { headers: { 'User-Agent': USER_AGENT, Cookie: cookieHeader() } },
  );
  absorb(select);

  if (!jar.has('favorite_store1')) {
    throw new Error('selectStore did not set favorite_store1 cookie — site mechanism may have changed');
  }
  return cookieHeader();
}

interface DiscoveredUrl {
  url: string;
  categoryId: string; // our internal categories.id, from the first category page this URL was seen under
}

async function discoverProductUrls(cookie: string): Promise<DiscoveredUrl[]> {
  if (existsSync(DISCOVERY_CACHE_FILE)) {
    console.log('Loading cached product URL list...');
    return JSON.parse(readFileSync(DISCOVERY_CACHE_FILE, 'utf-8'));
  }

  console.log('Crawling category pages to discover product URLs (first run — cached afterwards)...');
  const byUrl = new Map<string, DiscoveredUrl>();

  for (const path of CATEGORY_IDS) {
    const catUrl = `${BASE}/index.php?route=product/category&path=${path}`;
    try {
      const res = await fetchWithTimeout(catUrl, cookie, 20000);
      if (!res.ok) {
        console.warn(`  [${path}] HTTP ${res.status}`);
        continue;
      }
      const html = await res.text();
      const matches = [...html.matchAll(/online\.grupoamarelinha\.com\.br\/([a-z0-9-]+-(\d{4,}))['"]/g)];
      let pageUrls = 0;
      for (const m of matches) {
        const url = `${BASE}/${m[1]}`;
        if (byUrl.has(url)) continue; // first category page a URL appears under wins
        byUrl.set(url, { url, categoryId: CATEGORY_TO_INTERNAL[path] ?? 'cat_alimentos' });
        pageUrls++;
      }
      console.log(`  ${path}: ${pageUrls} product links found`);
    } catch (err) {
      console.warn(`  [${path}] error: ${err instanceof Error ? err.message : err}`);
    }
    await sleep(300);
  }

  const result = [...byUrl.values()];
  writeFileSync(DISCOVERY_CACHE_FILE, JSON.stringify(result));
  console.log(`Total unique product URLs discovered: ${result.length}\n`);
  return result;
}

interface ScrapedProduct {
  ean: string | null;
  name: string;
  brand: string | null;
  price: number;
  isPromo: boolean;
}

/**
 * Rejects EAN candidates with 3+ leading zeros as near-certainly a
 * zero-padded internal code rather than a real GS1 barcode — see file
 * header. Checksum-valid is necessary but not sufficient (verified both a
 * real EAN and a known-fake zero-padded one pass the check-digit formula).
 *
 * shortcut: "3+ leading zeros" is a heuristic, not a certainty — a
 * legitimate GS1 code that happens to start with 000 would be wrongly
 * rejected, and a fake zero-padded code with only 1-2 leading zeros would
 * slip through as if real — upgrade: cross-check candidates against a
 * barcode database (e.g. Cosmos) before trusting/rejecting, or track
 * false-positive/negative rate once enough of this retailer's products
 * have been reviewed to know the real failure rate.
 */
function isLikelyRealEan(code: string): boolean {
  if (!/^\d{13}$/.test(code)) return false;
  if (/^0{3,}/.test(code)) return false;

  const digits = code.split('').map(Number);
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += digits[i] * (i % 2 === 0 ? 1 : 3);
  }
  const check = (10 - (sum % 10)) % 10;
  return check === digits[12];
}

/** Converts a pt-BR formatted price ("1.234,56" or "5,49") to a float. */
function parsePtBrPrice(raw: string): number {
  return parseFloat(raw.replace(/\./g, '').replace(',', '.'));
}

function parseProductPage(html: string): ScrapedProduct | null {
  const nameMatch = html.match(/class="title-detail">([^<]+)<\/h1>/);
  const priceMatch = html.match(/class="current-price[^"]*">R\$\s*([\d.,]+)/);
  if (!nameMatch || !priceMatch) return null;

  const price = parsePtBrPrice(priceMatch[1]);
  if (!Number.isFinite(price) || price <= 0) return null;

  const isPromo = /class="old-price/.test(html);

  const eanMatch = html.match(/Código de Barras:\s*(\d+)/);
  const ean = eanMatch && isLikelyRealEan(eanMatch[1]) ? eanMatch[1] : null;

  // "Marca" is a real brand for packaged goods (e.g. "Piracanjuba") but for
  // weight-based (Kg) items it's often a category-like placeholder (e.g.
  // "Bovino", "Aves") rather than a true brand.
  // shortcut: passed through as-is to findOrCreateProduct's soft brand
  // filter (isBrandCompatible only rejects on a clear mismatch, it doesn't
  // require a match) rather than trying to detect and null out
  // placeholder values — upgrade: if fuzzy-match quality on weight-based
  // items looks bad in review, exclude "Marca" for products whose name
  // ends in " Kg" before passing it to findOrCreateProduct.
  const brandMatch = html.match(/Marca:\s*([^<]+)<\/li>/);
  const brand = brandMatch ? brandMatch[1].trim() : null;

  return {
    ean,
    name: nameMatch[1].replace(/\s+/g, ' ').trim(),
    brand,
    price,
    isPromo,
  };
}

async function main() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const { data: stores, error: storesError } = await supabase
    .from('stores')
    .select('id, name')
    .ilike('name', STORE_NAME_PATTERN)
    .eq('is_active', true);

  if (storesError || !stores || stores.length === 0) {
    console.error(`No active stores found matching "${STORE_NAME_PATTERN}":`, storesError?.message);
    process.exit(1);
  }
  console.log(`Stores (all get the same scraped price — see file header point 3):`);
  for (const s of stores) console.log(`  ${s.name} (${s.id})`);
  console.log('');

  const cookie = await getMataoSessionCookie();
  console.log('Matão session established via plain HTTP (favorite_store1 cookie set).\n');

  const allUrls = await discoverProductUrls(cookie);

  const processed = existsSync(CHECKPOINT_FILE)
    ? new Set<string>(JSON.parse(readFileSync(CHECKPOINT_FILE, 'utf-8')).processedUrls ?? [])
    : new Set<string>();
  const pending = allUrls.filter((u) => !processed.has(u.url)).slice(0, BATCH);
  console.log(`${processed.size} already processed in prior runs. Processing ${pending.length} this run (${DRY_RUN ? 'DRY RUN' : 'LIVE — writing to DB'}).\n`);

  const reviewRows: string[] = ['url,ean,brand,name,price,is_promo,matched_product_id,is_new_product'];
  let matchedByEan = 0;
  let matchedByFuzzy = 0;
  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (const { url, categoryId } of pending) {
    try {
      const res = await fetchWithTimeout(url, cookie, 20000);
      if (!res.ok) {
        console.warn(`  [HTTP ${res.status}] ${url}`);
        failed++;
        processed.add(url);
        continue;
      }
      const html = await res.text();
      const parsed = parseProductPage(html);
      if (!parsed) {
        console.warn(`  [no price/name found] ${url}`);
        skipped++;
        processed.add(url);
        continue;
      }

      if (DRY_RUN) {
        reviewRows.push([
          url,
          parsed.ean ?? '',
          parsed.brand ? `"${parsed.brand.replace(/"/g, '""')}"` : '',
          `"${parsed.name.replace(/"/g, '""')}"`,
          parsed.price,
          String(parsed.isPromo),
          '',
          '',
        ].join(','));
      } else {
        let productId: string;
        let isNew = false;

        if (parsed.ean) {
          const { data: existing } = await supabase.from('products').select('id').eq('ean', parsed.ean).maybeSingle();
          if (existing) {
            productId = existing.id;
            matchedByEan++;
          } else {
            const result = await findOrCreateProduct(supabase, {
              name: parsed.name,
              categoryId,
              brand: parsed.brand ?? undefined,
              ean: parsed.ean,
              referencePrice: parsed.price,
              strictNoEanMatch: true,
            });
            productId = result.id;
            isNew = result.isNew;
            if (result.isNew) {
              created++;
              // Set the real, retailer-confirmed EAN directly — more
              // reliable than findOrCreateProduct's own best-effort Cosmos
              // name-search. Guarded by .is('ean', null) same as Cosmos
              // enrichment, so whichever write lands first wins without
              // clobbering the other.
              await supabase.from('products').update({ ean: parsed.ean }).eq('id', productId).is('ean', null);
            } else {
              matchedByFuzzy++;
            }
          }
        } else {
          const result = await findOrCreateProduct(supabase, {
            name: parsed.name,
            categoryId,
            brand: parsed.brand ?? undefined,
            referencePrice: parsed.price,
            strictNoEanMatch: true,
          });
          productId = result.id;
          isNew = result.isNew;
          if (result.isNew) created++;
          else matchedByFuzzy++;
        }

        // Same price for all 5 stores — confirmed uniform across the whole
        // chain (see file header point 3), not just within Matão.
        for (const store of stores) {
          const { error: upsertError } = await supabase.from('store_prices').upsert(
            {
              product_id: productId,
              store_id: store.id,
              price: parsed.price,
              is_promo: parsed.isPromo,
              source: 'crawler',
              confidence: 1.0,
              valid_until: null,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'product_id,store_id' },
          );
          if (upsertError) console.warn(`  [store_prices upsert failed] ${store.name} / ${url}: ${upsertError.message}`);
        }

        reviewRows.push([
          url,
          parsed.ean ?? '',
          parsed.brand ? `"${parsed.brand.replace(/"/g, '""')}"` : '',
          `"${parsed.name.replace(/"/g, '""')}"`,
          parsed.price,
          String(parsed.isPromo),
          productId,
          String(isNew),
        ].join(','));
      }

      console.log(`  [${parsed.name}] R$ ${parsed.price.toFixed(2)}${parsed.ean ? ` (EAN ${parsed.ean})` : ' (sem EAN)'}${parsed.brand ? ` [${parsed.brand}]` : ''}${parsed.isPromo ? ' [OFERTA]' : ''}`);
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
  console.log(`  Skipped (no price/name found): ${skipped}`);
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
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
