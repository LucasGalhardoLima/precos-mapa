/**
 * Scrapes Tenda Atacado's product catalog via its internal category-listing
 * API and writes current, branch-specific prices into store_prices for
 * "Tenda Atacado - Matão".
 *
 * Revalidated live 2026-09-01 (see docs/scraping-viabilidade-matao.md and
 * this file's own header history) — this REPLACES the previous
 * sitemap+regex-per-product-page approach entirely. Key facts, each
 * independently reconfirmed live in this session:
 *
 * 1. Price genuinely varies by branch. It is resolved server-side from a
 *    session cart (`_Tendaatacado-cartID`), created only by completing the
 *    real "Clique & Retire" store-selection flow (CEP -> pickup -> pick the
 *    Matão card). The `_Tendaatacado-branchID` cookie alone is cosmetic and
 *    does NOT affect price.
 *
 * 2. The catalog API returns branch-accurate prices ONLY when `cartId` is
 *    passed as an explicit query-string parameter on every request
 *    (`&cartId=<id>`) — e.g.
 *      GET api.tendaatacado.com.br/api/public/store/category/{deptId}/products
 *          ?query[link]={slug}&page={n}&order=relevance&save=false&filters=false&cartId={cartId}
 *    Passing the SAME cartId only as a `Cookie:` header (or via browser
 *    `credentials:'include'`) is NOT sufficient — that path silently
 *    returns a generic/default price that does NOT match the real branch
 *    price (confirmed: Coca-Cola Lata 220ml showed R$3.09 via cookie-auth
 *    vs. the correct R$2.79 via query-param `cartId`, matching the
 *    individual product page exactly). This was cross-checked against 8
 *    random products across 4 different departments/pages — 8/8 matched
 *    the individual product page's price exactly. This is the single most
 *    important gotcha in this endpoint: get the cartId plumbing wrong and
 *    every price silently looks plausible but is wrong.
 *
 * 3. `filters=true` (the value seen in some captured browser requests)
 *    returns ONLY the sidebar filter facets, no `products` key at all.
 *    `filters=false` is required to get the actual product listing.
 *
 * 4. Each item in the listing carries a real GTIN in `barcode` (validated
 *    here via EAN-13 check digit) — much more reliable than the old
 *    per-product page, which never exposed an EAN at all. Matching is
 *    EAN-first against products.ean, falling back to name+brand fuzzy match
 *    via findOrCreateProduct only when no valid EAN is present.
 *
 * 5. Because price is already correct in the listing response, NO
 *    per-product page fetch is needed — a single pass over the 16
 *    top-level departments (~1,526 paginated requests total, confirmed
 *    live) discovers the entire catalog with accurate branch prices in one
 *    shot. This is a real ~5x reduction vs. the old sitemap approach
 *    (~7,653 individual product-page fetches), and unlike that approach it
 *    also yields real EAN. Departments overlap (e.g. "Marca própria"
 *    crosses into Mercearia/Limpeza), so results are deduplicated by `sku`.
 *
 * 6. Each item's `inventory[]` array carries per-branch stock for ~45
 *    branches regardless of session — used here to skip items with zero
 *    stock specifically at the Matão branch (more precise than the old
 *    script's generic `availability === 'in_stock'` check, which doesn't
 *    say anything about a specific branch).
 *
 * DRY_RUN defaults to true (writes a review CSV, no DB writes) — same
 * caution as the other scrape-*.ts scripts. Flip to false only after
 * reviewing a sample run's output.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/scrape-tenda-atacado-prices.ts
 *   npx tsx --env-file=.env.local scripts/scrape-tenda-atacado-prices.ts --limit=5   (caps the matching/write step to N products — manual testing; discovery is unaffected, see BATCH's own comment)
 *
 * Required env vars:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Optional env var:
 *   SCRAPER_DATABASE_URL — direct-Postgres bridge for when PostgREST itself
 *   is unreachable; see src/lib/scraper-db.ts's file header for why and how.
 */

import { createClient } from '@supabase/supabase-js';
import type { Client } from 'pg';
import { chromium, type Page } from 'playwright';
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { connectAsServiceRole, createDirectScraperDb, createRestScraperDb, type ScraperDb } from '../src/lib/scraper-db';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const STORE_NAME_PATTERN = '%tenda atacado%';
const HOME_URL = 'https://www.tendaatacado.com.br/';
const API_STORE_BASE = 'https://api.tendaatacado.com.br/api/public/store';
const USER_AGENT = 'Mozilla/5.0 (compatible; PoupBot/1.0; +lima.galhardo@gmail.com)';
const CEP_MATAO = '15990-005'; // resolves to the Matão "Clique & Retire" pickup store

const DISCOVERY_DELAY_MS = 300; // between category-listing page requests (lightweight JSON)
const MAX_PAGES_PER_DEPARTMENT = 500; // safety cap — largest dept observed live was 386 pages
const MAX_CONSECUTIVE_API_ERRORS = 5; // abort discovery early if the cartId looks expired/invalid

// BATCH here gates only the matching+DB-write step, NOT discovery. Discovery
// (the network-heavy part that hits tendaatacado.com.br) always runs to
// completion every run and is NOT cached across runs (unlike the sibling
// scrapers' discovery-cache-forever pattern — see discoverCatalog's own
// comment for why that pattern is wrong for this endpoint specifically:
// price is bundled into the discovery response here, so caching it would
// cache prices). That combination means a small per-run BATCH (matching the
// sibling convention) would force repeated ~1,500-request/tens-of-minutes
// full re-crawls just to work through the backlog — 11 full re-discoveries
// to clear a ~5,300-item catalog at BATCH=500, ~17,000 requests total against
// a site we've already seen produce one unexplained error cluster. Since
// matching/writing only hits our own Supabase (no rate-limit reason to cap
// it), BATCH is instead set far above any realistic catalog size so one run
// clears everything a single discovery pass just found.
const BATCH = 10000; // deliberately >> catalog size (~5,300 in-stock observed) — see comment above

const CHECKPOINT_FILE = resolve(process.cwd(), 'scripts/.scrape-tenda-checkpoint.json');
const DISCOVERY_CHECKPOINT_FILE = resolve(process.cwd(), 'scripts/.scrape-tenda-discovery-checkpoint.json');
const REVIEW_FILE = resolve(process.cwd(), 'scripts/.scrape-tenda-review.csv');

// Set to false only after reviewing a sample run's output.
const DRY_RUN = false;

// The 16 top-level departments that cover the entire catalog (subcategories
// aggregate into their parent department) — confirmed live 2026-09-01 via
// the site's own menu data (__NEXT_DATA__ -> categoryStore.menusCategories)
// and cross-checked by calling each id+link pair directly.
const DEPARTMENTS: { id: number; link: string; name: string }[] = [
  { id: 3412, link: 'produtos-select', name: 'Marca própria' },
  { id: 5732, link: 'linha-food-service', name: 'Food Service' },
  { id: 5838, link: 'fit-e-saudavel', name: 'Fit e Saudável' },
  { id: 4, link: 'bebidas', name: 'Bebidas' },
  { id: 12, link: 'mercearia', name: 'Mercearia' },
  { id: 7, link: 'congelados', name: 'Congelados' },
  { id: 8, link: 'frios-e-laticinios', name: 'Frios e Laticínios' },
  { id: 6, link: 'carnes-aves-e-peixes', name: 'Carnes, Aves e Peixes' },
  { id: 11, link: 'limpeza', name: 'Limpeza' },
  { id: 9, link: 'higiene-e-perfumaria', name: 'Higiene e Perfumaria' },
  { id: 3, link: 'bebe', name: 'Bebê' },
  { id: 5, link: 'bomboniere', name: 'Bomboniere' },
  { id: 13, link: 'paes-e-bolos', name: 'Pães e Bolos' },
  { id: 10, link: 'hortifruti', name: 'Hortifrúti' },
  { id: 2, link: 'bazar', name: 'Bazar' },
  { id: 14, link: 'pet-shop', name: 'Pet Shop' },
];

// Maps each department to our internal categories.id taxonomy (12 rows —
// see the `categories` table). "Marca própria" is a cross-cutting private-
// label collection (spans Mercearia/Limpeza/etc. per the DEPARTMENTS
// comment above) with no single correct category, so it falls to
// cat_outros rather than guessing.
const DEPARTMENT_TO_CATEGORY: Record<string, string> = {
  'Marca própria': 'cat_outros',
  'Food Service': 'cat_alimentos',
  'Fit e Saudável': 'cat_alimentos',
  Bebidas: 'cat_bebidas',
  Mercearia: 'cat_alimentos',
  Congelados: 'cat_congelados',
  'Frios e Laticínios': 'cat_laticinios',
  'Carnes, Aves e Peixes': 'cat_carnes',
  Limpeza: 'cat_limpeza',
  'Higiene e Perfumaria': 'cat_higiene',
  Bebê: 'cat_bebes',
  Bomboniere: 'cat_alimentos',
  'Pães e Bolos': 'cat_padaria',
  Hortifrúti: 'cat_hortifruti',
  Bazar: 'cat_outros',
  'Pet Shop': 'cat_pet',
};

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchWithTimeout(url: string, timeoutMs = 20000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' }, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

interface FetchAttemptResult {
  ok: boolean;
  data: TendaCategoryResponse | null;
  /** Human-readable cause of the last failed attempt — HTTP status + body snippet for
   * non-2xx responses, or the exception name/message for network-level failures. Exists
   * so a run that hits repeated failures tells us WHICH failure mode it is (403/429
   * bot-block vs. 500 vs. bare timeout) instead of a single undifferentiated "bad response". */
  diagnostic: string;
}

/**
 * Fetches a single category-listing page with a couple of retries. In
 * practice this API intermittently aborts/times out under sustained
 * request volume (observed live: roughly 1 in 7-8 requests during a long
 * discovery run) with no discernible pattern tied to a specific
 * department/page — a bare single-attempt fetch would silently drop ~15%
 * of pages (and their products) on a full run. A short retry with backoff
 * clears the vast majority of these.
 */
async function fetchCategoryPageWithRetry(url: string, maxAttempts = 3): Promise<FetchAttemptResult> {
  let diagnostic = 'unknown';
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetchWithTimeout(url, 20000);
      if (res.ok) {
        let data: TendaCategoryResponse;
        try {
          data = (await res.json()) as TendaCategoryResponse;
        } catch (parseErr) {
          diagnostic = `HTTP 200 but JSON parse failed: ${parseErr instanceof Error ? parseErr.message : parseErr}`;
          if (attempt < maxAttempts) await sleep(800 * attempt);
          continue;
        }
        if (data.error) return { ok: false, data, diagnostic: `HTTP 200 with API error field: ${data.error}` };
        if (!Array.isArray(data.products)) {
          return { ok: false, data, diagnostic: `HTTP 200 but no products array (keys: ${Object.keys(data).join(',')})` };
        }
        return { ok: true, data, diagnostic: 'ok' };
      }
      const bodySnippet = await res
        .text()
        .then((t) => t.slice(0, 300).replace(/\s+/g, ' '))
        .catch(() => '<unreadable body>');
      diagnostic = `HTTP ${res.status} ${res.statusText}: ${bodySnippet}`;
    } catch (err) {
      diagnostic = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    }
    if (attempt < maxAttempts) await sleep(800 * attempt);
  }
  return { ok: false, data: null, diagnostic };
}

/** Standard EAN-13 check-digit validation (odd positions weight 1, even weight 3). */
function isValidEan13(code: string | null | undefined): code is string {
  if (!code || !/^\d{13}$/.test(code)) return false;
  const digits = code.split('').map(Number);
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += digits[i] * (i % 2 === 0 ? 1 : 3);
  const checkDigit = (10 - (sum % 10)) % 10;
  return checkDigit === digits[12];
}

interface TendaInventoryEntry {
  branchId: string;
  totalAvailable: number;
}

interface TendaApiProduct {
  sku: string;
  barcode: string | null;
  name: string;
  url: string;
  price: number;
  brand: string | null;
  availability: string | null;
  inventory?: TendaInventoryEntry[];
  thumbnail?: string | null;
}

interface TendaCategoryResponse {
  current_page: number;
  total_pages: number;
  total_products: number;
  products: TendaApiProduct[];
  error?: string;
}

interface DiscoveredProduct {
  sku: string;
  barcode: string | null;
  name: string;
  brand: string | null;
  url: string;
  price: number;
  availability: string | null;
  mataoStock: number | null; // null = branch not found in inventory[] (unknown, not excluded)
  categoryId: string; // our internal categories.id, from the department this SKU was first seen under
  thumbnail: string | null;
}

/**
 * Completes the real "Clique & Retire" store-selection flow for Matão and
 * returns the resulting session cartId (the only thing that actually
 * determines branch-specific pricing) plus branchId (used only to read
 * per-branch stock from each listing response's inventory[] array).
 *
 * shortcut: cartId TTL is unknown — nothing here detects expiry mid-run
 * beyond the generic "too many consecutive API errors" abort in the
 * discovery loop below (an expired cartId reliably 500s on this API, see
 * header note). Upgrade: if this becomes a real problem in practice, detect
 * the 500 pattern specifically and re-run this warmup mid-script instead of
 * aborting the whole run.
 */
async function warmupMatao(): Promise<{ cartId: string; branchId: string }> {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ userAgent: USER_AGENT, viewport: { width: 1280, height: 900 } });
    const page: Page = await context.newPage();

    await page.goto(HOME_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(1200);
    try {
      const cookieBtn = page.getByText('CONCORDO E FECHAR', { exact: false });
      if (await cookieBtn.isVisible({ timeout: 4000 })) await cookieBtn.click();
    } catch {
      // banner not present — fine
    }

    const cepInput = page.locator('input[placeholder="00000-000"]');
    await cepInput.first().fill(CEP_MATAO);
    const shippingResp = page.waitForResponse((r) => r.url().includes('/store/shipping-options/'), { timeout: 15000 });
    await page.getByRole('button', { name: /enviar/i }).first().click();
    await shippingResp;
    await page.waitForTimeout(2000);

    await page.getByText('Clique & Retire', { exact: false }).first().click({ timeout: 10000 });
    await page.waitForTimeout(1500);
    await page.getByText('Matão', { exact: false }).first().click({ timeout: 10000 });
    await page.waitForTimeout(2500);

    const cookies = await context.cookies();
    const cartId = cookies.find((c) => c.name === '_Tendaatacado-cartID')?.value;
    const branchId = cookies.find((c) => c.name === '_Tendaatacado-branchID')?.value;
    if (!cartId || !branchId) {
      throw new Error(`Warmup did not produce cartID/branchID cookies (cartId=${cartId}, branchId=${branchId})`);
    }
    return { cartId, branchId };
  } finally {
    await browser.close();
  }
}

function buildCategoryUrl(deptId: number, link: string, page: number, cartId: string): string {
  return `${API_STORE_BASE}/category/${deptId}/products?query[link]=${encodeURIComponent(link)}&page=${page}&order=relevance&save=false&filters=false&cartId=${encodeURIComponent(cartId)}`;
}

interface DiscoveryCheckpoint {
  branchId: string;
  completedDeptIds: number[];
  products: DiscoveredProduct[];
}

/**
 * Discovery spans ~1,500 requests over tens of minutes, so a failure on department N
 * would otherwise throw away every already-discovered product from departments 1..N-1
 * on every retry of the whole run. Checkpointed per completed department (not per page —
 * a failure so far has only ever surfaced at a department boundary, and per-page
 * resume isn't worth the complexity it'd add). Keyed by branchId, not cartId: cartId is
 * just the session mechanism, price is a property of the branch, so a fresh cartId from
 * a re-warmed session is expected to reproduce the same prices for already-completed
 * departments.
 */
function loadDiscoveryCheckpoint(branchId: string): { completedDeptIds: Set<number>; bySku: Map<string, DiscoveredProduct> } {
  if (!existsSync(DISCOVERY_CHECKPOINT_FILE)) return { completedDeptIds: new Set(), bySku: new Map() };
  try {
    const data = JSON.parse(readFileSync(DISCOVERY_CHECKPOINT_FILE, 'utf-8')) as DiscoveryCheckpoint;
    if (data.branchId !== branchId) return { completedDeptIds: new Set(), bySku: new Map() };
    return {
      completedDeptIds: new Set(data.completedDeptIds),
      bySku: new Map(data.products.map((p) => [p.sku, p])),
    };
  } catch {
    return { completedDeptIds: new Set(), bySku: new Map() };
  }
}

function saveDiscoveryCheckpoint(branchId: string, completedDeptIds: Set<number>, bySku: Map<string, DiscoveredProduct>): void {
  const checkpoint: DiscoveryCheckpoint = { branchId, completedDeptIds: [...completedDeptIds], products: [...bySku.values()] };
  writeFileSync(DISCOVERY_CHECKPOINT_FILE, JSON.stringify(checkpoint));
}

/**
 * Paginates all 16 departments via the category-listing API (cartId as a
 * query param — see header note #2) and returns a deduplicated map of every
 * discovered product, keyed by sku (departments overlap heavily). Resumes
 * from scripts/.scrape-tenda-discovery-checkpoint.json when present (see
 * loadDiscoveryCheckpoint) — departments already completed in a prior run
 * are skipped entirely.
 */
async function discoverCatalog(cartId: string, branchId: string): Promise<Map<string, DiscoveredProduct>> {
  const { completedDeptIds, bySku } = loadDiscoveryCheckpoint(branchId);
  if (bySku.size > 0) {
    console.log(`Resuming from checkpoint: ${completedDeptIds.size} department(s) already done, ${bySku.size} SKUs loaded.`);
  }
  let consecutiveErrors = 0;
  let totalRequests = 0;

  for (const dept of DEPARTMENTS) {
    if (completedDeptIds.has(dept.id)) {
      console.log(`  ${dept.name} (id=${dept.id}): skipped (already completed in checkpoint)`);
      continue;
    }
    let totalPages = 1;
    let deptNew = 0;
    for (let pageNum = 1; pageNum <= totalPages && pageNum <= MAX_PAGES_PER_DEPARTMENT; pageNum++) {
      const url = buildCategoryUrl(dept.id, dept.link, pageNum, cartId);
      const result = await fetchCategoryPageWithRetry(url);
      totalRequests++;

      if (!result.ok || !result.data) {
        consecutiveErrors++;
        console.warn(`  [${dept.name} p${pageNum}] bad response (${consecutiveErrors}/${MAX_CONSECUTIVE_API_ERRORS} consecutive errors): ${result.diagnostic}`);
        if (consecutiveErrors >= MAX_CONSECUTIVE_API_ERRORS) {
          throw new Error(
            `Aborting discovery: ${MAX_CONSECUTIVE_API_ERRORS} consecutive bad responses from the category API. ` +
              `Last diagnostic: ${result.diagnostic}. Checkpoint saved through the last completed department — re-run to resume.`,
          );
        }
        await sleep(DISCOVERY_DELAY_MS);
        continue;
      }
      consecutiveErrors = 0;
      const data = result.data;
      totalPages = Math.min(data.total_pages || 1, MAX_PAGES_PER_DEPARTMENT);

      for (const p of data.products) {
        if (bySku.has(p.sku)) continue;
        const mataoInventory = p.inventory?.find((i) => i.branchId === branchId);
        bySku.set(p.sku, {
          sku: p.sku,
          barcode: p.barcode ?? null,
          name: p.name,
          brand: p.brand ?? null,
          url: p.url,
          price: p.price,
          availability: p.availability ?? null,
          mataoStock: mataoInventory ? mataoInventory.totalAvailable : null,
          categoryId: DEPARTMENT_TO_CATEGORY[dept.name] ?? 'cat_alimentos',
          thumbnail: p.thumbnail ?? null,
        });
        deptNew++;
      }

      await sleep(DISCOVERY_DELAY_MS);
    }
    console.log(`  ${dept.name} (id=${dept.id}): ${totalPages} pages, ${deptNew} new unique SKUs (running total: ${bySku.size})`);
    completedDeptIds.add(dept.id);
    saveDiscoveryCheckpoint(branchId, completedDeptIds, bySku);
  }

  console.log(`\nDiscovery done: ${totalRequests} API requests, ${bySku.size} unique SKUs across ${DEPARTMENTS.length} departments.\n`);
  // Discovery checkpoint exists only to survive a mid-run crash — a clean finish means this
  // snapshot is fully fresh, so clear it. Otherwise every future run would silently skip
  // discovery and keep serving today's prices forever instead of re-scraping.
  if (existsSync(DISCOVERY_CHECKPOINT_FILE)) unlinkSync(DISCOVERY_CHECKPOINT_FILE);
  return bySku;
}

interface Checkpoint {
  processedSkus: string[];
}

function loadCheckpoint(): Set<string> {
  if (!existsSync(CHECKPOINT_FILE)) return new Set();
  try {
    const data = JSON.parse(readFileSync(CHECKPOINT_FILE, 'utf-8')) as Checkpoint;
    return new Set(data.processedSkus ?? []);
  } catch {
    return new Set();
  }
}

function saveCheckpoint(processed: Set<string>): void {
  writeFileSync(CHECKPOINT_FILE, JSON.stringify({ processedSkus: [...processed] }));
}

/** --limit=N caps the matching/write step to the first N in-stock products — manual/bridge testing only. Discovery (the ~1,500-request site crawl) is unaffected, see BATCH's own comment. */
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
    directClient = await connectAsServiceRole(directUrl);
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

  console.log('\nWarming up Matão session (completing real Clique & Retire flow via Playwright)...');
  const { cartId, branchId } = await warmupMatao();
  console.log(`Warmup done. cartId=${cartId} branchId=${branchId}\n`);

  console.log('Discovering catalog across 16 departments (category-listing API, cartId as query param)...');
  const discovered = await discoverCatalog(cartId, branchId);

  const inStock = [...discovered.values()].filter((p) => p.mataoStock === null || p.mataoStock > 0);
  const outOfStock = discovered.size - inStock.length;
  console.log(`${inStock.length} in-stock-at-Matão (or stock unknown), ${outOfStock} out-of-stock-at-Matão (skipped).`);

  const processed = loadCheckpoint();
  const pending = inStock.filter((p) => !processed.has(p.sku)).slice(0, limitArg() ?? BATCH);
  console.log(`${processed.size} already processed in prior runs. Processing ${pending.length} this run (${DRY_RUN ? 'DRY RUN' : 'LIVE — writing to DB'}).\n`);

  const reviewRows: string[] = ['sku,barcode,ean_valid,name,brand,price,matao_stock,url,match_type,matched_product_id,is_new_product'];
  let matchedByEan = 0;
  let matchedByFuzzy = 0;
  let created = 0;
  let failed = 0;

  for (const p of pending) {
    try {
      const eanValid = isValidEan13(p.barcode);
      let matchType: 'ean' | 'fuzzy' = 'fuzzy';
      let productId = '';
      let isNew = false;

      if (DRY_RUN) {
        matchType = eanValid ? 'ean' : 'fuzzy';
      } else {
        if (eanValid) {
          // eanValid (isValidEan13, a type predicate on p.barcode) being
          // true guarantees p.barcode is a string; TS can't see that
          // through the intermediate boolean, hence the assertion.
          const barcode = p.barcode as string;
          const existing = await db.findProductByEan(barcode);
          if (existing) {
            productId = existing.id;
            matchType = 'ean';
            matchedByEan++;
          } else {
            const result = await db.findOrCreateProduct({
              name: p.name,
              categoryId: p.categoryId,
              brand: p.brand ?? undefined,
              ean: barcode,
              referencePrice: p.price,
              strictNoEanMatch: true,
            });
            productId = result.id;
            isNew = result.isNew;
            matchType = 'ean';
            if (result.isNew) {
              created++;
              await db.updateProductIfNull(productId, 'ean', { ean: barcode });
            } else {
              matchedByEan++;
            }
          }
        } else {
          const result = await db.findOrCreateProduct({
            name: p.name,
            categoryId: p.categoryId,
            brand: p.brand ?? undefined,
            referencePrice: p.price,
            strictNoEanMatch: true,
          });
          productId = result.id;
          isNew = result.isNew;
          matchType = 'fuzzy';
          if (result.isNew) created++;
          else matchedByFuzzy++;
        }

        await db.upsertStorePrice({
          productId,
          storeId: store.id,
          price: p.price,
          isPromo: false,
          source: 'crawler',
          confidence: 1.0,
          validUntil: null,
        });

        // Image is a free ride on the category-listing response already
        // fetched for price/stock — no extra request. Must never be able to
        // take the price write above down with it. Never overwrites an
        // existing image_url (source priority is retailer > OFF; guarded on
        // image_url IS NULL), and any failure here is swallowed.
        if (p.thumbnail) {
          try {
            await db.updateProductIfNull(productId, 'image_url', { image_url: p.thumbnail, image_source: 'tenda' });
          } catch (imgErr) {
            console.warn(`  [image_url write failed] sku=${p.sku}: ${imgErr}`);
          }
        }
      }

      reviewRows.push(
        [
          p.sku,
          p.barcode ?? '',
          String(eanValid),
          `"${p.name.replace(/"/g, '""')}"`,
          p.brand ?? '',
          p.price,
          p.mataoStock ?? '',
          p.url,
          matchType,
          productId,
          String(isNew),
        ].join(','),
      );

      console.log(`  [${p.name}] R$ ${p.price.toFixed(2)}${p.barcode ? ` (EAN ${p.barcode}${eanValid ? '' : ' - INVALID'})` : ' (sem barcode)'}`);
    } catch (err) {
      console.warn(`  [error] sku=${p.sku}: ${err instanceof Error ? err.message : err}`);
      failed++;
    }

    processed.add(p.sku);
    saveCheckpoint(processed);
  }

  writeFileSync(REVIEW_FILE, reviewRows.join('\n'));

  console.log('\n════════════════════════════════════');
  console.log(`Discovered (unique SKUs): ${discovered.size}`);
  console.log(`In-stock at Matão (or unknown): ${inStock.length}`);
  console.log(`Processed this run: ${pending.length}`);
  console.log(`  Matched by EAN: ${matchedByEan}`);
  console.log(`  Matched by fuzzy name: ${matchedByFuzzy}`);
  console.log(`  New products created: ${created}`);
  console.log(`  Failed: ${failed}`);
  console.log(`Total processed across all runs: ${processed.size} / ${inStock.length}`);
  console.log(`Review file: ${REVIEW_FILE}`);
  if (DRY_RUN) console.log('\nDRY_RUN is true — nothing was written to the database. Review the CSV, then set DRY_RUN = false to apply.');

  // A checkpoint that only ever grows would make every future run a no-op
  // once the catalog is fully covered — fine for a one-time backfill, wrong
  // for a script meant to be re-run periodically to refresh prices. Discovery
  // above already re-fetches fresh prices every run (see discoverCatalog's
  // own comment); clearing this checkpoint too on a clean full pass (not on
  // DRY_RUN, which never actually commits anything) makes the next
  // invocation actually re-write those fresh prices instead of skipping
  // every already-seen SKU forever.
  if (!DRY_RUN && processed.size >= inStock.length && existsSync(CHECKPOINT_FILE)) {
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
