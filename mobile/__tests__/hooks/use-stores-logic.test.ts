// mobile/__tests__/hooks/use-stores-logic.test.ts
import { calculateDistanceKm } from '../../hooks/use-location';

// Replicate use-stores enrichment logic
function enrichStorePromotions(store: any, userLat: number, userLon: number) {
  const distanceKm = calculateDistanceKm(userLat, userLon, store.latitude, store.longitude);

  const storePromos = (store.promotions || [])
    .filter((p: any) => p.product)
    .map((promo: any) => {
      const discountPercent = Math.round(
        (1 - promo.promo_price / promo.original_price) * 100,
      );
      const belowNormalPercent = Math.max(
        0,
        Math.round((1 - promo.promo_price / promo.product.reference_price) * 100),
      );
      return { ...promo, discountPercent, belowNormalPercent, distanceKm };
    });

  const topDeals = [...storePromos]
    .sort((a: any, b: any) => b.discountPercent - a.discountPercent)
    .slice(0, 5);

  return {
    store,
    activePromotionCount: storePromos.length,
    topDeals,
    distanceKm,
  };
}

// Test helpers
const makeStore = (lat = -21.6, lon = -48.4) => ({
  id: 's1',
  name: 'Mercado Central',
  latitude: lat,
  longitude: lon,
  promotions: [] as any[],
});

const makeStorePromo = (discount: number) => ({
  id: `promo-${discount}`,
  product_id: `p-${discount}`,
  original_price: 100,
  promo_price: 100 - discount,
  product: { reference_price: 100 },
});

describe('Store Enrichment Logic', () => {
  it('calculates distance to user (Matao to Araraquara ~25km)', () => {
    const store = makeStore(-21.7946, -48.1756);
    const result = enrichStorePromotions(store, -21.6033, -48.3658);
    expect(result.distanceKm).toBeGreaterThan(20);
    expect(result.distanceKm).toBeLessThan(30);
  });

  it('returns 0 distance for same coordinates', () => {
    const store = makeStore(-21.6, -48.4);
    const result = enrichStorePromotions(store, -21.6, -48.4);
    expect(result.distanceKm).toBe(0);
  });

  it('counts active promotions correctly', () => {
    const store = {
      ...makeStore(),
      promotions: [makeStorePromo(10), makeStorePromo(20), makeStorePromo(30)],
    };
    const result = enrichStorePromotions(store, -21.3, -48.6);
    expect(result.activePromotionCount).toBe(3);
  });

  it('filters out promotions without product', () => {
    const store = {
      ...makeStore(),
      promotions: [
        makeStorePromo(10),
        { id: 'no-product', original_price: 10, promo_price: 8, product: null },
        { id: 'undefined-product', original_price: 10, promo_price: 8, product: undefined },
      ],
    };
    const result = enrichStorePromotions(store, -21.3, -48.6);
    expect(result.activePromotionCount).toBe(1);
  });

  it('returns top 5 deals sorted by discount descending', () => {
    const store = {
      ...makeStore(),
      promotions: Array.from({ length: 8 }, (_, i) => makeStorePromo((i + 1) * 5)),
    };
    const result = enrichStorePromotions(store, -21.3, -48.6);
    expect(result.topDeals).toHaveLength(5);
    // 8*5=40 is highest discount
    expect(result.topDeals[0].discountPercent).toBe(40);
    expect(result.topDeals[1].discountPercent).toBe(35);
    expect(result.topDeals[2].discountPercent).toBe(30);
    expect(result.topDeals[3].discountPercent).toBe(25);
    expect(result.topDeals[4].discountPercent).toBe(20);
  });

  it('returns all deals when fewer than 5', () => {
    const store = {
      ...makeStore(),
      promotions: [makeStorePromo(15), makeStorePromo(25)],
    };
    const result = enrichStorePromotions(store, -21.3, -48.6);
    expect(result.topDeals).toHaveLength(2);
    expect(result.topDeals[0].discountPercent).toBe(25);
    expect(result.topDeals[1].discountPercent).toBe(15);
  });

  it('handles store with no promotions', () => {
    const store = makeStore();
    const result = enrichStorePromotions(store, -21.3, -48.6);
    expect(result.activePromotionCount).toBe(0);
    expect(result.topDeals).toHaveLength(0);
  });

  it('handles store with undefined promotions', () => {
    const store = { ...makeStore(), promotions: undefined };
    const result = enrichStorePromotions(store, -21.3, -48.6);
    expect(result.activePromotionCount).toBe(0);
    expect(result.topDeals).toHaveLength(0);
  });

  it('computes discountPercent correctly', () => {
    const store = {
      ...makeStore(),
      promotions: [makeStorePromo(30)],
    };
    const result = enrichStorePromotions(store, -21.3, -48.6);
    expect(result.topDeals[0].discountPercent).toBe(30);
  });

  it('computes belowNormalPercent correctly', () => {
    const store = {
      ...makeStore(),
      promotions: [{
        id: 'p1',
        product_id: 'prod1',
        original_price: 12,
        promo_price: 8,
        product: { reference_price: 10 },
      }],
    };
    const result = enrichStorePromotions(store, -21.3, -48.6);
    // belowNormal = (1 - 8/10) * 100 = 20
    expect(result.topDeals[0].belowNormalPercent).toBe(20);
  });

  it('clamps belowNormalPercent to 0 when promo > reference', () => {
    const store = {
      ...makeStore(),
      promotions: [{
        id: 'p1',
        product_id: 'prod1',
        original_price: 15,
        promo_price: 12,
        product: { reference_price: 10 },
      }],
    };
    const result = enrichStorePromotions(store, -21.3, -48.6);
    expect(result.topDeals[0].belowNormalPercent).toBe(0);
  });

  it('attaches distance to each promo', () => {
    const store = {
      ...makeStore(-21.7946, -48.1756),
      promotions: [makeStorePromo(10)],
    };
    const result = enrichStorePromotions(store, -21.6033, -48.3658);
    expect(result.topDeals[0].distanceKm).toBe(result.distanceKm);
    expect(result.topDeals[0].distanceKm).toBeGreaterThan(20);
  });

  it('preserves store reference in result', () => {
    const store = makeStore();
    const result = enrichStorePromotions(store, -21.3, -48.6);
    expect(result.store).toBe(store);
  });
});
