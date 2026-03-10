// mobile/__tests__/hooks/use-shopping-list-logic.test.ts

// Replicate the optimization algorithm from use-shopping-list.ts
interface OptimizedStore {
  storeId: string;
  storeName: string;
  items: { productName: string; price: number; quantity: number }[];
  subtotal: number;
}

interface OptimizationResult {
  stores: OptimizedStore[];
  totalCost: number;
  estimatedSavings: number;
  mapsUrl: string;
}

function optimizeList(
  listItems: { product_id: string; quantity: number; product?: { name: string } }[],
  promotions: { product_id: string; promo_price: number; store_id: string; store: { id: string; name: string; latitude: number; longitude: number } }[],
  userLat: number,
  userLng: number,
): OptimizationResult | null {
  if (listItems.length === 0 || promotions.length === 0) return null;

  const storeMap = new Map<string, OptimizedStore>();
  let totalCost = 0;

  for (const item of listItems) {
    const productPromos = promotions.filter((p) => p.product_id === item.product_id);
    if (productPromos.length === 0) continue;

    const cheapest = productPromos.reduce((a, b) =>
      a.promo_price < b.promo_price ? a : b,
    );

    const storeId = cheapest.store.id;
    const storeName = cheapest.store.name;

    const entry = storeMap.get(storeId) ?? {
      storeId,
      storeName,
      items: [],
      subtotal: 0,
    };

    const itemCost = cheapest.promo_price * item.quantity;
    entry.items.push({
      productName: item.product?.name ?? 'Produto',
      price: cheapest.promo_price,
      quantity: item.quantity,
    });
    entry.subtotal += itemCost;
    totalCost += itemCost;

    storeMap.set(storeId, entry);
  }

  const estimatedSavings = Math.max(0, totalCost * 0.15);

  const stores = [...storeMap.values()];
  const waypoints = stores
    .map((s) => {
      const promo = promotions.find((p) => p.store.id === s.storeId);
      return promo ? `${promo.store.latitude},${promo.store.longitude}` : null;
    })
    .filter(Boolean);

  const mapsUrl =
    waypoints.length > 0
      ? `https://www.google.com/maps/dir/${userLat},${userLng}/${waypoints.join('/')}?optimize=true`
      : '';

  return { stores, totalCost, estimatedSavings, mapsUrl };
}

// Test helpers
const makePromo = (productId: string, storeId: string, price: number, storeName = 'Loja') => ({
  product_id: productId,
  promo_price: price,
  store_id: storeId,
  store: { id: storeId, name: storeName, latitude: -21.6, longitude: -48.4 },
});

describe('Shopping List Optimization', () => {
  it('returns null for empty list', () => {
    expect(optimizeList([], [], -21.3, -48.6)).toBeNull();
  });

  it('returns null when no promotions match', () => {
    const items = [{ product_id: 'p1', quantity: 1 }];
    expect(optimizeList(items, [], -21.3, -48.6)).toBeNull();
  });

  it('picks cheapest store per product (greedy)', () => {
    const items = [
      { product_id: 'p1', quantity: 1, product: { name: 'Leite' } },
    ];
    const promos = [
      makePromo('p1', 's1', 5.0, 'Mercado A'),
      makePromo('p1', 's2', 3.0, 'Mercado B'),
    ];
    const result = optimizeList(items, promos, -21.3, -48.6)!;
    expect(result.stores).toHaveLength(1);
    expect(result.stores[0].storeId).toBe('s2');
    expect(result.stores[0].storeName).toBe('Mercado B');
    expect(result.totalCost).toBe(3.0);
  });

  it('groups items at the same cheapest store', () => {
    const items = [
      { product_id: 'p1', quantity: 2, product: { name: 'Leite' } },
      { product_id: 'p2', quantity: 1, product: { name: 'Pao' } },
    ];
    const promos = [
      makePromo('p1', 's1', 5.0, 'Mercado A'),
      makePromo('p2', 's1', 3.0, 'Mercado A'),
    ];
    const result = optimizeList(items, promos, -21.3, -48.6)!;
    expect(result.stores).toHaveLength(1);
    expect(result.stores[0].items).toHaveLength(2);
    expect(result.totalCost).toBe(5.0 * 2 + 3.0);
  });

  it('splits across stores when different stores are cheapest', () => {
    const items = [
      { product_id: 'p1', quantity: 1, product: { name: 'Leite' } },
      { product_id: 'p2', quantity: 1, product: { name: 'Pao' } },
    ];
    const promos = [
      makePromo('p1', 's1', 5.0, 'Mercado A'),
      makePromo('p1', 's2', 7.0, 'Mercado B'),
      makePromo('p2', 's2', 2.0, 'Mercado B'),
      makePromo('p2', 's1', 4.0, 'Mercado A'),
    ];
    const result = optimizeList(items, promos, -21.3, -48.6)!;
    expect(result.stores).toHaveLength(2);
    expect(result.totalCost).toBe(5.0 + 2.0);
  });

  it('handles quantity multiplication', () => {
    const items = [{ product_id: 'p1', quantity: 3, product: { name: 'Leite' } }];
    const promos = [makePromo('p1', 's1', 4.0)];
    const result = optimizeList(items, promos, -21.3, -48.6)!;
    expect(result.totalCost).toBe(12.0);
    expect(result.stores[0].subtotal).toBe(12.0);
  });

  it('calculates estimated savings (15% of total)', () => {
    const items = [{ product_id: 'p1', quantity: 1 }];
    const promos = [makePromo('p1', 's1', 100.0)];
    const result = optimizeList(items, promos, -21.3, -48.6)!;
    expect(result.estimatedSavings).toBe(15.0);
  });

  it('generates Google Maps URL with waypoints', () => {
    const items = [{ product_id: 'p1', quantity: 1 }];
    const promos = [makePromo('p1', 's1', 5.0)];
    const result = optimizeList(items, promos, -21.3, -48.6)!;
    expect(result.mapsUrl).toContain('https://www.google.com/maps/dir/');
    expect(result.mapsUrl).toContain('-21.3,-48.6');
    expect(result.mapsUrl).toContain('optimize=true');
  });

  it('generates Maps URL with multiple waypoints', () => {
    const items = [
      { product_id: 'p1', quantity: 1 },
      { product_id: 'p2', quantity: 1 },
    ];
    const promos = [
      makePromo('p1', 's1', 5.0, 'A'),
      makePromo('p2', 's2', 3.0, 'B'),
    ];
    const result = optimizeList(items, promos, -21.3, -48.6)!;
    // Two stores = two waypoints
    expect(result.mapsUrl.split('/').length).toBeGreaterThanOrEqual(4);
  });

  it('skips items with no matching promotions', () => {
    const items = [
      { product_id: 'p1', quantity: 1, product: { name: 'Leite' } },
      { product_id: 'p_missing', quantity: 1, product: { name: 'Suco' } },
    ];
    const promos = [makePromo('p1', 's1', 5.0)];
    const result = optimizeList(items, promos, -21.3, -48.6)!;
    expect(result.stores[0].items).toHaveLength(1);
    expect(result.totalCost).toBe(5.0);
  });

  it('uses fallback product name when product is undefined', () => {
    const items = [{ product_id: 'p1', quantity: 1 }];
    const promos = [makePromo('p1', 's1', 5.0)];
    const result = optimizeList(items, promos, -21.3, -48.6)!;
    expect(result.stores[0].items[0].productName).toBe('Produto');
  });

  it('handles single item single store', () => {
    const items = [{ product_id: 'p1', quantity: 1, product: { name: 'Arroz' } }];
    const promos = [makePromo('p1', 's1', 8.5, 'Supermercado')];
    const result = optimizeList(items, promos, -21.3, -48.6)!;
    expect(result.stores).toHaveLength(1);
    expect(result.stores[0].storeName).toBe('Supermercado');
    expect(result.stores[0].items[0].productName).toBe('Arroz');
    expect(result.stores[0].items[0].price).toBe(8.5);
  });
});
