/**
 * Enriches products with image_url by matching against Brazilian retailer
 * catalogs (Savegnago, Tenda Atacado, Atacadão — all VTEX-based, all confirmed
 * to have full e-commerce catalogs, not just promotional flyers). Atacadão is
 * a national atacarejo chain with a much larger catalog (55k+ products) than
 * the two regional ones, added to improve on the low yield seen with
 * regional-only coverage. Carrefour Brasil was considered and rejected: also
 * VTEX, but its sitemap resolves to 4,987 product sub-sitemaps (general
 * marketplace — electronics, cables, appliances, not grocery-specific) —
 * see the comment above the RETAILERS array.
 *
 * APPLY_TO_DB (below) gates whether matches are written to products.image_url
 * or just logged to local CSVs for review — currently false ("local only").
 *
 * Phase 1: exact EAN match via Savegnago's public VTEX catalog API. Fast, no
 *          browser, no matching risk — but coverage is low: tested against this
 *          catalog's long tail (products with no store_prices yet, i.e. not
 *          currently shown in the app) and got 0/39 real EANs. Regional chains
 *          stock far fewer SKUs than the national Cosmos database seeds. Still
 *          worth running since it's nearly free and catches whatever overlap
 *          exists across the full catalog. (Tenda/Atacadão don't expose this
 *          API on their custom domain, so Phase 1 stays Savegnago-only; they're
 *          Phase 2 only.)
 * Phase 2: fuzzy name match against each store's product sitemap (published for
 *          crawling — see robots.txt Sitemap: entries), then a headless browser
 *          renders the matched product page to extract the image (both sites are
 *          client-rendered SPAs; the image isn't present in the raw server HTML).
 *          Does NOT write to the DB — writes candidates to a CSV for manual
 *          review instead. A live test run caught two different products
 *          ("Biscoito Polvilho" and "Biscoito De Polvilho" — different brands)
 *          both matching the same competitor's product page at a perfect score,
 *          while a same-brand-different-size match scored identically to a
 *          same-category-different-brand wrong match. Token overlap alone
 *          can't reliably separate those cases, so this phase proposes, it
 *          doesn't apply. Bounded per run since each match needs a real page
 *          render.
 *
 * Neither store's disallowed paths (/busca*, /buscapagina*) are touched — Phase 1
 * uses the versioned catalog API (not a search results page), Phase 2 uses sitemap
 * URLs and product pages, both explicitly published for crawling.
 *
 * Usage (Node 20+):
 *   npx tsx --env-file=.env.local scripts/enrich-images-from-retailers.ts
 *
 * Required env vars (same as other enrich-* scripts):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { chromium, type Page } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const USER_AGENT = 'Mozilla/5.0 (compatible; PoupBot/1.0; +lima.galhardo@gmail.com)';
const DELAY_MS = 1000;
const PHASE1_BATCH = 5000; // EAN lookups are cheap
const PHASE2_BATCH = 300; // page renders are slow — bound per run, re-run to continue
const SITEMAP_CACHE_FILE = resolve(process.cwd(), 'scripts/.retailer-sitemap-cache.json');
const MIN_MATCH_SCORE = 0.6; // Jaccard (overlap/union) minimum for a candidate to reach the review CSV
const MIN_MATCH_TOKENS = 2;
const MAX_SUB_SITEMAPS = 100; // guards against indexing a general marketplace's entire catalog
// Local-only mode: keep everything in local review files, don't touch the
// database yet — including Phase 1's exact-EAN matches (normally safe to
// auto-apply). Flip to true once ready to actually enrich products.
const APPLY_TO_DB = false;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// Plain fetch() has no default timeout — an unresponsive server hangs the
// whole run forever with no signal. A live test run stalled for 5+ minutes
// this way before it was caught and killed manually.
async function fetchWithTimeout(url: string, timeoutMs = 20000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

const STOPWORDS = new Set(['de', 'da', 'do', 'com', 'sem', 'e', 'a', 'o']);
const UNIT_RE = /^\d+([.,]\d+)?(kg|g|ml|l|un|und|unid|cx|pct|gr)$/i;

function normalizeTokens(text: string): Set<string> {
  const clean = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip accents
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/-/g, ' ');
  const tokens = clean
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t) && !UNIT_RE.test(t));
  return new Set(tokens);
}

function matchScore(a: Set<string>, b: Set<string>): number {
  // Jaccard (overlap / union), not overlap / shorter — otherwise a generic,
  // brand-less name (e.g. "Biscoito Polvilho") scores a perfect match against
  // ANY sitemap entry that's a superset of its tokens (e.g. a specific
  // competitor's "Biscoito Polvilho Cassini 100g Tradicional"), ignoring how
  // much brand-specific info the candidate adds that we can't verify.
  let overlap = 0;
  for (const t of a) if (b.has(t)) overlap++;
  const union = a.size + b.size - overlap || 1;
  return overlap / union;
}

interface SitemapEntry {
  url: string;
  tokens: string[]; // stored as array for JSON caching; converted to Set at match time
}

interface RetailerConfig {
  name: string;
  sitemaps: string[];
  slugFromUrl: (url: string) => string;
  eanSearchUrl?: (ean: string) => string;
  extractImage: (page: Page) => Promise<string | null>;
}

const RETAILERS: RetailerConfig[] = [
  {
    name: 'Savegnago',
    sitemaps: Array.from({ length: 12 }, (_, i) => `https://www.savegnago.com.br/sitemap/product-${i}.xml`),
    slugFromUrl: (url) => url.replace('https://www.savegnago.com.br/', '').replace(/\/p$/, ''),
    eanSearchUrl: (ean) => `https://www.savegnago.com.br/api/catalog_system/pub/products/search?fq=alternateIds_Ean:${ean}`,
    extractImage: (page) => extractJsonLdProductImage(page),
  },
  {
    name: 'Tenda Atacado',
    sitemaps: ['https://www.tendaatacado.com.br/google-sitemap/sitemap-produtos.xml'],
    slugFromUrl: (url) => url.replace('https://www.tendaatacado.com.br/produto/', ''),
    extractImage: async (page) => {
      return page.evaluate(() => {
        const img = Array.from(document.querySelectorAll('img')).find(
          (i) => i.src.includes('/imagex/resize') || i.src.includes('tenda-bucket-prd.s3'),
        );
        return img?.src ?? null;
      });
    },
  },
  // Carrefour Brasil deliberately excluded: also VTEX, but its sitemap index
  // resolves to 4,987 product sub-sitemaps (vs Savegnago's 12, Atacadão's 56)
  // — it's a general marketplace (electronics, cables, appliances alongside
  // groceries), not grocery-specific. Sequentially indexing all of it would
  // take over an hour; revisit with concurrent fetching + category filtering
  // if it's worth the engineering investment later.
  {
    name: 'Atacadão',
    sitemaps: ['https://www.atacadao.com.br/sitemap.xml'], // top-level index — resolved to product-N.xml sub-sitemaps
    slugFromUrl: (url) => url.replace('https://www.atacadao.com.br/', '').replace(/\/p$/, ''),
    extractImage: (page) => extractJsonLdProductImage(page),
  },
];

// Shared by Savegnago/Carrefour/Atacadão — all render a schema.org Product
// JSON-LD block after JS execution, but `image` shows up as either a string
// or an array of strings depending on the store, so handle both.
async function extractJsonLdProductImage(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
    for (const s of scripts) {
      try {
        const data = JSON.parse(s.textContent ?? '{}');
        if (data['@type'] === 'Product' && data.image) {
          return Array.isArray(data.image) ? (data.image[0] ?? null) : data.image;
        }
      } catch {
        /* not JSON, skip */
      }
    }
    return null;
  });
}

async function fetchSitemapUrls(sitemapUrl: string): Promise<string[]> {
  const res = await fetchWithTimeout(sitemapUrl, 30000).catch((err) => {
    console.warn(`  Sitemap fetch timed out: ${sitemapUrl} (${err.message})`);
    return null;
  });
  if (!res) return [];
  if (!res.ok) {
    console.warn(`  Sitemap fetch failed (${res.status}): ${sitemapUrl}`);
    return [];
  }
  const xml = await res.text();

  // Some stores (Atacadão) only publish a top-level sitemap INDEX; resolve it
  // to its product-specific sub-sitemaps and recurse. Others (Savegnago,
  // Tenda) publish the product urlset directly.
  if (xml.includes('<sitemapindex')) {
    let subSitemaps = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]).filter((u) => u.includes('product'));
    // Safety cap: a general marketplace (seen with Carrefour: 4,987 product
    // sub-sitemaps) would take over an hour to index sequentially. Cap and
    // warn rather than silently taking forever.
    if (subSitemaps.length > MAX_SUB_SITEMAPS) {
      console.warn(`  Sitemap index has ${subSitemaps.length} product sub-sitemaps — capping at ${MAX_SUB_SITEMAPS} (${sitemapUrl})`);
      subSitemaps = subSitemaps.slice(0, MAX_SUB_SITEMAPS);
    }
    const all: string[] = [];
    for (const sub of subSitemaps) {
      all.push(...(await fetchSitemapUrls(sub)));
      await sleep(300);
    }
    return all;
  }

  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
}

async function loadOrBuildSitemapIndex(): Promise<Record<string, SitemapEntry[]>> {
  if (existsSync(SITEMAP_CACHE_FILE)) {
    console.log('Loading cached retailer sitemap index...');
    return JSON.parse(readFileSync(SITEMAP_CACHE_FILE, 'utf-8'));
  }

  console.log('Building retailer sitemap index (first run — cached afterwards)...');
  const index: Record<string, SitemapEntry[]> = {};
  for (const retailer of RETAILERS) {
    const entries: SitemapEntry[] = [];
    for (const sitemapUrl of retailer.sitemaps) {
      const urls = await fetchSitemapUrls(sitemapUrl);
      for (const url of urls) {
        const slug = retailer.slugFromUrl(url);
        entries.push({ url, tokens: [...normalizeTokens(slug)] });
      }
      await sleep(300);
    }
    console.log(`  ${retailer.name}: ${entries.length} product URLs indexed`);
    index[retailer.name] = entries;
  }
  writeFileSync(SITEMAP_CACHE_FILE, JSON.stringify(index));
  return index;
}

function bestMatch(productName: string, entries: SitemapEntry[]): { url: string; score: number } | null {
  const nameTokens = normalizeTokens(productName);
  let best: { url: string; score: number } | null = null;
  for (const entry of entries) {
    const score = matchScore(nameTokens, new Set(entry.tokens));
    const overlapCount = [...nameTokens].filter((t) => entry.tokens.includes(t)).length;
    if (overlapCount < MIN_MATCH_TOKENS || score < MIN_MATCH_SCORE) continue;
    if (!best || score > best.score) best = { url: entry.url, score };
  }
  return best;
}

async function main() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // ---------------------------------------------------------------------------
  // Phase 1: exact EAN match (Savegnago catalog API — no browser)
  // ---------------------------------------------------------------------------

  console.log('── Phase 1: exact EAN match (Savegnago) ──');
  const savegnago = RETAILERS.find((r) => r.name === 'Savegnago')!;

  const { data: phase1Candidates } = await supabase
    .from('products')
    .select('id, ean, name')
    .is('image_url', null)
    .not('ean', 'is', null)
    .limit(PHASE1_BATCH);

  const phase1Rows: string[] = ['ean,name,image_url'];
  let phase1Hits = 0;
  for (const product of phase1Candidates ?? []) {
    try {
      const res = await fetchWithTimeout(savegnago.eanSearchUrl!(product.ean), 15000);
      if (res.ok) {
        const data: Array<{ items?: Array<{ images?: Array<{ imageUrl: string }> }> }> = await res.json();
        const imageUrl = data[0]?.items?.[0]?.images?.[0]?.imageUrl;
        if (imageUrl) {
          if (APPLY_TO_DB) {
            await supabase.from('products').update({ image_url: imageUrl }).eq('id', product.id);
          } else {
            phase1Rows.push([product.ean, `"${product.name.replace(/"/g, '""')}"`, imageUrl].join(','));
          }
          console.log(`  [${product.name}] ✓ exact EAN match${APPLY_TO_DB ? '' : ' (logged, not applied)'}`);
          phase1Hits++;
        }
      }
    } catch (err) {
      console.warn(`  [${product.name}] EAN lookup failed: ${err}`);
    }
    await sleep(DELAY_MS);
  }
  console.log(`Phase 1 complete — ${phase1Hits}/${phase1Candidates?.length ?? 0} matched\n`);

  if (!APPLY_TO_DB && phase1Rows.length > 1) {
    const phase1File = resolve(process.cwd(), 'scripts/.retailer-exact-matches.csv');
    writeFileSync(phase1File, phase1Rows.join('\n'));
    console.log(`Phase 1 matches logged (not applied): ${phase1File}\n`);
  }

  // ---------------------------------------------------------------------------
  // Phase 2: fuzzy sitemap match + browser-rendered image extraction
  // ---------------------------------------------------------------------------

  console.log('── Phase 2: fuzzy sitemap match ──');
  const sitemapIndex = await loadOrBuildSitemapIndex();

  const { data: phase2Candidates } = await supabase
    .from('products')
    .select('id, ean, name')
    .is('image_url', null)
    .not('ean', 'is', null)
    .limit(PHASE2_BATCH);

  if (!phase2Candidates || phase2Candidates.length === 0) {
    console.log('Nothing left to match.');
    return;
  }

  const browser = await chromium.launch();
  const page = await browser.newPage({ userAgent: USER_AGENT });

  // Phase 2 does NOT write to the DB. A live test caught two genuinely
  // different products ("Biscoito Polvilho" and "Biscoito De Polvilho" —
  // different brands) both matching a single competitor's product page at the
  // top score, while a same-brand-different-size match scored identically.
  // Token overlap can't reliably tell "same brand, different variant" apart
  // from "same category, different brand" — so candidates go to a CSV for a
  // human to confirm before anything is applied.
  const reviewRows: string[] = ['ean,name,retailer,score,matched_url,image_url'];
  let phase2Written = 0;
  let phase2NoMatch = 0;
  let phase2ExtractFailed = 0;

  try {
    for (const product of phase2Candidates) {
      let matched: { retailer: RetailerConfig; url: string; score: number } | null = null;
      for (const retailer of RETAILERS) {
        const m = bestMatch(product.name, sitemapIndex[retailer.name] ?? []);
        if (m && (!matched || m.score > matched.score)) matched = { retailer, ...m };
      }

      if (!matched) {
        phase2NoMatch++;
        continue;
      }

      try {
        // domcontentloaded, not networkidle — some stores (Carrefour) have
        // persistent background chatter (ads/analytics) that never goes idle.
        await page.goto(matched.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page
          .waitForSelector('script[type="application/ld+json"], img[src*="imagex"]', { timeout: 15000 })
          .catch(() => {});
        await page.waitForTimeout(2000);
        const imageUrl = await matched.retailer.extractImage(page);
        if (imageUrl) {
          console.log(`  [${product.name}] candidate (${matched.retailer.name}, score ${matched.score.toFixed(2)}): ${matched.url}`);
          reviewRows.push(
            [product.ean, `"${product.name.replace(/"/g, '""')}"`, matched.retailer.name, matched.score.toFixed(2), matched.url, imageUrl].join(','),
          );
          phase2Written++;
        } else {
          console.warn(`  [${product.name}] matched ${matched.url} but no image extracted`);
          phase2ExtractFailed++;
        }
      } catch (err) {
        console.warn(`  [${product.name}] page render failed: ${err}`);
        phase2ExtractFailed++;
      }

      await sleep(DELAY_MS);
    }
  } finally {
    await browser.close();
  }

  const reviewFile = resolve(process.cwd(), 'scripts/.retailer-image-candidates.csv');
  writeFileSync(reviewFile, reviewRows.join('\n'));

  console.log(`\nPhase 2 complete — ${phase2Written} candidates written for review, ${phase2NoMatch} no sitemap match, ${phase2ExtractFailed} extraction failures`);
  console.log(`Review candidates before applying: ${reviewFile}`);
  console.log('These are name-based fuzzy matches, not barcode-exact — confirm brand/variant match before setting image_url.\n');

  // ---------------------------------------------------------------------------
  // Coverage summary (Phase 1 only — Phase 2 candidates are not yet applied)
  // ---------------------------------------------------------------------------
  const { count: total } = await supabase.from('products').select('*', { count: 'exact', head: true });
  const { count: withImage } = await supabase.from('products').select('*', { count: 'exact', head: true }).not('image_url', 'is', null);
  const pct = (n: number | null) => (total ? `${Math.round(((n ?? 0) / total) * 100)}%` : '—');

  console.log('════════════════════════════════════');
  console.log('Coverage summary');
  console.log(`  Total products: ${total}`);
  console.log(`  Image: ${withImage} / ${total} (${pct(withImage)})`);
  console.log('════════════════════════════════════');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
