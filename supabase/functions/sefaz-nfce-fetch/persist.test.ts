import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { persistReceipt } from './persist.ts';
import type { ParsedNfceReceipt } from './html-parser.ts';

const CHAVE = '35260712345678000190650010000012345678901234';

interface MockDb {
  receiptImports: Record<string, { total_value: number; item_count: number }>;
  stores: { id: string; cnpj: string }[];
  products: { id: string; ean: string }[];
  insertedReceiptImports: Record<string, unknown>[];
  insertedPriceReports: Record<string, unknown>[];
  priceReportInsertShouldFailFor?: string; // ean to reject with a 23505, simulating the daily-dedup constraint
}

function makeMockClient(db: MockDb) {
  return {
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
          select: () => ({
            eq: (_col: string, val: string) => ({
              maybeSingle: () => Promise.resolve({ data: db.products.find((p) => p.ean === val) ?? null, error: null }),
            }),
          }),
        };
      }
      if (table === 'price_reports') {
        return {
          insert: (row: Record<string, unknown>) => {
            if (row.ean === db.priceReportInsertShouldFailFor) {
              return Promise.resolve({ error: { code: '23505', message: 'duplicate key' } });
            }
            db.insertedPriceReports.push(row);
            return Promise.resolve({ error: null });
          },
        };
      }
      throw new Error(`unexpected table in test: ${table}`);
    },
  };
}

function freshDb(overrides: Partial<MockDb> = {}): MockDb {
  return {
    receiptImports: {},
    stores: [],
    products: [],
    insertedReceiptImports: [],
    insertedPriceReports: [],
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
  const db = freshDb({ stores: [{ id: 'store-1', cnpj: '12345678000190' }], products: [{ id: 'product-1', ean: '7891234567890' }] });
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
  assertEquals(db.insertedPriceReports[1].product_id, null); // no matching product row in this fixture
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

Deno.test('persistReceipt - a previously-processed chNFe short-circuits as already_processed, no duplicate writes', async () => {
  const db = freshDb({ receiptImports: { [CHAVE]: { total_value: 58.3, item_count: 2 } } });
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
});

Deno.test('persistReceipt - an item with no EAN on the receipt still saves (product_id null), not skipped', async () => {
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
  assertEquals(db.insertedPriceReports[0].ean, null);
  assertEquals(db.insertedPriceReports[0].product_id, null);
});
