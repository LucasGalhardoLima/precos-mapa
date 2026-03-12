// mobile/__tests__/hooks/use-store-ranking-logic.test.ts

// Replicate the store ranking algorithm from use-store-ranking.ts

const REFERENCE_BASKET = [
  'Arroz', 'Feijão', 'Óleo', 'Açúcar', 'Leite', 'Café', 'Farinha', 'Sal',
] as const;

interface PromoRow {
  product_id: string;
  promo_price: number;
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

const MIN_ITEMS = 3;

function rankStores(promoRows: PromoRow[]): StoreRankEntry[] | null {
  // Filter for basket items
  const basketPromos = promoRows.filter((row) => {
    const productName = row.product?.name ?? '';
    return REFERENCE_BASKET.some((item) =>
      productName.toLowerCase().includes(item.toLowerCase()),
    );
  });

  if (basketPromos.length === 0) return null;

  // Group by store, cheapest per basket item
  const storeMap = new Map<
    string,
    { name: string; basketPrices: Map<string, number> }
  >();

  for (const promo of basketPromos) {
    const storeId = promo.store?.id ?? promo.store_id;
    const storeName = promo.store?.name ?? 'Loja';
    const productName = promo.product?.name ?? '';

    const matchedItem = REFERENCE_BASKET.find((item) =>
      productName.toLowerCase().includes(item.toLowerCase()),
    );
    if (!matchedItem) continue;

    if (!storeMap.has(storeId)) {
      storeMap.set(storeId, { name: storeName, basketPrices: new Map() });
    }

    const entry = storeMap.get(storeId)!;
    const current = entry.basketPrices.get(matchedItem);
    if (current === undefined || promo.promo_price < current) {
      entry.basketPrices.set(matchedItem, promo.promo_price);
    }
  }

  // Filter: at least MIN_ITEMS basket items
  const storeEntries: { id: string; name: string; totalPrice: number }[] = [];
  for (const [storeId, { name, basketPrices }] of storeMap) {
    if (basketPrices.size < MIN_ITEMS) continue;
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

function makePromo(
  storeId: string,
  storeName: string,
  productName: string,
  promoPrice: number,
): PromoRow {
  return {
    product_id: `prod-${productName.toLowerCase()}`,
    promo_price: promoPrice,
    store_id: storeId,
    product: { name: productName },
    store: { id: storeId, name: storeName },
  };
}

// ===========================================================================
// Tests
// ===========================================================================

describe('Store Ranking — Basket Filtering', () => {
  it('returns null when no promos match basket items', () => {
    const promos = [
      makePromo('s1', 'Loja A', 'Cerveja', 8.0),
      makePromo('s1', 'Loja A', 'Refrigerante', 5.0),
    ];

    expect(rankStores(promos)).toBeNull();
  });

  it('matches basket items case-insensitively', () => {
    const promos = [
      makePromo('s1', 'Loja A', 'arroz integral', 6.0),
      makePromo('s1', 'Loja A', 'FEIJÃO preto', 7.0),
      makePromo('s1', 'Loja A', 'Óleo de soja', 5.0),
    ];

    const result = rankStores(promos);
    expect(result).not.toBeNull();
    expect(result).toHaveLength(1);
  });

  it('matches partial names (e.g. "Arroz integral" matches "Arroz")', () => {
    const promos = [
      makePromo('s1', 'Loja A', 'Arroz integral tipo 1', 6.0),
      makePromo('s1', 'Loja A', 'Feijão carioca 1kg', 7.0),
      makePromo('s1', 'Loja A', 'Leite integral', 4.0),
    ];

    const result = rankStores(promos);
    expect(result).not.toBeNull();
  });
});

describe('Store Ranking — Minimum Items Filter', () => {
  it('excludes stores with fewer than 3 basket items', () => {
    const promos = [
      // Store A has only 2 items
      makePromo('s1', 'Loja A', 'Arroz', 6.0),
      makePromo('s1', 'Loja A', 'Feijão', 7.0),
      // Store B has 3 items
      makePromo('s2', 'Loja B', 'Arroz', 5.0),
      makePromo('s2', 'Loja B', 'Feijão', 6.0),
      makePromo('s2', 'Loja B', 'Leite', 4.0),
    ];

    const result = rankStores(promos);
    expect(result).toHaveLength(1);
    expect(result![0].name).toBe('Loja B');
  });

  it('returns null when all stores have fewer than 3 items', () => {
    const promos = [
      makePromo('s1', 'Loja A', 'Arroz', 6.0),
      makePromo('s1', 'Loja A', 'Feijão', 7.0),
    ];

    expect(rankStores(promos)).toBeNull();
  });
});

describe('Store Ranking — Cheapest Per Basket Item', () => {
  it('picks cheapest promo when store has multiple for same basket item', () => {
    const promos = [
      makePromo('s1', 'Loja A', 'Arroz tipo 1', 8.0),
      makePromo('s1', 'Loja A', 'Arroz integral', 6.0), // cheaper, same basket item
      makePromo('s1', 'Loja A', 'Feijão', 7.0),
      makePromo('s1', 'Loja A', 'Leite', 4.0),
    ];

    const result = rankStores(promos);
    expect(result).toHaveLength(1);
    // Arroz cheapest = 6.0, Feijão = 7.0, Leite = 4.0 → total = 17.0
    expect(result![0].totalPrice).toBe(17.0);
  });
});

describe('Store Ranking — Sorting & Top 3', () => {
  it('ranks stores by total basket price ascending', () => {
    const promos = [
      // Store A: Arroz 6, Feijão 7, Leite 4 = 17
      makePromo('s1', 'Loja A', 'Arroz', 6.0),
      makePromo('s1', 'Loja A', 'Feijão', 7.0),
      makePromo('s1', 'Loja A', 'Leite', 4.0),
      // Store B: Arroz 5, Feijão 6, Leite 3 = 14
      makePromo('s2', 'Loja B', 'Arroz', 5.0),
      makePromo('s2', 'Loja B', 'Feijão', 6.0),
      makePromo('s2', 'Loja B', 'Leite', 3.0),
      // Store C: Arroz 7, Feijão 8, Leite 5 = 20
      makePromo('s3', 'Loja C', 'Arroz', 7.0),
      makePromo('s3', 'Loja C', 'Feijão', 8.0),
      makePromo('s3', 'Loja C', 'Leite', 5.0),
    ];

    const result = rankStores(promos);
    expect(result).toHaveLength(3);
    expect(result![0].name).toBe('Loja B');  // 14 → rank 1
    expect(result![1].name).toBe('Loja A');  // 17 → rank 2
    expect(result![2].name).toBe('Loja C');  // 20 → rank 3
  });

  it('limits to top 3 stores', () => {
    const items = ['Arroz', 'Feijão', 'Leite'];
    const promos = Array.from({ length: 5 }, (_, i) =>
      items.map((item) =>
        makePromo(`s${i}`, `Loja ${i}`, item, 5.0 + i),
      ),
    ).flat();

    const result = rankStores(promos);
    expect(result).toHaveLength(3);
  });

  it('assigns ranks 1, 2, 3', () => {
    const items = ['Arroz', 'Feijão', 'Leite'];
    const promos = [
      ...items.map((item) => makePromo('s1', 'A', item, 10.0)),
      ...items.map((item) => makePromo('s2', 'B', item, 8.0)),
      ...items.map((item) => makePromo('s3', 'C', item, 12.0)),
    ];

    const result = rankStores(promos);
    expect(result!.map((r) => r.rank)).toEqual([1, 2, 3]);
  });
});

describe('Store Ranking — Savings Percent', () => {
  it('calculates savings relative to most expensive in top 3', () => {
    const promos = [
      // Store A: total = 14
      makePromo('s1', 'Loja A', 'Arroz', 5.0),
      makePromo('s1', 'Loja A', 'Feijão', 5.0),
      makePromo('s1', 'Loja A', 'Leite', 4.0),
      // Store B: total = 20
      makePromo('s2', 'Loja B', 'Arroz', 7.0),
      makePromo('s2', 'Loja B', 'Feijão', 7.0),
      makePromo('s2', 'Loja B', 'Leite', 6.0),
    ];

    const result = rankStores(promos);
    // Store A: (1 - 14/20) * 100 = 30%
    expect(result![0].savingsPercent).toBe(30);
    // Store B: most expensive → 0%
    expect(result![1].savingsPercent).toBe(0);
  });

  it('most expensive store in top 3 always has 0% savings', () => {
    const items = ['Arroz', 'Feijão', 'Leite'];
    const promos = [
      ...items.map((item) => makePromo('s1', 'A', item, 5.0)),
      ...items.map((item) => makePromo('s2', 'B', item, 8.0)),
    ];

    const result = rankStores(promos);
    const lastStore = result![result!.length - 1];
    expect(lastStore.savingsPercent).toBe(0);
  });
});
