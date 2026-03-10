// mobile/__tests__/hooks/map-store-list-matching.test.ts

interface StoreListMatch {
  storeId: string;
  matchedItems: { productName: string; price: number; quantity: number }[];
  subtotal: number;
  isCheapest: boolean;
}

// Simplified matching algorithm from map.tsx
function computeStoreListMatches(
  listItems: { product_id: string; store_id?: string; quantity: number; product?: { name: string } }[],
  stores: { store: { id: string }; topDeals: { product_id: string; promo_price: number; product: { name: string } }[] }[],
): StoreListMatch[] {
  if (listItems.length === 0) return [];

  const storeById = new Map(stores.map((s) => [s.store.id, s]));

  // Group by origin store_id
  const storeItemsMap = new Map<string, StoreListMatch['matchedItems']>();
  const legacyItems: typeof listItems = [];

  for (const item of listItems) {
    if (item.store_id && storeById.has(item.store_id)) {
      const existing = storeItemsMap.get(item.store_id) ?? [];
      existing.push({
        productName: item.product?.name ?? 'Produto',
        price: 0,
        quantity: item.quantity,
      });
      storeItemsMap.set(item.store_id, existing);
    } else {
      legacyItems.push(item);
    }
  }

  const matches: StoreListMatch[] = [];

  // Origin store matches — look up price from topDeals
  for (const [storeId, matchedItems] of storeItemsMap) {
    const storeData = storeById.get(storeId)!;
    let subtotal = 0;
    for (const mi of matchedItems) {
      const listItem = listItems.find(
        (li) => li.store_id === storeId && (li.product?.name ?? 'Produto') === mi.productName,
      );
      if (listItem) {
        const deal = storeData.topDeals.find((d) => d.product_id === listItem.product_id);
        if (deal) mi.price = deal.promo_price;
      }
      subtotal += mi.price * mi.quantity;
    }
    matches.push({ storeId, matchedItems, subtotal, isCheapest: false });
  }

  // Legacy fallback — match by product_id in topDeals
  const legacyProductIds = new Set(legacyItems.map((i) => i.product_id));
  for (const storeData of stores) {
    if (storeItemsMap.has(storeData.store.id)) continue;
    const legacyMatched: StoreListMatch['matchedItems'] = [];
    let subtotal = 0;

    for (const deal of storeData.topDeals) {
      if (legacyProductIds.has(deal.product_id)) {
        const item = legacyItems.find((i) => i.product_id === deal.product_id)!;
        legacyMatched.push({
          productName: deal.product.name,
          price: deal.promo_price,
          quantity: item.quantity,
        });
        subtotal += deal.promo_price * item.quantity;
      }
    }

    if (legacyMatched.length > 0) {
      matches.push({ storeId: storeData.store.id, matchedItems: legacyMatched, subtotal, isCheapest: false });
    }
  }

  // Sort and mark cheapest
  matches.sort((a, b) => a.subtotal - b.subtotal);
  if (matches.length > 0) matches[0].isCheapest = true;

  return matches;
}

describe('Map Store-List Matching', () => {
  it('returns empty for no list items', () => {
    expect(computeStoreListMatches([], [])).toEqual([]);
  });

  it('matches items by origin store_id', () => {
    const items = [
      { product_id: 'p1', store_id: 's1', quantity: 1, product: { name: 'Leite' } },
    ];
    const stores = [
      { store: { id: 's1' }, topDeals: [{ product_id: 'p1', promo_price: 5, product: { name: 'Leite' } }] },
    ];
    const result = computeStoreListMatches(items, stores);
    expect(result).toHaveLength(1);
    expect(result[0].storeId).toBe('s1');
    expect(result[0].matchedItems[0].price).toBe(5);
    expect(result[0].isCheapest).toBe(true);
  });

  it('falls back to topDeals matching for items without store_id', () => {
    const items = [
      { product_id: 'p1', quantity: 2, product: { name: 'Leite' } },
    ];
    const stores = [
      { store: { id: 's1' }, topDeals: [{ product_id: 'p1', promo_price: 4, product: { name: 'Leite' } }] },
      { store: { id: 's2' }, topDeals: [] },
    ];
    const result = computeStoreListMatches(items, stores);
    expect(result).toHaveLength(1);
    expect(result[0].storeId).toBe('s1');
    expect(result[0].subtotal).toBe(8); // 4 * 2
  });

  it('marks cheapest store correctly across multiple stores', () => {
    const items = [
      { product_id: 'p1', quantity: 1, product: { name: 'Leite' } },
    ];
    const stores = [
      { store: { id: 's1' }, topDeals: [{ product_id: 'p1', promo_price: 10, product: { name: 'Leite' } }] },
      { store: { id: 's2' }, topDeals: [{ product_id: 'p1', promo_price: 5, product: { name: 'Leite' } }] },
    ];
    const result = computeStoreListMatches(items, stores);
    expect(result).toHaveLength(2);
    const cheapest = result.find((m) => m.isCheapest)!;
    expect(cheapest.storeId).toBe('s2');
    expect(cheapest.subtotal).toBe(5);
  });

  it('only marks one store as cheapest', () => {
    const items = [{ product_id: 'p1', quantity: 1, product: { name: 'Leite' } }];
    const stores = [
      { store: { id: 's1' }, topDeals: [{ product_id: 'p1', promo_price: 10, product: { name: 'Leite' } }] },
      { store: { id: 's2' }, topDeals: [{ product_id: 'p1', promo_price: 5, product: { name: 'Leite' } }] },
      { store: { id: 's3' }, topDeals: [{ product_id: 'p1', promo_price: 8, product: { name: 'Leite' } }] },
    ];
    const result = computeStoreListMatches(items, stores);
    const cheapestCount = result.filter((m) => m.isCheapest).length;
    expect(cheapestCount).toBe(1);
  });

  it('sorts by subtotal ascending', () => {
    const items = [{ product_id: 'p1', quantity: 1, product: { name: 'Leite' } }];
    const stores = [
      { store: { id: 's1' }, topDeals: [{ product_id: 'p1', promo_price: 10, product: { name: 'Leite' } }] },
      { store: { id: 's2' }, topDeals: [{ product_id: 'p1', promo_price: 3, product: { name: 'Leite' } }] },
      { store: { id: 's3' }, topDeals: [{ product_id: 'p1', promo_price: 7, product: { name: 'Leite' } }] },
    ];
    const result = computeStoreListMatches(items, stores);
    expect(result[0].subtotal).toBe(3);
    expect(result[1].subtotal).toBe(7);
    expect(result[2].subtotal).toBe(10);
  });

  it('skips stores already matched by origin when doing legacy fallback', () => {
    const items = [
      { product_id: 'p1', store_id: 's1', quantity: 1, product: { name: 'Leite' } },
      { product_id: 'p2', quantity: 1, product: { name: 'Pao' } }, // legacy
    ];
    const stores = [
      { store: { id: 's1' }, topDeals: [
        { product_id: 'p1', promo_price: 5, product: { name: 'Leite' } },
        { product_id: 'p2', promo_price: 3, product: { name: 'Pao' } },
      ]},
      { store: { id: 's2' }, topDeals: [
        { product_id: 'p2', promo_price: 2, product: { name: 'Pao' } },
      ]},
    ];
    const result = computeStoreListMatches(items, stores);
    // s1 matched by origin, s2 matched by legacy for p2
    // s1 should NOT also get p2 via legacy (it's already matched by origin)
    const s1 = result.find((m) => m.storeId === 's1')!;
    expect(s1.matchedItems).toHaveLength(1); // only p1
  });

  it('handles items with no matching store', () => {
    const items = [
      { product_id: 'p1', store_id: 's_nonexistent', quantity: 1, product: { name: 'Leite' } },
    ];
    const stores = [
      { store: { id: 's1' }, topDeals: [] },
    ];
    const result = computeStoreListMatches(items, stores);
    // store_id doesn't match any store, and no topDeals match either
    expect(result).toHaveLength(0);
  });

  it('uses fallback product name "Produto" when product is undefined', () => {
    const items = [
      { product_id: 'p1', store_id: 's1', quantity: 1 },
    ];
    const stores = [
      { store: { id: 's1' }, topDeals: [{ product_id: 'p1', promo_price: 5, product: { name: 'Leite' } }] },
    ];
    const result = computeStoreListMatches(items, stores);
    expect(result[0].matchedItems[0].productName).toBe('Produto');
  });
});
