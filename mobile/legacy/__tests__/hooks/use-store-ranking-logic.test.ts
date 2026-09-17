// mobile/__tests__/hooks/use-store-ranking-logic.test.ts

// Replicate the store ranking algorithm from use-store-ranking.ts

const REFERENCE_BASKET = [
  'Arroz', 'Feijão', 'Óleo', 'Açúcar', 'Leite', 'Café', 'Farinha', 'Sal',
] as const;

interface PriceRow {
  product_id: string;
  price: number;
  store_id: string;
  product: { name: string };
  store: { id: string; name: string };
}

interface StoreRankEntry {
  id: string;
  name: string;
  totalPrice: number;
  savingsPercent: number;
  rank: 1 | 2 | 3;
}

function rankStores(priceRows: PriceRow[]): StoreRankEntry[] | null {
  // Filter for basket items
  const basketPrices = priceRows.filter((row) => {
    const productName = row.product?.name ?? '';
    return REFERENCE_BASKET.some((item) =>
      productName.toLowerCase().includes(item.toLowerCase()),
    );
  });

  if (basketPrices.length === 0) return null;

  // Group by store, cheapest per basket item
  const storeMap = new Map<
    string,
    { name: string; basketPrices: Map<string, number> }
  >();

  for (const row of basketPrices) {
    const storeId = row.store?.id ?? row.store_id;
    const storeName = row.store?.name ?? 'Loja';
    const productName = row.product?.name ?? '';

    const matchedItem = REFERENCE_BASKET.find((item) =>
      productName.toLowerCase().includes(item.toLowerCase()),
    );
    if (!matchedItem) continue;

    if (!storeMap.has(storeId)) {
      storeMap.set(storeId, { name: storeName, basketPrices: new Map() });
    }

    const entry = storeMap.get(storeId)!;
    const current = entry.basketPrices.get(matchedItem);
    if (current === undefined || row.price < current) {
      entry.basketPrices.set(matchedItem, row.price);
    }
  }

  // Require ALL 8 basket items — a partial basket isn't a fair comparison
  const storeEntries: { id: string; name: string; totalPrice: number }[] = [];
  for (const [storeId, { name, basketPrices }] of storeMap) {
    if (basketPrices.size < REFERENCE_BASKET.length) continue;
    let totalPrice = 0;
    for (const [, price] of basketPrices) totalPrice += price;
    storeEntries.push({ id: storeId, name, totalPrice });
  }

  if (storeEntries.length === 0) return null;

  // Sort by total ascending, take top 3
  storeEntries.sort((a, b) => a.totalPrice - b.totalPrice);
  const top3 = storeEntries.slice(0, 3);

  // savingsPercent relative to most expensive in top 3
  const highestPrice = top3[top3.length - 1].totalPrice;

  return top3.map((entry, index) => ({
    id: entry.id,
    name: entry.name,
    totalPrice: Math.round(entry.totalPrice * 100) / 100,
    savingsPercent:
      highestPrice > 0
        ? Math.round((1 - entry.totalPrice / highestPrice) * 100)
        : 0,
    rank: (index + 1) as 1 | 2 | 3,
  }));
}

// ===========================================================================
// Helpers
// ===========================================================================

function makePrice(
  storeId: string,
  storeName: string,
  productName: string,
  price: number,
): PriceRow {
  return {
    product_id: `prod-${productName.toLowerCase()}`,
    price,
    store_id: storeId,
    product: { name: productName },
    store: { id: storeId, name: storeName },
  };
}

/** A full 8-item basket for one store, all at the same price — override individual items via `overrides`. */
function makeFullBasket(
  storeId: string,
  storeName: string,
  basePrice: number,
  overrides: Partial<Record<(typeof REFERENCE_BASKET)[number], number>> = {},
): PriceRow[] {
  return REFERENCE_BASKET.map((item) =>
    makePrice(storeId, storeName, item, overrides[item] ?? basePrice),
  );
}

// ===========================================================================
// Tests
// ===========================================================================

describe('Store Ranking — Basket Filtering', () => {
  it('returns null when no prices match basket items', () => {
    const prices = [
      makePrice('s1', 'Loja A', 'Cerveja', 8.0),
      makePrice('s1', 'Loja A', 'Refrigerante', 5.0),
    ];

    expect(rankStores(prices)).toBeNull();
  });

  it('matches basket items case-insensitively', () => {
    const prices = makeFullBasket('s1', 'Loja A', 6.0).map((row) => ({
      ...row,
      product: { name: row.product.name.toLowerCase() },
    }));

    const result = rankStores(prices);
    expect(result).not.toBeNull();
    expect(result).toHaveLength(1);
  });

  it('matches partial names (e.g. "Arroz integral" matches "Arroz")', () => {
    const prices = makeFullBasket('s1', 'Loja A', 6.0, { Arroz: 6.0 }).map((row) =>
      row.product.name === 'Arroz' ? { ...row, product: { name: 'Arroz integral tipo 1' } } : row,
    );

    const result = rankStores(prices);
    expect(result).not.toBeNull();
  });
});

describe('Store Ranking — Requires the Full Basket', () => {
  it('excludes stores missing even one basket item', () => {
    const prices = [
      // Store A has all 8 items
      ...makeFullBasket('s1', 'Loja A', 6.0),
      // Store B has only 7 of the 8 items (missing Sal)
      ...makeFullBasket('s2', 'Loja B', 5.0).filter((row) => row.product.name !== 'Sal'),
    ];

    const result = rankStores(prices);
    expect(result).toHaveLength(1);
    expect(result![0].name).toBe('Loja A');
  });

  it('returns null when no store has all 8 basket items', () => {
    const prices = [
      makePrice('s1', 'Loja A', 'Arroz', 6.0),
      makePrice('s1', 'Loja A', 'Feijão', 7.0),
    ];

    expect(rankStores(prices)).toBeNull();
  });
});

describe('Store Ranking — Cheapest Per Basket Item', () => {
  it('picks cheapest price when a store has multiple entries for the same basket item', () => {
    const prices = [
      ...makeFullBasket('s1', 'Loja A', 5.0),
      makePrice('s1', 'Loja A', 'Arroz integral', 8.0), // pricier duplicate for the same basket item
      makePrice('s1', 'Loja A', 'Arroz tipo 1', 3.0),   // cheaper duplicate — should win
    ];

    const result = rankStores(prices);
    expect(result).toHaveLength(1);
    // 7 items at 5.0 + Arroz at cheapest (3.0) = 38.0
    expect(result![0].totalPrice).toBe(38.0);
  });
});

describe('Store Ranking — Sorting & Top 3', () => {
  it('ranks stores by total basket price ascending', () => {
    const prices = [
      ...makeFullBasket('s1', 'Loja A', 17 / 8), // arbitrary total, see below
      ...makeFullBasket('s2', 'Loja B', 14 / 8),
      ...makeFullBasket('s3', 'Loja C', 20 / 8),
    ];

    const result = rankStores(prices);
    expect(result).toHaveLength(3);
    expect(result![0].name).toBe('Loja B'); // cheapest total
    expect(result![1].name).toBe('Loja A');
    expect(result![2].name).toBe('Loja C'); // priciest total
  });

  it('limits to top 3 stores', () => {
    const prices = Array.from({ length: 5 }, (_, i) => makeFullBasket(`s${i}`, `Loja ${i}`, 5.0 + i)).flat();

    const result = rankStores(prices);
    expect(result).toHaveLength(3);
  });

  it('assigns ranks 1, 2, 3', () => {
    const prices = [
      ...makeFullBasket('s1', 'A', 10.0),
      ...makeFullBasket('s2', 'B', 8.0),
      ...makeFullBasket('s3', 'C', 12.0),
    ];

    const result = rankStores(prices);
    expect(result!.map((r) => r.rank)).toEqual([1, 2, 3]);
  });
});

describe('Store Ranking — Savings Percent', () => {
  it('calculates savings relative to most expensive in top 3', () => {
    const prices = [
      ...makeFullBasket('s1', 'Loja A', 14 / 8), // total = 14
      ...makeFullBasket('s2', 'Loja B', 20 / 8), // total = 20
    ];

    const result = rankStores(prices);
    // Store A: (1 - 14/20) * 100 = 30%
    expect(result![0].savingsPercent).toBe(30);
    // Store B: most expensive → 0%
    expect(result![1].savingsPercent).toBe(0);
  });

  it('most expensive store in top 3 always has 0% savings', () => {
    const prices = [
      ...makeFullBasket('s1', 'A', 5.0),
      ...makeFullBasket('s2', 'B', 8.0),
    ];

    const result = rankStores(prices);
    const lastStore = result![result!.length - 1];
    expect(lastStore.savingsPercent).toBe(0);
  });
});
