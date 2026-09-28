/**
 * Savegnago VTEX plumbing shared by scripts/scrape-savegnago-prices.ts (daily
 * price scrape) and scripts/backfill-category-l2.ts (category pass): request
 * helpers, the Matão seller/cookie, the leaf-category tree and product search.
 * Moved verbatim out of the scraper so both walk the site the same way.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const BASE = 'https://www.savegnago.com.br';

// Identifying UA (courtesy convention shared by this project's scrapers) —
// deliberately does NOT contain the substring "Bot": Savegnago's WAF
// bot-classifies and 429s any UA containing it (confirmed live, see header
// comment). Keep the email so the site owner can identify/contact us.
export const USER_AGENT = 'Mozilla/5.0 (compatible; PoupPriceCompare/1.0; +lima.galhardo@gmail.com)';

export const DELAY_MS = 400;
export const PAGE_SIZE = 50; // VTEX legacy search API hard cap — confirmed via live 400 response
export const MAX_RESULTS_PER_CATEGORY = 2500; // VTEX search backend cap (task brief, not directly re-tested)


// Matão store's registered CEP (stores.id = 'd5912ae4-2aa3-44e6-bcf6-9d6503c57bfe',
// "R. São Lourenço, 1170 - Centro, Matão - SP, 15990-005"), digits only.
export const MATAO_POSTAL_CODE = '15990005';

export const CATEGORY_CACHE_FILE = resolve(process.cwd(), 'scripts/.scrape-savegnago-categories.json');

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function fetchWithRetry(url: string, headers: Record<string, string>, tries = 5, timeoutMs = 20000): Promise<Response> {
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

export function buildVtexSegmentCookie(sellerId: string): string {
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

export async function resolveSellerId(postalCode: string): Promise<string> {
  const url = `${BASE}/api/checkout/pub/regions?country=BRA&postalCode=${postalCode}&sc=1`;
  const res = await fetchWithRetry(url, { 'User-Agent': USER_AGENT });
  if (!res.ok) throw new Error(`regions lookup failed: HTTP ${res.status}`);
  const body = (await res.json()) as Array<{ id: string; sellers?: Array<{ id: string }> }>;
  const sellerId = body?.[0]?.sellers?.[0]?.id;
  if (!sellerId) throw new Error(`regions response had no seller id: ${JSON.stringify(body)}`);
  return sellerId;
}

// ─── Category tree discovery ────────────────────────────────────────────

export interface CategoryTreeNode {
  id: number;
  name: string;
  children?: CategoryTreeNode[];
}

export interface LeafCategory {
  id: number;
  idPath: number[]; // full ancestor chain incl. self — required for fq=C:/a/b/c/
  path: string; // human-readable, for the review CSV
}


export function collectLeaves(nodes: CategoryTreeNode[], idPath: number[] = [], namePath: string[] = []): LeafCategory[] {
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

export async function fetchLeafCategories(): Promise<LeafCategory[]> {
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

export interface CommertialOffer {
  Price: number;
  ListPrice: number;
  AvailableQuantity: number;
  IsAvailable: boolean;
}

export interface VtexItem {
  ean?: string;
  images?: Array<{ imageUrl: string }>;
  sellers?: Array<{ commertialOffer: CommertialOffer }>;
}

export interface VtexProduct {
  productId: string;
  productName: string;
  brand?: string;
  /** Every category the product is listed under, ancestors included: "/15463/15466/15468/". */
  categoriesIds?: string[];
  items?: VtexItem[];
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

export function isValidEan(ean: string | undefined | null): ean is string {
  if (!ean) return false;
  if (!/^\d{8,14}$/.test(ean) || /^0+$/.test(ean)) return false;
  return hasValidGtinCheckDigit(ean);
}

export async function fetchCategoryPage(idPath: number[], from: number, to: number, cookie: string): Promise<VtexProduct[]> {
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
