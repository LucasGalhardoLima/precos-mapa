import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { persistReceipt } from './persist.ts';
import type { ParsedNfceReceipt } from './html-parser.ts';

const CHAVE = '35260712345678000190650010000012345678901234';

interface MatchCandidate {
  id: string;
  name: string;
  brand: string | null;
  match_type: string;
  match_score: number;
  confidence: number;
}

interface MockPriceReport {
  price: number;
  metadata: { quantity?: number; unit?: string; description?: string } | null;
  productName: string | null;
}

interface MockDb {
  receiptImports: Record<string, { total_value: number; item_count: number }>;
  stores: { id: string; cnpj: string }[];
  products: { id: string; ean: string | null; name?: string }[];
  /** Seeded price_reports rows, keyed by nfce_key, for the already_processed reconstruction path. */
  priceReportsByChave: Record<string, MockPriceReport[]>;
  insertedReceiptImports: Record<string, unknown>[];
  insertedPriceReports: Record<string, unknown>[];
  insertedProducts: Record<string, unknown>[];
  insertedSynonyms: Record<string, unknown>[];
  priceReportInsertShouldFailFor?: string; // ean to reject with a 23505, simulating the daily-dedup constraint
  /** Candidates returned by the mocked match_product_for_upsert RPC — empty means "no fuzzy match, create a new product". */
  matchCandidates: MatchCandidate[];
  nextProductId: () => string;
}

function makeMockClient(db: MockDb) {
  return {
    rpc(fn: string, _args: Record<string, unknown>) {
      if (fn === 'match_product_for_upsert') {
        return Promise.resolve({ data: db.matchCandidates, error: null });
      }
      throw new Error(`unexpected rpc in test: ${fn}`);
    },
    from(table: string) {
      if (table === 'receipt_imports') {
        return {
          select: () => ({
            eq: (_col: string, val: string) => ({
              maybeSingle: () => Promise.resolve({ data: db.receiptImports[val] ?? null, error: null }),
            }),
          }),
          insert: (row: Record<string, unknown>) => {
            const key = row.nfce_key as string;
            if (db.receiptImports[key]) {
              return Promise.resolve({ error: { code: '23505', message: 'duplicate key' } });
            }
            db.insertedReceiptImports.push(row);
            db.receiptImports[key] = { total_value: row.total_value as number, item_count: row.item_count as number };
            return Promise.resolve({ error: null });
          },
        };
      }
      if (table === 'stores') {
        return {
          select: () => ({
            eq: (_col: string, val: string) => ({
              maybeSingle: () => Promise.resolve({ data: db.stores.find((s) => s.cnpj === val) ?? null, error: null }),
            }),
          }),
        };
      }
      if (table === 'products') {
        return {
          select: (_cols?: string) => ({
            eq: (col: string, val: string) => ({
              maybeSingle: () =>
                Promise.resolve({
                  data: db.products.find((p) => (col === 'ean' ? p.ean === val : p.name === val)) ?? null,
                  error: null,
                }),
            }),
          }),
          insert: (row: Record<string, unknown>) => ({
            select: () => ({
              single: () => {
                const id = db.nextProductId();
                db.insertedProducts.push(row);
                db.products.push({ id, ean: (row.ean as string) ?? null, name: row.name as string });
                return Promise.resolve({ data: { id }, error: null });
              },
            }),
          }),
        };
      }
      if (table === 'price_reports') {
        return {
          select: (_cols?: string) => ({
            eq: (_col: string, val: string) =>
              Promise.resolve({
                data: (db.priceReportsByChave[val] ?? []).map((r) => ({
                  price: r.price,
                  metadata: r.metadata,
                  product: r.productName ? { name: r.productName } : null,
                })),
                error: null,
              }),
          }),
          insert: (row: Record<string, unknown>) => {
            if (row.ean === db.priceReportInsertShouldFailFor) {
              return Promise.resolve({ error: { code: '23505', message: 'duplicate key' } });
            }
            db.insertedPriceReports.push(row);
            return Promise.resolve({ error: null });
          },
        };
      }
      if (table === 'product_synonyms') {
        return {
          insert: (row: Record<string, unknown>) => {
            db.insertedSynonyms.push(row);
            return Promise.resolve({ error: null });
          },
        };
      }
      throw new Error(`unexpected table in test: ${table}`);
    },
  };
}

function freshDb(overrides: Partial<MockDb> = {}): MockDb {
  let counter = 0;
  return {
    receiptImports: {},
    stores: [],
    products: [],
    priceReportsByChave: {},
    insertedReceiptImports: [],
    insertedPriceReports: [],
    insertedProducts: [],
    insertedSynonyms: [],
    matchCandidates: [],
    nextProductId: () => `new-product-${++counter}`,
    ...overrides,
  };
}

const TWO_ITEM_RECEIPT: ParsedNfceReceipt = {
  storeName: 'Savegnago Supermercados',
  storeCnpj: '12.345.678/0001-90',
  items: [
    { ean: '7891234567890', description: 'Arroz Tipo 1 5kg', quantity: 2, unit: 'UN', unitPrice: 24.9, totalPrice: 49.8 },
    { ean: '7899876543210', description: 'Feijão Carioca 1kg', quantity: 1, unit: 'UN', unitPrice: 8.5, totalPrice: 8.5 },
  ],
};

Deno.test('persistReceipt - a fresh processed receipt writes receipt_imports and one price_reports row per item', async () => {
  const db = freshDb({
    stores: [{ id: 'store-1', cnpj: '12345678000190' }],
    products: [{ id: 'product-1', ean: '7891234567890', name: 'Arroz Tio João 5kg' }],
  });
  const client = makeMockClient(db);

  const result = await persistReceipt(client, {
    chNFe: CHAVE,
    anonymousId: 'anon-1',
    rawHtml: '<html></html>',
    totalValueFromQr: 58.3,
    parsed: TWO_ITEM_RECEIPT,
  });

  assertEquals(result.status, 'processed');
  assertEquals(result.itemCount, 2);
  assertEquals(result.savedItemCount, 2);
  assertEquals(result.totalValue, 58.3);

  assertEquals(db.insertedReceiptImports.length, 1);
  assertEquals(db.insertedReceiptImports[0].store_id, 'store-1');
  assertEquals(db.insertedReceiptImports[0].store_cnpj, '12345678000190');
  assertEquals(db.insertedReceiptImports[0].status, 'processed');

  assertEquals(db.insertedPriceReports.length, 2);
  assertEquals(db.insertedPriceReports[0].product_id, 'product-1'); // matched by EAN
  assertEquals(db.insertedPriceReports[0].confidence, 1.0);
  assertEquals(db.insertedPriceReports[0].source, 'nfce_receipt');
  assertEquals(db.insertedPriceReports[0].store_id, 'store-1');
  // item[1]'s EAN doesn't match any catalog product — falls back to
  // findOrCreateProduct, which (no fuzzy candidates seeded here) creates a
  // new product rather than leaving this orphaned.
  assertEquals(db.insertedPriceReports[1].product_id, 'new-product-1');
  assertEquals(db.insertedProducts.length, 1);
  assertEquals(db.insertedProducts[0].name, 'Feijão Carioca 1kg');
  assertEquals(db.insertedProducts[0].reference_price, 8.5);

  // Feedback shown to the user: the actual items, with the resolved
  // catalog name (not the raw receipt text) for the EAN-matched one.
  assertEquals(result.items.length, 2);
  assertEquals(result.items[0], { name: 'Arroz Tio João 5kg', quantity: 2, unit: 'UN', price: 24.9, saved: true });
  assertEquals(result.items[1], { name: 'Feijão Carioca 1kg', quantity: 1, unit: 'UN', price: 8.5, saved: true });
});

Deno.test('persistReceipt - falls back to QR-param-only (status partial) when html parsing failed', async () => {
  const db = freshDb();
  const client = makeMockClient(db);

  const result = await persistReceipt(client, {
    chNFe: CHAVE,
    anonymousId: 'anon-1',
    rawHtml: '<html>unrecognized markup</html>',
    totalValueFromQr: 87.4,
    parsed: null,
  });

  assertEquals(result.status, 'partial');
  assertEquals(result.itemCount, 0);
  assertEquals(result.savedItemCount, 0);
  assertEquals(result.totalValue, 87.4); // falls back to the QR's own vNF
  assertEquals(result.items, []); // nothing was scraped — no item feedback to show
  assertEquals(db.insertedPriceReports.length, 0); // no items to attribute a price to
  assertEquals(db.insertedReceiptImports[0].status, 'partial');
});

Deno.test('persistReceipt - a receipt with no CNPJ match still saves, with store_id null', async () => {
  const db = freshDb(); // no stores seeded — CNPJ from the receipt matches nothing
  const client = makeMockClient(db);

  const result = await persistReceipt(client, {
    chNFe: CHAVE,
    anonymousId: 'anon-1',
    rawHtml: '<html></html>',
    totalValueFromQr: 58.3,
    parsed: TWO_ITEM_RECEIPT,
  });

  assertEquals(result.status, 'processed');
  assertEquals(db.insertedReceiptImports[0].store_id, null);
  assertEquals(db.insertedPriceReports[0].store_id, null);
});

Deno.test('persistReceipt - a previously-processed chNFe short-circuits as already_processed, reconstructing items from price_reports', async () => {
  const db = freshDb({
    receiptImports: { [CHAVE]: { total_value: 58.3, item_count: 2 } },
    priceReportsByChave: {
      [CHAVE]: [
        { price: 24.9, metadata: { quantity: 2, unit: 'UN', description: 'ARROZ TIPO 1 5KG' }, productName: 'Arroz Tio João 5kg' },
        { price: 8.5, metadata: { quantity: 1, unit: 'UN', description: 'FEIJAO CARIOCA 1KG' }, productName: null },
      ],
    },
  });
  const client = makeMockClient(db);

  const result = await persistReceipt(client, {
    chNFe: CHAVE,
    anonymousId: 'anon-2', // even a different device re-scanning the same physical receipt
    rawHtml: '<html></html>',
    totalValueFromQr: 58.3,
    parsed: TWO_ITEM_RECEIPT,
  });

  assertEquals(result.status, 'already_processed');
  assertEquals(result.totalValue, 58.3);
  assertEquals(result.itemCount, 2);
  assertEquals(db.insertedReceiptImports.length, 0);
  assertEquals(db.insertedPriceReports.length, 0);

  // A re-scan shows the same feedback as the original scan, not just a bare
  // count/total — resolved product name where available, falling back to
  // the receipt's raw description for a report with no linked product.
  assertEquals(result.items.length, 2);
  assertEquals(result.items[0], { name: 'Arroz Tio João 5kg', quantity: 2, unit: 'UN', price: 24.9, saved: true });
  assertEquals(result.items[1], { name: 'FEIJAO CARIOCA 1KG', quantity: 1, unit: 'UN', price: 8.5, saved: true });
});

Deno.test('persistReceipt - one item losing the daily-dedup race does not block the rest of the receipt', async () => {
  const db = freshDb({ priceReportInsertShouldFailFor: '7891234567890' });
  const client = makeMockClient(db);

  const result = await persistReceipt(client, {
    chNFe: CHAVE,
    anonymousId: 'anon-1',
    rawHtml: '<html></html>',
    totalValueFromQr: 58.3,
    parsed: TWO_ITEM_RECEIPT,
  });

  assertEquals(result.status, 'processed');
  assertEquals(result.itemCount, 2);
  assertEquals(result.savedItemCount, 1); // one of the two lost the race
  assertEquals(db.insertedPriceReports.length, 1);
  assertEquals(db.insertedPriceReports[0].ean, '7899876543210');

  // Both items are still shown to the user — the lost-race one flagged as not saved.
  assertEquals(result.items.length, 2);
  assertEquals(result.items[0].saved, false);
  assertEquals(result.items[1].saved, true);
});

Deno.test('persistReceipt - an item with no EAN and no fuzzy match creates a new product instead of staying orphaned', async () => {
  const db = freshDb();
  const client = makeMockClient(db);
  const receiptWithUnknownItem: ParsedNfceReceipt = {
    storeName: null,
    storeCnpj: null,
    items: [{ ean: null, description: 'Item avulso sem código', quantity: 1, unit: 'UN', unitPrice: 3.5, totalPrice: 3.5 }],
  };

  const result = await persistReceipt(client, {
    chNFe: CHAVE,
    anonymousId: 'anon-1',
    rawHtml: '<html></html>',
    totalValueFromQr: 3.5,
    parsed: receiptWithUnknownItem,
  });

  assertEquals(result.savedItemCount, 1);
  assertEquals(db.insertedPriceReports[0].ean, null); // no EAN on the receipt itself — unchanged
  assertEquals(db.insertedPriceReports[0].product_id, 'new-product-1');
  assertEquals(db.insertedProducts[0].name, 'Item Avulso Sem Código');
  assertEquals(db.insertedProducts[0].reference_price, 3.5);
  // Learned as a synonym so the exact same receipt phrasing fast-paths to
  // this product next time, instead of re-running fuzzy matching.
  assertEquals(db.insertedSynonyms.length, 1);
  assertEquals(db.insertedSynonyms[0].term, 'Item Avulso Sem Código');
  assertEquals(db.insertedSynonyms[0].product_id, 'new-product-1');

  assertEquals(result.items[0].name, 'Item Avulso Sem Código'); // the resolved (created) product's name, not the raw description
});

Deno.test('persistReceipt - reuses an existing fuzzy-matched product instead of creating a duplicate', async () => {
  const db = freshDb({
    matchCandidates: [
      { id: 'existing-product-1', name: 'Água Mineral Levíssima 1,5L', brand: null, match_type: 'fuzzy', match_score: 0.8, confidence: 0.7 },
    ],
  });
  const client = makeMockClient(db);
  const receipt: ParsedNfceReceipt = {
    storeName: null,
    storeCnpj: null,
    items: [{ ean: null, description: 'AGUA MIN LEVISSIMA 1,5L SG', quantity: 1, unit: 'UN', unitPrice: 2.29, totalPrice: 2.29 }],
  };

  const result = await persistReceipt(client, {
    chNFe: CHAVE,
    anonymousId: 'anon-1',
    rawHtml: '<html></html>',
    totalValueFromQr: 2.29,
    parsed: receipt,
  });

  assertEquals(result.savedItemCount, 1);
  assertEquals(db.insertedPriceReports[0].product_id, 'existing-product-1');
  assertEquals(db.insertedProducts.length, 0); // reused the match — no new product created
  assertEquals(db.insertedSynonyms.length, 0); // no synonym learned from a fuzzy (non-exact) match — only from a fresh create
  assertEquals(result.items[0].name, 'Água Mineral Levíssima 1,5L'); // the matched product's real name, not the raw receipt text
});

Deno.test('persistReceipt - a size-incompatible fuzzy candidate is rejected, creating a new product instead of misattributing the price', async () => {
  const db = freshDb({
    matchCandidates: [
      { id: 'wrong-size-product', name: 'Agua Min Levissima 500ml', brand: null, match_type: 'fuzzy', match_score: 0.7, confidence: 0.6 },
    ],
  });
  const client = makeMockClient(db);
  const receipt: ParsedNfceReceipt = {
    storeName: null,
    storeCnpj: null,
    items: [{ ean: null, description: 'AGUA MIN LEVISSIMA 1,5L SG', quantity: 1, unit: 'UN', unitPrice: 2.29, totalPrice: 2.29 }],
  };

  const result = await persistReceipt(client, {
    chNFe: CHAVE,
    anonymousId: 'anon-1',
    rawHtml: '<html></html>',
    totalValueFromQr: 2.29,
    parsed: receipt,
  });

  assertEquals(result.savedItemCount, 1);
  assertEquals(db.insertedPriceReports[0].product_id, 'new-product-1'); // rejected the 500ml candidate — different size
  assertEquals(db.insertedProducts.length, 1);
  assertEquals(db.insertedSynonyms.length, 1); // learned so this exact phrasing matches the new 1,5L product directly next time
  assertEquals(db.insertedSynonyms[0].term, 'Agua Min Levissima 1,5l Sg');
  assertEquals(result.items[0].name, 'Agua Min Levissima 1,5l Sg');
});
