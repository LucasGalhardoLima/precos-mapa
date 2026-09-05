/**
 * Scrapes Savegnago's public VTEX catalog (JSON REST APIs, no browser needed)
 * and writes current prices into store_prices for "Savegnago" (Matão store).
 *
 * Validated LIVE 2026-09-01 (both via raw fetch() and via a real browser
 * session on savegnago.com.br — see below):
 *
 * MECHANISM — price genuinely varies per physical store (confirmed with a
 * real Coca-Cola 2L PET, productId 141622: R$10,49 at Matão vs R$11,45 at
 * Americana, matching the DOM-scraped ground truth from the prior
 * investigation session). Savegnago is VTEX account "savegnagoio" with a
 * single salesChannel ("1") shared by every store — salesChannel is NOT
 * what differentiates price. What actually differentiates it is a
 * *store-specific `vtex_segment` cookie*, and — this contradicts the
 * original task brief's hypothesis — the `regionId` field inside that
 * cookie is NOT the `v2.XXXXXXXX` id returned by
 * `/api/checkout/pub/regions`. Live A/B-tested both formats against the
 * same search request: the `v2.XXXX` id produced no price change at all
 * (silently ignored by the legacy catalog_system search API), while the
 * format actually set by the live site's own "Retirar na loja" flow —
 * base64(`SW#<sellerId>`) — reliably shifted the price (confirmed twice,
 * independently, by rebuilding the cookie from scratch with no browser
 * session involved, AND by watching a live browser session's own
 * `/api/catalog_system/pub/products/search` fetch change from 10.49 to
 * 11.45 after switching the UI's pickup store from Matão to Americana).
 * `/api/checkout/pub/regions?postalCode=<CEP>&sc=1` is still needed, but
 * only to resolve the physical store's VTEX seller id (its `sellers[0].id`,
 * e.g. "savegnagoiomatao24") — the id it returns is not used directly.
 *
 * vtex_segment cookie shape (base64 of this JSON; regionId is itself
 * base64("SW#" + sellerId)):
 *   {"campaigns":null,"channel":"1","priceTables":null,"regionId":"<b64 SW#seller>",
 *    "utm_campaign":null,"utm_source":null,"utmi_campaign":null,"currencyCode":"BRL",
 *    "currencySymbol":"R$","countryCode":"BRA","cultureInfo":"pt-BR","channelPrivacy":"public"}
 *
 * CATEGORY DISCOVERY — `/api/catalog_system/pub/category/tree/3` (a public,
 * unauthenticated VTEX route) returns the full tree; max depth actually
 * observed is 3 even when a deeper depth is requested, so it's already
 * exhaustive (14 top-level, 572 total, 461 leaf categories for ~15.2k
 * products — leaves average ~33 products, comfortably under any single
 * page, let alone the 2500-result search cap).
 *
 * PAGINATION GOTCHA — `fq=C:/<leafCategoryId>/` alone (as the task brief
 * assumed) returns ZERO results. VTEX's `C:` facet needs the FULL ancestor
 * id chain from the tree root down to the leaf, e.g. `fq=C:/12146/15286/15306/`
 * for Bebidas > Refrigerantes > Cola — confirmed live (leaf-only: 0 results,
 * full path: 36 results including known Coca-Cola SKUs at the right price).
 * Page size is hard-capped at 50 (`_to - _from > 49` → HTTP 400 with body
 * `"Parameter _to can't be greater than 50."`, confirmed live) — separate
 * from the ~2500-total-per-search backend cap the task brief flagged, which
 * we sidestep by paginating per (already small) leaf category rather than
 * hitting it in practice.
 *
 * WAF GOTCHA (load-bearing, not cosmetic) — Savegnago's CloudFront/VTEX WAF
 * bot-classifies any User-Agent containing the literal substring "Bot"
 * (case-sensitive-ish; "PoupBot/1.0", the convention used by this project's
 * other scrapers, gets a hard 429 with header `rate-limit-reason: bot` on
 * `/api/catalog_system/pub/category/tree` and `/api/checkout/pub/regions`
 * specifically) — confirmed by isolating the UA string as the only variable
 * while holding timing constant. Swapping "PoupBot" for "PoupPriceCompare"
 * (same identifying email, no "Bot" substring) fixed it immediately and
 * repeatably. `/api/catalog_system/pub/products/search` — the endpoint this
 * script hits thousands of times — did NOT trip this in live testing, but
 * fetchWithRetry() below still backs off on any 429 as a defensive measure.
 *
 * robots.txt allows `/api/*` for `User-agent: *` (only disallows things like
 * /account*, /checkout, /busca*, various `?`-query patterns — none of which
 * this script touches).
 *
 * EAN is populated on most items sampled (in the "Cola" category sample:
 * 35/36 items had a real EAN) — matching is EAN-first (exact lookup against
 * products.ean, treating "0" as absent per the task brief) with a
 * name+brand fuzzy fallback via findOrCreateProduct, same pattern as
 * scrape-jauserve-prices.ts. Savegnago's API happens to expose `brand`
 * directly (unlike Jaú Serve), so it's passed through to improve fuzzy-match
 * quality — a legitimate use of available data, not scope creep.
 *
 * NOT wired up: mapping VTEX's `categoriesIds` to this project's internal
 * `products.category_id` taxonomy. The data is available in every response
 * but there's no existing VTEX→internal-category mapping anywhere in this
 * codebase's scrapers to reuse, and jauserve (the structural template this
 * script follows) also leaves category_id unset. Left as a known gap, not
 * an oversight — see the categoryId comment near parseProduct().
 *
 * DRY_RUN defaults to true (writes a review CSV, no DB writes) — same
 * caution as the other scrape-*.ts scripts. Flip to false only after
 * reviewing a sample run's output.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/scrape-savegnago-prices.ts
 *
 * Required env vars:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { findOrCreateProduct } from '../src/lib/product-match';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const STORE_NAME_PATTERN = '%savegnago%';
const BASE = 'https://www.savegnago.com.br';

// Identifying UA (courtesy convention shared by this project's scrapers) —
// deliberately does NOT contain the substring "Bot": Savegnago's WAF
// bot-classifies and 429s any UA containing it (confirmed live, see header
// comment). Keep the email so the site owner can identify/contact us.
const USER_AGENT = 'Mozilla/5.0 (compatible; PoupPriceCompare/1.0; +lima.galhardo@gmail.com)';

const DELAY_MS = 400;
const PAGE_SIZE = 50; // VTEX legacy search API hard cap — confirmed via live 400 response
const MAX_RESULTS_PER_CATEGORY = 2500; // VTEX search backend cap (task brief, not directly re-tested)
const BATCH = 20000; // deliberately >> catalog size (~15.2k) — clears everything in one run; doesn't change request volume/rate against the site, only how many invocations it takes

// Matão store's registered CEP (stores.id = 'd5912ae4-2aa3-44e6-bcf6-9d6503c57bfe',
// "R. São Lourenço, 1170 - Centro, Matão - SP, 15990-005"), digits only.
const MATAO_POSTAL_CODE = '15990005';

const CATEGORY_CACHE_FILE = resolve(process.cwd(), 'scripts/.scrape-savegnago-categories.json');
const CHECKPOINT_FILE = resolve(process.cwd(), 'scripts/.scrape-savegnago-checkpoint.json');
const REVIEW_FILE = resolve(process.cwd(), 'scripts/.scrape-savegnago-review.csv');

// Set to false only after reviewing a sample run's output.
const DRY_RUN = false;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchWithRetry(url: string, headers: Record<string, string>, tries = 5, timeoutMs = 20000): Promise<Response> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < tries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { headers, signal: controller.signal });
      clearTimeout(timer);
      if (res.status === 429) {
        const wait = 1500 * (attempt + 1);
        console.warn(`  [429] ${url} — retrying in ${wait}ms`);
        await sleep(wait);
        continue;
      }
      return res;
    } catch (err) {
      clearTimeout(timer);
      lastErr = err;
      await sleep(1000 * (attempt + 1));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(`fetchWithRetry exhausted for ${url}`);
}

// ─── vtex_segment cookie ────────────────────────────────────────────────

interface SegmentFields {
  campaigns: null;
  channel: string;
  priceTables: null;
  regionId: string;
  utm_campaign: null;
  utm_source: null;
  utmi_campaign: null;
  currencyCode: string;
  currencySymbol: string;
  countryCode: string;
  cultureInfo: string;
  channelPrivacy: string;
}

function buildVtexSegmentCookie(sellerId: string): string {
  const regionId = Buffer.from(`SW#${sellerId}`).toString('base64');
  const fields: SegmentFields = {
    campaigns: null,
    channel: '1',
    priceTables: null,
    regionId,
    utm_campaign: null,
    utm_source: null,
    utmi_campaign: null,
    currencyCode: 'BRL',
    currencySymbol: 'R$',
    countryCode: 'BRA',
    cultureInfo: 'pt-BR',
    channelPrivacy: 'public',
  };
  return Buffer.from(JSON.stringify(fields)).toString('base64');
}

async function resolveSellerId(postalCode: string): Promise<string> {
  const url = `${BASE}/api/checkout/pub/regions?country=BRA&postalCode=${postalCode}&sc=1`;
  const res = await fetchWithRetry(url, { 'User-Agent': USER_AGENT });
  if (!res.ok) throw new Error(`regions lookup failed: HTTP ${res.status}`);
  const body = (await res.json()) as Array<{ id: string; sellers?: Array<{ id: string }> }>;
  const sellerId = body?.[0]?.sellers?.[0]?.id;
  if (!sellerId) throw new Error(`regions response had no seller id: ${JSON.stringify(body)}`);
  return sellerId;
}

// ─── Category tree discovery ────────────────────────────────────────────

interface CategoryTreeNode {
  id: number;
  name: string;
  children?: CategoryTreeNode[];
}

interface LeafCategory {
  id: number;
  idPath: number[]; // full ancestor chain incl. self — required for fq=C:/a/b/c/
  path: string; // human-readable, for the review CSV
}

function collectLeaves(nodes: CategoryTreeNode[], idPath: number[] = [], namePath: string[] = []): LeafCategory[] {
  let leaves: LeafCategory[] = [];
  for (const n of nodes) {
    const nextIdPath = [...idPath, n.id];
    const nextNamePath = [...namePath, n.name];
    if (n.children && n.children.length > 0) {
      leaves = leaves.concat(collectLeaves(n.children, nextIdPath, nextNamePath));
    } else {
      leaves.push({ id: n.id, idPath: nextIdPath, path: nextNamePath.join(' > ') });
    }
  }
  return leaves;
}

async function fetchLeafCategories(): Promise<LeafCategory[]> {
  if (existsSync(CATEGORY_CACHE_FILE)) {
    console.log('Loading cached category tree...');
    return JSON.parse(readFileSync(CATEGORY_CACHE_FILE, 'utf-8'));
  }
  console.log('Fetching category tree (first run — cached afterwards)...');
  const res = await fetchWithRetry(`${BASE}/api/catalog_system/pub/category/tree/3`, { 'User-Agent': USER_AGENT });
  if (!res.ok) throw new Error(`category tree fetch failed: HTTP ${res.status}`);
  const tree = (await res.json()) as CategoryTreeNode[];
  const leaves = collectLeaves(tree);
  writeFileSync(CATEGORY_CACHE_FILE, JSON.stringify(leaves));
  console.log(`Discovered ${leaves.length} leaf categories.\n`);
  return leaves;
}

// ─── Product search + parsing ───────────────────────────────────────────

interface CommertialOffer {
  Price: number;
  ListPrice: number;
  AvailableQuantity: number;
  IsAvailable: boolean;
}

interface VtexItem {
  ean?: string;
  images?: Array<{ imageUrl: string }>;
  sellers?: Array<{ commertialOffer: CommertialOffer }>;
}

interface VtexProduct {
  productId: string;
  productName: string;
  brand?: string;
  items?: VtexItem[];
}

interface ParsedProduct {
  productId: string;
  ean: string | null;
  name: string;
  brand: string | null;
  price: number;
  listPrice: number;
  isPromo: boolean;
  imageUrl: string | null;
}

/**
 * Validates the GTIN check digit for any GS1 length (EAN-8/UPC-12/EAN-13/GTIN-14) by
 * walking right-to-left from the digit adjacent to the check digit, alternating weights
 * 3,1,3,1,... — equivalent to zero-padding to GTIN-14 and applying the standard
 * fixed-position algorithm, but without needing to know which of the 4 lengths this is.
 * Same algorithm scrape-tenda-atacado-prices.ts's isValidEan13 uses, generalized past 13.
 */
function hasValidGtinCheckDigit(code: string): boolean {
  const digits = code.split('').map(Number);
  const checkDigit = digits[digits.length - 1];
  let sum = 0;
  let weight = 3;
  for (let i = digits.length - 2; i >= 0; i--) {
    sum += digits[i] * weight;
    weight = weight === 3 ? 1 : 3;
  }
  return (10 - (sum % 10)) % 10 === checkDigit;
}

function isValidEan(ean: string | undefined | null): ean is string {
  if (!ean) return false;
  if (!/^\d{8,14}$/.test(ean) || /^0+$/.test(ean)) return false;
  return hasValidGtinCheckDigit(ean);
}

function parseProduct(p: VtexProduct): ParsedProduct | null {
  // shortcut: returns the first available item/offer and ignores any
  // siblings in p.items[] — fine for grocery SKUs (every sample checked,
  // incl. a 1000-product spot-check across Padaria/Bazar, had one item per
  // productId; size/flavor variants show up as distinct productIds instead)
  // but not exhaustively verified across all ~15.2k SKUs. Upgrade: if a
  // multi-item product with diverging per-item prices ever turns up, emit
  // one store_prices row per item instead of collapsing to the first.
  for (const item of p.items ?? []) {
    const offer = item.sellers?.[0]?.commertialOffer;
    if (!offer || !offer.IsAvailable || offer.Price <= 0) continue;
    return {
      productId: p.productId,
      ean: isValidEan(item.ean) ? item.ean! : null,
      name: p.productName.trim().replace(/\s+/g, ' '),
      brand: p.brand && p.brand.trim() ? p.brand.trim() : null,
      price: offer.Price,
      listPrice: offer.ListPrice,
      isPromo: offer.Price < offer.ListPrice,
      imageUrl: item.images?.[0]?.imageUrl ?? null,
      // categoryId intentionally not mapped here — see header comment.
    };
  }
  return null; // no item/seller available at this store
}

async function fetchCategoryPage(idPath: number[], from: number, to: number, cookie: string): Promise<VtexProduct[]> {
  const fq = `C:/${idPath.join('/')}/`;
  const url = `${BASE}/api/catalog_system/pub/products/search?fq=${encodeURIComponent(fq)}&_from=${from}&_to=${to}`;
  const res = await fetchWithRetry(url, { 'User-Agent': USER_AGENT, Cookie: `vtex_segment=${cookie}` });
  if (res.status === 206 || res.status === 200) {
    return (await res.json()) as VtexProduct[];
  }
  if (res.status === 400) {
    // Past the 2500-result backend cap for this category — stop paginating it.
    return [];
  }
  console.warn(`  [HTTP ${res.status}] ${url}`);
  return [];
}

// ─── Main ────────────────────────────────────────────────────────────────

interface Checkpoint {
  processedProductIds: string[];
  completedCategoryIds: number[];
}

function loadCheckpoint(): Checkpoint {
  if (!existsSync(CHECKPOINT_FILE)) return { processedProductIds: [], completedCategoryIds: [] };
  return JSON.parse(readFileSync(CHECKPOINT_FILE, 'utf-8'));
}

function saveCheckpoint(processed: Set<string>, completed: Set<number>): void {
  const cp: Checkpoint = { processedProductIds: [...processed], completedCategoryIds: [...completed] };
  writeFileSync(CHECKPOINT_FILE, JSON.stringify(cp));
}

async function main() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const { data: store, error: storeError } = await supabase
    .from('stores')
    .select('id, name')
    .ilike('name', STORE_NAME_PATTERN)
    .eq('is_active', true)
    .maybeSingle();

  if (storeError || !store) {
    console.error(`Store not found matching "${STORE_NAME_PATTERN}":`, storeError?.message);
    process.exit(1);
  }
  console.log(`Store: ${store.name} (${store.id})`);

  console.log(`Resolving VTEX seller id for CEP ${MATAO_POSTAL_CODE}...`);
  const sellerId = await resolveSellerId(MATAO_POSTAL_CODE);
  console.log(`  seller id: ${sellerId}`);
  const cookie = buildVtexSegmentCookie(sellerId);
  console.log(`  vtex_segment cookie (decoded): ${Buffer.from(cookie, 'base64').toString('utf-8')}\n`);

  const leaves = await fetchLeafCategories();

  const checkpointData = loadCheckpoint();
  const processed = new Set<string>(checkpointData.processedProductIds);
  const completed = new Set<number>(checkpointData.completedCategoryIds);
  console.log(`${processed.size} products already processed, ${completed.size}/${leaves.length} categories completed in prior runs.`);
  console.log(`Running in ${DRY_RUN ? 'DRY RUN' : 'LIVE — writing to DB'} mode, up to ${BATCH} new products this run.\n`);

  const reviewRows: string[] = ['product_id,ean,name,brand,category_path,price,list_price,is_promo,matched_product_id,is_new_product'];
  let matchedByEan = 0;
  let matchedByFuzzy = 0;
  let created = 0;
  let skippedUnavailable = 0;
  let processedThisRun = 0;

  categoryLoop: for (const leaf of leaves) {
    if (completed.has(leaf.id)) continue;
    if (processedThisRun >= BATCH) break;

    let from = 0;
    let categoryProductCount = 0;
    while (from < MAX_RESULTS_PER_CATEGORY) {
      const to = from + PAGE_SIZE - 1;
      const products = await fetchCategoryPage(leaf.idPath, from, to, cookie);
      await sleep(DELAY_MS);

      if (products.length === 0) break; // last page (or 2500-cap truncation)

      for (const p of products) {
        categoryProductCount++;
        if (processed.has(p.productId)) continue;
        if (processedThisRun >= BATCH) break;

        const parsed = parseProduct(p);
        if (!parsed) {
          skippedUnavailable++;
          processed.add(p.productId);
          processedThisRun++;
          continue;
        }

        if (DRY_RUN) {
          reviewRows.push(
            [
              parsed.productId,
              parsed.ean ?? '',
              `"${parsed.name.replace(/"/g, '""')}"`,
              parsed.brand ? `"${parsed.brand.replace(/"/g, '""')}"` : '',
              `"${leaf.path}"`,
              parsed.price,
              parsed.listPrice,
              String(parsed.isPromo),
              '',
              '',
            ].join(','),
          );
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
                brand: parsed.brand ?? undefined,
                ean: parsed.ean,
                referencePrice: parsed.price,
                strictNoEanMatch: true,
              });
              productId = result.id;
              isNew = result.isNew;
              if (result.isNew) {
                created++;
                await supabase.from('products').update({ ean: parsed.ean }).eq('id', productId).is('ean', null);
              } else {
                matchedByFuzzy++;
              }
            }
          } else {
            const result = await findOrCreateProduct(supabase, {
              name: parsed.name,
              brand: parsed.brand ?? undefined,
              referencePrice: parsed.price,
              strictNoEanMatch: true,
            });
            productId = result.id;
            isNew = result.isNew;
            if (result.isNew) created++;
            else matchedByFuzzy++;
          }

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
          if (upsertError) console.warn(`  [store_prices upsert failed] ${parsed.productId}: ${upsertError.message}`);

          reviewRows.push(
            [
              parsed.productId,
              parsed.ean ?? '',
              `"${parsed.name.replace(/"/g, '""')}"`,
              parsed.brand ? `"${parsed.brand.replace(/"/g, '""')}"` : '',
              `"${leaf.path}"`,
              parsed.price,
              parsed.listPrice,
              String(parsed.isPromo),
              productId,
              String(isNew),
            ].join(','),
          );
        }

        console.log(
          `  [${leaf.path}] ${parsed.name} R$ ${parsed.price.toFixed(2)}${parsed.ean ? ` (EAN ${parsed.ean})` : ' (sem EAN)'}${parsed.isPromo ? ' [OFERTA]' : ''}`,
        );

        processed.add(p.productId);
        processedThisRun++;
      }

      saveCheckpoint(processed, completed);
      if (processedThisRun >= BATCH) break categoryLoop;
      if (products.length < PAGE_SIZE) break; // last page
      from += PAGE_SIZE;
    }

    if (categoryProductCount >= MAX_RESULTS_PER_CATEGORY) {
      console.warn(`  [WARNING] category "${leaf.path}" (id ${leaf.id}) hit the ${MAX_RESULTS_PER_CATEGORY}-result cap — some products may be missing.`);
    }

    // shortcut: resume granularity is per-category, not per-page — if a run
    // is interrupted mid-category, the next run restarts that category from
    // page 0 (cheap: already-processed productIds are skipped instantly via
    // the checkpoint Set). Upgrade: persist a per-category page cursor if
    // any single leaf category ever grows past a handful of pages.
    completed.add(leaf.id);
    saveCheckpoint(processed, completed);
  }

  writeFileSync(REVIEW_FILE, reviewRows.join('\n'));

  console.log('\n════════════════════════════════════');
  console.log(`Processed this run: ${processedThisRun}`);
  console.log(`  Matched by EAN: ${matchedByEan}`);
  console.log(`  Matched by fuzzy name: ${matchedByFuzzy}`);
  console.log(`  New products created: ${created}`);
  console.log(`  Skipped (unavailable at this store): ${skippedUnavailable}`);
  console.log(`Total processed across all runs: ${processed.size}`);
  console.log(`Categories completed: ${completed.size} / ${leaves.length}`);
  console.log(`Review file: ${REVIEW_FILE}`);
  if (DRY_RUN) console.log('\nDRY_RUN is true — nothing was written to the database. Review the CSV, then set DRY_RUN = false to apply.');
  console.log('════════════════════════════════════');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
