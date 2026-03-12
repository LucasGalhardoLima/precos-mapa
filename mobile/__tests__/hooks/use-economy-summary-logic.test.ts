// mobile/__tests__/hooks/use-economy-summary-logic.test.ts

// Replicate the economy summary calculation logic from use-economy-summary.ts

interface PromoRow {
  product_id: string;
  promo_price: number;
  store_id: string;
  store: { id: string; name: string };
}

interface ProductRow {
  id: string;
  reference_price: number;
}

interface EconomySummary {
  totalSavings: number;
  cheapestStore: { id: string; name: string } | null;
  mode: 'list' | 'deals';
  itemCount: number;
}

const EMPTY_SUMMARY: EconomySummary = {
  totalSavings: 0,
  cheapestStore: null,
  mode: 'deals',
  itemCount: 0,
};

// ---------------------------------------------------------------------------
// List mode: savings = sum(reference_price - cheapest promo) per product
// ---------------------------------------------------------------------------

function calculateListMode(
  productIds: string[],
  promoRows: PromoRow[],
  products: ProductRow[],
  itemCount: number,
): EconomySummary {
  if (productIds.length === 0) return EMPTY_SUMMARY;
  if (promoRows.length === 0) return { ...EMPTY_SUMMARY, mode: 'list', itemCount };

  // Build cheapest promo per product
  const cheapestPromo = new Map<string, number>();
  const cheapestStorePerProduct = new Map<string, { id: string; name: string }>();

  for (const row of promoRows) {
    const current = cheapestPromo.get(row.product_id);
    if (current === undefined || row.promo_price < current) {
      cheapestPromo.set(row.product_id, row.promo_price);
      cheapestStorePerProduct.set(row.product_id, {
        id: row.store?.id ?? row.store_id,
        name: row.store?.name ?? 'Loja',
      });
    }
  }

  // Build reference price map
  const refPriceMap = new Map<string, number>();
  for (const p of products) {
    refPriceMap.set(p.id, p.reference_price);
  }

  // Calculate total savings
  let totalSavings = 0;
  for (const productId of productIds) {
    const refPrice = refPriceMap.get(productId);
    const promoPrice = cheapestPromo.get(productId);
    if (refPrice !== undefined && promoPrice !== undefined && promoPrice < refPrice) {
      totalSavings += refPrice - promoPrice;
    }
  }

  // Cheapest store = store that appears most often as cheapest
  const storeFrequency = new Map<string, { count: number; store: { id: string; name: string } }>();
  for (const [, store] of cheapestStorePerProduct) {
    const entry = storeFrequency.get(store.id);
    if (entry) {
      entry.count += 1;
    } else {
      storeFrequency.set(store.id, { count: 1, store });
    }
  }

  let cheapestStore: { id: string; name: string } | null = null;
  let maxCount = 0;
  for (const [, { count, store }] of storeFrequency) {
    if (count > maxCount) {
      maxCount = count;
      cheapestStore = store;
    }
  }

  return { totalSavings, cheapestStore, mode: 'list', itemCount };
}

// ---------------------------------------------------------------------------
// Deals mode: aggregate discount per store, find highest total discount
// ---------------------------------------------------------------------------

interface DealsPromoRow {
  original_price: number;
  promo_price: number;
  store_id: string;
  store: { id: string; name: string };
}

function calculateDealsMode(promoRows: DealsPromoRow[]): EconomySummary {
  if (promoRows.length === 0) return EMPTY_SUMMARY;

  const storeDiscountMap = new Map<
    string,
    { totalDiscount: number; store: { id: string; name: string }; dealCount: number }
  >();

  for (const row of promoRows) {
    const discount = row.original_price - row.promo_price;
    if (discount <= 0) continue;

    const storeId = row.store?.id ?? row.store_id;
    const storeName = row.store?.name ?? 'Loja';

    const entry = storeDiscountMap.get(storeId);
    if (entry) {
      entry.totalDiscount += discount;
      entry.dealCount += 1;
    } else {
      storeDiscountMap.set(storeId, {
        totalDiscount: discount,
        store: { id: storeId, name: storeName },
        dealCount: 1,
      });
    }
  }

  let cheapestStore: { id: string; name: string } | null = null;
  let maxDiscount = 0;
  let totalSavings = 0;
  let itemCount = 0;

  for (const [, { totalDiscount, store, dealCount }] of storeDiscountMap) {
    totalSavings += totalDiscount;
    itemCount += dealCount;
    if (totalDiscount > maxDiscount) {
      maxDiscount = totalDiscount;
      cheapestStore = store;
    }
  }

  return { totalSavings, cheapestStore, mode: 'deals', itemCount };
}

// ===========================================================================
// Tests
// ===========================================================================

describe('Economy Summary — List Mode', () => {
  const storeA = { id: 'store-a', name: 'Mercado A' };
  const storeB = { id: 'store-b', name: 'Mercado B' };

  it('returns empty summary when no product IDs', () => {
    const result = calculateListMode([], [], [], 0);
    expect(result).toEqual(EMPTY_SUMMARY);
  });

  it('returns list mode empty when no promos found', () => {
    const result = calculateListMode(['p1', 'p2'], [], [], 3);
    expect(result).toEqual({ ...EMPTY_SUMMARY, mode: 'list', itemCount: 3 });
  });

  it('calculates savings as reference_price - cheapest promo_price', () => {
    const productIds = ['p1', 'p2'];
    const promoRows: PromoRow[] = [
      { product_id: 'p1', promo_price: 5.0, store_id: 'store-a', store: storeA },
      { product_id: 'p1', promo_price: 6.0, store_id: 'store-b', store: storeB },
      { product_id: 'p2', promo_price: 3.0, store_id: 'store-a', store: storeA },
    ];
    const products: ProductRow[] = [
      { id: 'p1', reference_price: 8.0 },
      { id: 'p2', reference_price: 4.0 },
    ];

    const result = calculateListMode(productIds, promoRows, products, 2);

    // p1: 8.0 - 5.0 = 3.0, p2: 4.0 - 3.0 = 1.0
    expect(result.totalSavings).toBe(4.0);
    expect(result.mode).toBe('list');
    expect(result.itemCount).toBe(2);
  });

  it('ignores products where promo_price >= reference_price', () => {
    const promoRows: PromoRow[] = [
      { product_id: 'p1', promo_price: 10.0, store_id: 'store-a', store: storeA },
    ];
    const products: ProductRow[] = [{ id: 'p1', reference_price: 8.0 }];

    const result = calculateListMode(['p1'], promoRows, products, 1);
    expect(result.totalSavings).toBe(0);
  });

  it('ignores products with no reference price', () => {
    const promoRows: PromoRow[] = [
      { product_id: 'p1', promo_price: 5.0, store_id: 'store-a', store: storeA },
    ];
    // No matching product in products array
    const result = calculateListMode(['p1'], promoRows, [], 1);
    expect(result.totalSavings).toBe(0);
  });

  it('picks cheapest promo when multiple exist for same product', () => {
    const promoRows: PromoRow[] = [
      { product_id: 'p1', promo_price: 7.0, store_id: 'store-b', store: storeB },
      { product_id: 'p1', promo_price: 4.0, store_id: 'store-a', store: storeA },
      { product_id: 'p1', promo_price: 6.0, store_id: 'store-b', store: storeB },
    ];
    const products: ProductRow[] = [{ id: 'p1', reference_price: 10.0 }];

    const result = calculateListMode(['p1'], promoRows, products, 1);
    // cheapest is 4.0 → savings = 10.0 - 4.0 = 6.0
    expect(result.totalSavings).toBe(6.0);
  });

  it('cheapestStore = store that appears most often as cheapest', () => {
    const promoRows: PromoRow[] = [
      // Store A is cheapest for p1 and p3
      { product_id: 'p1', promo_price: 3.0, store_id: 'store-a', store: storeA },
      { product_id: 'p1', promo_price: 5.0, store_id: 'store-b', store: storeB },
      // Store B is cheapest for p2
      { product_id: 'p2', promo_price: 6.0, store_id: 'store-a', store: storeA },
      { product_id: 'p2', promo_price: 2.0, store_id: 'store-b', store: storeB },
      // Store A is cheapest for p3
      { product_id: 'p3', promo_price: 1.0, store_id: 'store-a', store: storeA },
    ];
    const products: ProductRow[] = [
      { id: 'p1', reference_price: 10.0 },
      { id: 'p2', reference_price: 10.0 },
      { id: 'p3', reference_price: 10.0 },
    ];

    const result = calculateListMode(['p1', 'p2', 'p3'], promoRows, products, 3);
    // Store A is cheapest for p1 + p3 (2 times), Store B for p2 (1 time)
    expect(result.cheapestStore).toEqual(storeA);
  });

  it('falls back to store_id when store relation is null', () => {
    const promoRows: PromoRow[] = [
      { product_id: 'p1', promo_price: 5.0, store_id: 'store-x', store: null as any },
    ];
    const products: ProductRow[] = [{ id: 'p1', reference_price: 10.0 }];

    const result = calculateListMode(['p1'], promoRows, products, 1);
    expect(result.cheapestStore).toEqual({ id: 'store-x', name: 'Loja' });
  });
});

describe('Economy Summary — Deals Mode', () => {
  const storeA = { id: 'store-a', name: 'Mercado A' };
  const storeB = { id: 'store-b', name: 'Mercado B' };

  it('returns empty summary when no promos', () => {
    const result = calculateDealsMode([]);
    expect(result).toEqual(EMPTY_SUMMARY);
  });

  it('skips promos where original_price <= promo_price (no discount)', () => {
    const promoRows: DealsPromoRow[] = [
      { original_price: 5.0, promo_price: 5.0, store_id: 'store-a', store: storeA },
      { original_price: 3.0, promo_price: 4.0, store_id: 'store-a', store: storeA },
    ];

    const result = calculateDealsMode(promoRows);
    expect(result.totalSavings).toBe(0);
    expect(result.itemCount).toBe(0);
    expect(result.cheapestStore).toBeNull();
  });

  it('aggregates total discount across all stores', () => {
    const promoRows: DealsPromoRow[] = [
      { original_price: 10.0, promo_price: 7.0, store_id: 'store-a', store: storeA }, // 3.0
      { original_price: 8.0, promo_price: 5.0, store_id: 'store-a', store: storeA },  // 3.0
      { original_price: 6.0, promo_price: 4.0, store_id: 'store-b', store: storeB },  // 2.0
    ];

    const result = calculateDealsMode(promoRows);
    expect(result.totalSavings).toBe(8.0); // 3 + 3 + 2
    expect(result.itemCount).toBe(3);
  });

  it('cheapestStore = store with highest total discount', () => {
    const promoRows: DealsPromoRow[] = [
      // Store A: 2.0 + 1.0 = 3.0 total discount
      { original_price: 10.0, promo_price: 8.0, store_id: 'store-a', store: storeA },
      { original_price: 5.0, promo_price: 4.0, store_id: 'store-a', store: storeA },
      // Store B: 5.0 total discount
      { original_price: 12.0, promo_price: 7.0, store_id: 'store-b', store: storeB },
    ];

    const result = calculateDealsMode(promoRows);
    expect(result.cheapestStore).toEqual(storeB);
  });

  it('counts deals per store correctly', () => {
    const promoRows: DealsPromoRow[] = [
      { original_price: 10.0, promo_price: 7.0, store_id: 'store-a', store: storeA },
      { original_price: 8.0, promo_price: 5.0, store_id: 'store-a', store: storeA },
      { original_price: 6.0, promo_price: 4.0, store_id: 'store-b', store: storeB },
    ];

    const result = calculateDealsMode(promoRows);
    expect(result.itemCount).toBe(3);
    expect(result.mode).toBe('deals');
  });

  it('falls back to store_id when store relation is null', () => {
    const promoRows: DealsPromoRow[] = [
      { original_price: 10.0, promo_price: 5.0, store_id: 'store-x', store: null as any },
    ];

    const result = calculateDealsMode(promoRows);
    expect(result.cheapestStore).toEqual({ id: 'store-x', name: 'Loja' });
  });
});
