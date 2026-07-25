// Fully spec'd by specs/015-price-scanner/plan.md's data model — real,
// tested code, unlike html-parser.ts. Takes already-parsed data (or `null`
// when the scrape failed, per html-parser.ts's fail-safe contract) and does
// the CNPJ->store resolution, EAN->product matching, and the
// receipt_imports/price_reports writes described in the plan's "Data model"
// and "Validation & trust" sections.
//
// A minimal structural type instead of the real SupabaseClient generic: this
// file only ever calls .from(table).select()/.insert(), so it doesn't need
// (and shouldn't import) the full supabase-js type surface — this also keeps
// persist.test.ts's mock trivial to write and to keep honest.
export interface MinimalSupabaseClient {
  // deno-lint-ignore no-explicit-any
  from(table: string): any;
}

import { normalizeCnpj } from './qr-parser.ts';
import type { ParsedNfceReceipt } from './html-parser.ts';

export interface PersistInput {
  chNFe: string;
  anonymousId: string;
  rawHtml: string;
  /** vNF from the QR params — always available even when scraping fails entirely. */
  totalValueFromQr: number | null;
  /** null means html-parser.ts failed to scrape items — persist the QR-param-only fallback. */
  parsed: ParsedNfceReceipt | null;
}

export interface PersistResult {
  status: 'processed' | 'partial' | 'already_processed';
  storeName: string | null;
  totalValue: number | null;
  itemCount: number;
  /** May be < itemCount: individual items can lose the price_reports daily-dedup race (migration 053 unique_daily_report) without failing the whole receipt. */
  savedItemCount: number;
}

const DUPLICATE_KEY = '23505';

export async function persistReceipt(
  supabase: MinimalSupabaseClient,
  input: PersistInput,
): Promise<PersistResult> {
  const { chNFe, anonymousId, rawHtml, totalValueFromQr, parsed } = input;

  // Cache check — a chNFe is only ever processed once (receipt_imports.nfce_key
  // is UNIQUE); re-scanning the same receipt returns what was already saved
  // instead of re-scraping and double-writing price_reports.
  const { data: existing } = await supabase
    .from('receipt_imports')
    .select('total_value, item_count')
    .eq('nfce_key', chNFe)
    .maybeSingle();

  if (existing) {
    return {
      status: 'already_processed',
      storeName: null,
      totalValue: existing.total_value ?? null,
      itemCount: existing.item_count ?? 0,
      savedItemCount: existing.item_count ?? 0,
    };
  }

  const storeCnpj = normalizeCnpj(parsed?.storeCnpj ?? null);
  let storeId: string | null = null;
  if (storeCnpj) {
    const { data: store } = await supabase
      .from('stores')
      .select('id')
      .eq('cnpj', storeCnpj)
      .maybeSingle();
    storeId = store?.id ?? null;
  }

  const items = parsed?.items ?? [];
  const totalValue = parsed
    ? Number(items.reduce((sum, it) => sum + it.totalPrice, 0).toFixed(2))
    : totalValueFromQr;
  const status: 'processed' | 'partial' = parsed && items.length > 0 ? 'processed' : 'partial';

  const { error: importError } = await supabase.from('receipt_imports').insert({
    anonymous_id: anonymousId,
    nfce_key: chNFe,
    store_cnpj: storeCnpj,
    store_id: storeId,
    total_value: totalValue,
    item_count: items.length,
    raw_html: rawHtml,
    status,
  });

  // Lost a race against a concurrent identical request (same chNFe scanned
  // twice at once) — treat the same as a cache hit rather than surfacing an
  // error the caller would have no useful way to act on.
  if (importError?.code === DUPLICATE_KEY) {
    return {
      status: 'already_processed',
      storeName: parsed?.storeName ?? null,
      totalValue,
      itemCount: items.length,
      savedItemCount: 0,
    };
  }

  let savedItemCount = 0;
  if (status === 'processed') {
    // One insert per item, not a single bulk insert: price_reports'
    // unique_daily_report constraint (migration 053) can legitimately reject
    // one line of a receipt (e.g. the same product was already scanned via
    // Mode A at this store today) without that invalidating the other 11
    // items on the same receipt.
    for (const item of items) {
      let productId: string | null = null;
      if (item.ean) {
        const { data: product } = await supabase
          .from('products')
          .select('id')
          .eq('ean', item.ean)
          .maybeSingle();
        productId = product?.id ?? null;
      }

      const { error } = await supabase.from('price_reports').insert({
        ean: item.ean,
        product_id: productId,
        price: item.unitPrice,
        store_id: storeId,
        source: 'nfce_receipt',
        anonymous_id: anonymousId,
        confidence: 1.0, // plan.md "Validation & trust": NFC-e receipt = transaction price = ground truth
        nfce_key: chNFe,
        metadata: { quantity: item.quantity, unit: item.unit, description: item.description },
      });
      if (!error) savedItemCount++;
    }
  }

  return {
    status,
    storeName: parsed?.storeName ?? null,
    totalValue,
    itemCount: items.length,
    savedItemCount,
  };
}
