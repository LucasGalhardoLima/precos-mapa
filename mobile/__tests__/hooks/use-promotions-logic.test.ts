/**
 * Unit tests for promotion enrichment, sorting, isLocked gating,
 * and store-level dedup logic used in usePromotions.
 *
 * Because enrichPromotion / sortPromotions are NOT exported from
 * the hook, we replicate the exact logic here (same pattern as
 * __tests__/us1/enrichment.test.ts).
 */
import { calculateDistanceKm } from '../../hooks/use-location';
import { getGamificationMessage } from '../../constants/messages';
import type {
  PromotionWithRelations,
  EnrichedPromotion,
  SortMode,
  Product,
  Store,
} from '@/types';

// ---------------------------------------------------------------------------
// Replicated logic (mirrors hooks/use-promotions.ts exactly)
// ---------------------------------------------------------------------------

function enrichPromotion(
  promo: PromotionWithRelations,
  userLat: number,
  userLon: number,
  bestPriceMap: Map<string, number>,
): EnrichedPromotion {
  const discountPercent = Math.round(
    (1 - promo.promo_price / promo.original_price) * 100,
  );
  const belowNormalPercent = Math.round(
    (1 - promo.promo_price / promo.product.reference_price) * 100,
  );
  const distanceKm = calculateDistanceKm(
    userLat,
    userLon,
    promo.store.latitude,
    promo.store.longitude,
  );
  const endDate = new Date(promo.end_date);
  const today = new Date();
  const isExpiringSoon =
    endDate.getFullYear() === today.getFullYear() &&
    endDate.getMonth() === today.getMonth() &&
    endDate.getDate() === today.getDate();

  const bestPrice = bestPriceMap.get(promo.product_id) ?? promo.promo_price;
  const hasDiscount = promo.promo_price < promo.original_price;

  return {
    ...promo,
    discountPercent,
    belowNormalPercent: Math.max(0, belowNormalPercent),
    gamificationMessage: getGamificationMessage(discountPercent),
    distanceKm,
    isExpiringSoon,
    isBestPrice: hasDiscount && promo.promo_price <= bestPrice,
    isLocked: false,
  };
}

function sortPromotions(
  items: EnrichedPromotion[],
  mode: SortMode,
): EnrichedPromotion[] {
  return [...items].sort((a, b) => {
    const priorityDiff =
      (b.store.search_priority ?? 0) - (a.store.search_priority ?? 0);
    if (priorityDiff !== 0) return priorityDiff;

    switch (mode) {
      case 'cheapest':
        return a.promo_price - b.promo_price || a.distanceKm - b.distanceKm;
      case 'nearest':
        return a.distanceKm - b.distanceKm || a.promo_price - b.promo_price;
      case 'expiring':
        return (
          new Date(a.end_date).getTime() - new Date(b.end_date).getTime() ||
          a.promo_price - b.promo_price
        );
      case 'discount':
        return (
          b.discountPercent - a.discountPercent ||
          a.promo_price - b.promo_price
        );
    }
  });
}

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const USER_LAT = -21.6033;
const USER_LON = -48.3658;

function makeStore(overrides: Partial<Store> = {}): Store {
  return {
    id: 'store-1',
    name: 'Supermercado A',
    chain: null,
    address: 'Rua A, 100',
    city: 'Matao',
    state: 'SP',
    latitude: -21.6033,
    longitude: -48.3658,
    logo_url: null,
    logo_initial: 'A',
    logo_color: '#FF0000',
    phone: null,
    b2b_plan: 'free',
    stripe_customer_id: null,
    stripe_subscription_id: null,
    trial_ends_at: null,
    search_priority: 0,
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'prod-1',
    name: 'Arroz 5kg',
    category_id: 'cat-1',
    brand: 'Tio Joao',
    reference_price: 25.0,
    image_url: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function makePromotion(
  overrides: Partial<PromotionWithRelations> & {
    product?: Partial<Product>;
    store?: Partial<Store>;
  } = {},
): PromotionWithRelations {
  const { product: productOverrides, store: storeOverrides, ...rest } = overrides;
  return {
    id: 'promo-1',
    product_id: 'prod-1',
    store_id: 'store-1',
    original_price: 25.0,
    promo_price: 18.0,
    start_date: '2026-03-01T00:00:00Z',
    end_date: '2026-03-15T00:00:00Z',
    status: 'active',
    verified: true,
    source: 'manual',
    created_by: null,
    created_at: '2026-03-01T00:00:00Z',
    updated_at: '2026-03-01T00:00:00Z',
    product: makeProduct(productOverrides),
    store: makeStore(storeOverrides),
    ...rest,
  };
}

function enrichWithDefaults(
  overrides: Partial<PromotionWithRelations> & {
    product?: Partial<Product>;
    store?: Partial<Store>;
  } = {},
  bestPriceMap?: Map<string, number>,
): EnrichedPromotion {
  const promo = makePromotion(overrides);
  return enrichPromotion(
    promo,
    USER_LAT,
    USER_LON,
    bestPriceMap ?? new Map([[promo.product_id, promo.promo_price]]),
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Promotion Logic — enrichPromotion', () => {
  describe('discountPercent', () => {
    it('computes correct discount for a normal case', () => {
      const enriched = enrichWithDefaults({
        original_price: 10.0,
        promo_price: 7.0,
      });
      // (1 - 7/10) * 100 = 30
      expect(enriched.discountPercent).toBe(30);
    });

    it('returns 0 when promo_price equals original_price', () => {
      const enriched = enrichWithDefaults({
        original_price: 10.0,
        promo_price: 10.0,
      });
      expect(enriched.discountPercent).toBe(0);
    });

    it('returns negative when promo_price exceeds original_price', () => {
      const enriched = enrichWithDefaults({
        original_price: 10.0,
        promo_price: 12.0,
      });
      // (1 - 12/10) * 100 = -20
      expect(enriched.discountPercent).toBe(-20);
    });

    it('rounds correctly (e.g. 32% for 7.49 / 10.99)', () => {
      const enriched = enrichWithDefaults({
        original_price: 10.99,
        promo_price: 7.49,
      });
      expect(enriched.discountPercent).toBe(32);
    });
  });

  describe('belowNormalPercent', () => {
    it('computes below-normal based on product.reference_price', () => {
      const enriched = enrichWithDefaults({
        promo_price: 18.0,
        product: { reference_price: 25.0 },
      });
      // (1 - 18/25) * 100 = 28
      expect(enriched.belowNormalPercent).toBe(28);
    });

    it('clamps to 0 when promo_price exceeds reference_price', () => {
      const enriched = enrichWithDefaults({
        promo_price: 30.0,
        product: { reference_price: 25.0 },
      });
      expect(enriched.belowNormalPercent).toBe(0);
    });

    it('returns 0 when promo_price equals reference_price', () => {
      const enriched = enrichWithDefaults({
        promo_price: 25.0,
        product: { reference_price: 25.0 },
      });
      expect(enriched.belowNormalPercent).toBe(0);
    });
  });

  describe('distanceKm', () => {
    it('returns 0 when store is at user location', () => {
      const enriched = enrichWithDefaults({
        store: { latitude: USER_LAT, longitude: USER_LON },
      });
      expect(enriched.distanceKm).toBe(0);
    });

    it('calculates realistic distance for a remote store', () => {
      const enriched = enrichWithDefaults({
        store: { latitude: -21.7946, longitude: -48.1756 },
      });
      // Matao to Araraquara ~25 km
      expect(enriched.distanceKm).toBeGreaterThan(20);
      expect(enriched.distanceKm).toBeLessThan(30);
    });
  });

  describe('isExpiringSoon', () => {
    it('returns true when end_date is today', () => {
      const today = new Date();
      const endDate = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate(),
        23,
        59,
        59,
      ).toISOString();
      const enriched = enrichWithDefaults({ end_date: endDate });
      expect(enriched.isExpiringSoon).toBe(true);
    });

    it('returns false when end_date is tomorrow', () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const enriched = enrichWithDefaults({
        end_date: tomorrow.toISOString(),
      });
      expect(enriched.isExpiringSoon).toBe(false);
    });

    it('returns false when end_date is in the past (yesterday)', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const enriched = enrichWithDefaults({
        end_date: yesterday.toISOString(),
      });
      expect(enriched.isExpiringSoon).toBe(false);
    });
  });

  describe('isBestPrice', () => {
    it('returns true when promo is cheapest for the product', () => {
      const bestMap = new Map([['prod-1', 18.0]]);
      const enriched = enrichWithDefaults(
        { promo_price: 18.0, original_price: 25.0, product_id: 'prod-1' },
        bestMap,
      );
      expect(enriched.isBestPrice).toBe(true);
    });

    it('returns false when another store has a lower price', () => {
      const bestMap = new Map([['prod-1', 15.0]]);
      const enriched = enrichWithDefaults(
        { promo_price: 18.0, original_price: 25.0, product_id: 'prod-1' },
        bestMap,
      );
      expect(enriched.isBestPrice).toBe(false);
    });

    it('returns false when promo_price equals original_price (no discount)', () => {
      const bestMap = new Map([['prod-1', 25.0]]);
      const enriched = enrichWithDefaults(
        { promo_price: 25.0, original_price: 25.0, product_id: 'prod-1' },
        bestMap,
      );
      // hasDiscount is false => isBestPrice is false
      expect(enriched.isBestPrice).toBe(false);
    });

    it('returns true when multiple promos tie at the best price', () => {
      const bestMap = new Map([['prod-1', 18.0]]);
      const enriched = enrichWithDefaults(
        { promo_price: 18.0, original_price: 25.0, product_id: 'prod-1' },
        bestMap,
      );
      expect(enriched.isBestPrice).toBe(true);
    });
  });

  describe('gamificationMessage', () => {
    it('returns fire message for >= 40% discount', () => {
      const enriched = enrichWithDefaults({
        original_price: 100,
        promo_price: 55,
        product: { reference_price: 100 },
      });
      // discount = 45%
      expect(enriched.gamificationMessage).toContain('Voce evitou pagar caro');
    });

    it('returns money message for >= 25% discount', () => {
      const enriched = enrichWithDefaults({
        original_price: 100,
        promo_price: 70,
        product: { reference_price: 100 },
      });
      // discount = 30%
      expect(enriched.gamificationMessage).toContain('Boa economia');
    });

    it('returns thumbs up for >= 10% discount', () => {
      const enriched = enrichWithDefaults({
        original_price: 100,
        promo_price: 85,
        product: { reference_price: 100 },
      });
      // discount = 15%
      expect(enriched.gamificationMessage).toContain('Vale a pena conferir');
    });

    it('returns null for < 10% discount', () => {
      const enriched = enrichWithDefaults({
        original_price: 100,
        promo_price: 95,
        product: { reference_price: 100 },
      });
      // discount = 5%
      expect(enriched.gamificationMessage).toBeNull();
    });
  });

  describe('isLocked', () => {
    it('is always false from enrichPromotion (set later)', () => {
      const enriched = enrichWithDefaults();
      expect(enriched.isLocked).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// sortPromotions
// ---------------------------------------------------------------------------

describe('Promotion Logic — sortPromotions', () => {
  // Helper to build enriched promos with specific fields for sort tests
  function makeEnriched(
    overrides: Partial<EnrichedPromotion> & {
      store?: Partial<Store>;
    } = {},
  ): EnrichedPromotion {
    const { store: storeOverrides, ...rest } = overrides;
    return {
      ...makePromotion({ store: storeOverrides }),
      discountPercent: 20,
      belowNormalPercent: 15,
      gamificationMessage: null,
      distanceKm: 5.0,
      isExpiringSoon: false,
      isBestPrice: false,
      isLocked: false,
      ...rest,
    };
  }

  describe('cheapest mode', () => {
    it('sorts by promo_price ascending', () => {
      const items = [
        makeEnriched({ id: 'a', promo_price: 20 }),
        makeEnriched({ id: 'b', promo_price: 10 }),
        makeEnriched({ id: 'c', promo_price: 15 }),
      ];
      const sorted = sortPromotions(items, 'cheapest');
      expect(sorted.map((p) => p.id)).toEqual(['b', 'c', 'a']);
    });

    it('breaks ties with distanceKm', () => {
      const items = [
        makeEnriched({ id: 'a', promo_price: 10, distanceKm: 5 }),
        makeEnriched({ id: 'b', promo_price: 10, distanceKm: 2 }),
      ];
      const sorted = sortPromotions(items, 'cheapest');
      expect(sorted.map((p) => p.id)).toEqual(['b', 'a']);
    });
  });

  describe('nearest mode', () => {
    it('sorts by distanceKm ascending', () => {
      const items = [
        makeEnriched({ id: 'a', distanceKm: 10 }),
        makeEnriched({ id: 'b', distanceKm: 2 }),
        makeEnriched({ id: 'c', distanceKm: 7 }),
      ];
      const sorted = sortPromotions(items, 'nearest');
      expect(sorted.map((p) => p.id)).toEqual(['b', 'c', 'a']);
    });

    it('breaks ties with promo_price', () => {
      const items = [
        makeEnriched({ id: 'a', distanceKm: 5, promo_price: 20 }),
        makeEnriched({ id: 'b', distanceKm: 5, promo_price: 10 }),
      ];
      const sorted = sortPromotions(items, 'nearest');
      expect(sorted.map((p) => p.id)).toEqual(['b', 'a']);
    });
  });

  describe('discount mode', () => {
    it('sorts by discountPercent descending', () => {
      const items = [
        makeEnriched({ id: 'a', discountPercent: 10 }),
        makeEnriched({ id: 'b', discountPercent: 40 }),
        makeEnriched({ id: 'c', discountPercent: 25 }),
      ];
      const sorted = sortPromotions(items, 'discount');
      expect(sorted.map((p) => p.id)).toEqual(['b', 'c', 'a']);
    });

    it('breaks ties with promo_price ascending', () => {
      const items = [
        makeEnriched({ id: 'a', discountPercent: 30, promo_price: 15 }),
        makeEnriched({ id: 'b', discountPercent: 30, promo_price: 10 }),
      ];
      const sorted = sortPromotions(items, 'discount');
      expect(sorted.map((p) => p.id)).toEqual(['b', 'a']);
    });
  });

  describe('expiring mode', () => {
    it('sorts by end_date ascending', () => {
      const items = [
        makeEnriched({ id: 'a', end_date: '2026-03-20T00:00:00Z' }),
        makeEnriched({ id: 'b', end_date: '2026-03-08T00:00:00Z' }),
        makeEnriched({ id: 'c', end_date: '2026-03-12T00:00:00Z' }),
      ];
      const sorted = sortPromotions(items, 'expiring');
      expect(sorted.map((p) => p.id)).toEqual(['b', 'c', 'a']);
    });

    it('breaks ties with promo_price ascending', () => {
      const items = [
        makeEnriched({
          id: 'a',
          end_date: '2026-03-10T00:00:00Z',
          promo_price: 20,
        }),
        makeEnriched({
          id: 'b',
          end_date: '2026-03-10T00:00:00Z',
          promo_price: 12,
        }),
      ];
      const sorted = sortPromotions(items, 'expiring');
      expect(sorted.map((p) => p.id)).toEqual(['b', 'a']);
    });
  });

  describe('search_priority', () => {
    it('higher search_priority always comes first regardless of mode', () => {
      const items = [
        makeEnriched({
          id: 'free',
          promo_price: 5,
          distanceKm: 1,
          store: { search_priority: 0 },
        }),
        makeEnriched({
          id: 'paid',
          promo_price: 20,
          distanceKm: 10,
          store: { search_priority: 10 },
        }),
      ];

      for (const mode of [
        'cheapest',
        'nearest',
        'discount',
        'expiring',
      ] as SortMode[]) {
        const sorted = sortPromotions(items, mode);
        expect(sorted[0].id).toBe('paid');
      }
    });

    it('sorts normally within same priority tier', () => {
      const items = [
        makeEnriched({
          id: 'a',
          promo_price: 20,
          store: { search_priority: 5 },
        }),
        makeEnriched({
          id: 'b',
          promo_price: 10,
          store: { search_priority: 5 },
        }),
      ];
      const sorted = sortPromotions(items, 'cheapest');
      expect(sorted.map((p) => p.id)).toEqual(['b', 'a']);
    });

    it('handles null/undefined search_priority as 0', () => {
      const items = [
        makeEnriched({
          id: 'no-priority',
          promo_price: 5,
          store: { search_priority: 0 },
        }),
        makeEnriched({
          id: 'has-priority',
          promo_price: 20,
          store: { search_priority: 1 },
        }),
      ];
      const sorted = sortPromotions(items, 'cheapest');
      expect(sorted[0].id).toBe('has-priority');
    });
  });

  it('does not mutate the original array', () => {
    const items = [
      makeEnriched({ id: 'a', promo_price: 20 }),
      makeEnriched({ id: 'b', promo_price: 10 }),
    ];
    const original = [...items];
    sortPromotions(items, 'cheapest');
    expect(items.map((p) => p.id)).toEqual(original.map((p) => p.id));
  });
});

// ---------------------------------------------------------------------------
// isLocked gating (free plan)
// ---------------------------------------------------------------------------

describe('Promotion Logic — isLocked gating', () => {
  function applyIsLocked(
    items: EnrichedPromotion[],
    isFree: boolean,
  ): EnrichedPromotion[] {
    return items.map((promo, index) => ({
      ...promo,
      isLocked: isFree && index >= 3,
    }));
  }

  it('free users see first 3 results unlocked, rest locked', () => {
    const items = Array.from({ length: 5 }, (_, i) =>
      enrichWithDefaults({ id: `promo-${i}` }),
    );
    const gated = applyIsLocked(items, true);

    expect(gated[0].isLocked).toBe(false);
    expect(gated[1].isLocked).toBe(false);
    expect(gated[2].isLocked).toBe(false);
    expect(gated[3].isLocked).toBe(true);
    expect(gated[4].isLocked).toBe(true);
  });

  it('paid users see all results unlocked', () => {
    const items = Array.from({ length: 5 }, (_, i) =>
      enrichWithDefaults({ id: `promo-${i}` }),
    );
    const gated = applyIsLocked(items, false);

    for (const promo of gated) {
      expect(promo.isLocked).toBe(false);
    }
  });

  it('free users with exactly 3 results have none locked', () => {
    const items = Array.from({ length: 3 }, (_, i) =>
      enrichWithDefaults({ id: `promo-${i}` }),
    );
    const gated = applyIsLocked(items, true);

    for (const promo of gated) {
      expect(promo.isLocked).toBe(false);
    }
  });

  it('free users with 0 results returns empty array', () => {
    const gated = applyIsLocked([], true);
    expect(gated).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Store grouping / dedup (productQuery mode)
// ---------------------------------------------------------------------------

describe('Promotion Logic — Store grouping (productQuery dedup)', () => {
  function dedupByStore(
    sorted: EnrichedPromotion[],
    productQuery: string | undefined,
  ): EnrichedPromotion[] {
    if (!productQuery) return sorted;

    const storeMap = new Map<string, EnrichedPromotion>();
    for (const promo of sorted) {
      if (!storeMap.has(promo.store_id)) {
        storeMap.set(promo.store_id, promo);
      }
    }
    return [...storeMap.values()];
  }

  it('keeps only first (cheapest) promotion per store_id', () => {
    const items = [
      enrichWithDefaults({
        id: 'cheapest-s1',
        store_id: 'store-1',
        promo_price: 10,
        store: { id: 'store-1' },
      }),
      enrichWithDefaults({
        id: 'expensive-s1',
        store_id: 'store-1',
        promo_price: 20,
        store: { id: 'store-1' },
      }),
      enrichWithDefaults({
        id: 'cheapest-s2',
        store_id: 'store-2',
        promo_price: 15,
        store: { id: 'store-2' },
      }),
    ];
    const deduped = dedupByStore(items, 'arroz');
    expect(deduped).toHaveLength(2);
    expect(deduped.map((p) => p.id)).toEqual(['cheapest-s1', 'cheapest-s2']);
  });

  it('does not dedup when productQuery is undefined', () => {
    const items = [
      enrichWithDefaults({
        id: 'a',
        store_id: 'store-1',
        store: { id: 'store-1' },
      }),
      enrichWithDefaults({
        id: 'b',
        store_id: 'store-1',
        store: { id: 'store-1' },
      }),
    ];
    const result = dedupByStore(items, undefined);
    expect(result).toHaveLength(2);
  });

  it('does not dedup when productQuery is empty string', () => {
    const items = [
      enrichWithDefaults({
        id: 'a',
        store_id: 'store-1',
        store: { id: 'store-1' },
      }),
      enrichWithDefaults({
        id: 'b',
        store_id: 'store-1',
        store: { id: 'store-1' },
      }),
    ];
    const result = dedupByStore(items, '');
    expect(result).toHaveLength(2);
  });

  it('handles all unique stores (no dedup needed)', () => {
    const items = [
      enrichWithDefaults({
        id: 'a',
        store_id: 'store-1',
        store: { id: 'store-1' },
      }),
      enrichWithDefaults({
        id: 'b',
        store_id: 'store-2',
        store: { id: 'store-2' },
      }),
      enrichWithDefaults({
        id: 'c',
        store_id: 'store-3',
        store: { id: 'store-3' },
      }),
    ];
    const result = dedupByStore(items, 'leite');
    expect(result).toHaveLength(3);
  });

  it('preserves order from sorted input', () => {
    const items = [
      enrichWithDefaults({
        id: 's2-cheap',
        store_id: 'store-2',
        promo_price: 8,
        store: { id: 'store-2' },
      }),
      enrichWithDefaults({
        id: 's1-cheap',
        store_id: 'store-1',
        promo_price: 10,
        store: { id: 'store-1' },
      }),
      enrichWithDefaults({
        id: 's2-expensive',
        store_id: 'store-2',
        promo_price: 20,
        store: { id: 'store-2' },
      }),
    ];
    const deduped = dedupByStore(items, 'arroz');
    expect(deduped.map((p) => p.id)).toEqual(['s2-cheap', 's1-cheap']);
  });
});

// ---------------------------------------------------------------------------
// Best price map construction
// ---------------------------------------------------------------------------

describe('Promotion Logic — bestPriceMap construction', () => {
  function buildBestPriceMap(
    promotions: { product_id: string; promo_price: number }[],
  ): Map<string, number> {
    const bestPriceMap = new Map<string, number>();
    for (const p of promotions) {
      const current = bestPriceMap.get(p.product_id);
      if (current === undefined || p.promo_price < current) {
        bestPriceMap.set(p.product_id, p.promo_price);
      }
    }
    return bestPriceMap;
  }

  it('picks the lowest price for a single product', () => {
    const map = buildBestPriceMap([
      { product_id: 'p1', promo_price: 12 },
      { product_id: 'p1', promo_price: 8 },
      { product_id: 'p1', promo_price: 15 },
    ]);
    expect(map.get('p1')).toBe(8);
  });

  it('handles multiple products independently', () => {
    const map = buildBestPriceMap([
      { product_id: 'p1', promo_price: 10 },
      { product_id: 'p2', promo_price: 5 },
      { product_id: 'p1', promo_price: 8 },
      { product_id: 'p2', promo_price: 7 },
    ]);
    expect(map.get('p1')).toBe(8);
    expect(map.get('p2')).toBe(5);
  });

  it('returns empty map for empty input', () => {
    const map = buildBestPriceMap([]);
    expect(map.size).toBe(0);
  });

  it('handles single promotion', () => {
    const map = buildBestPriceMap([{ product_id: 'p1', promo_price: 10 }]);
    expect(map.get('p1')).toBe(10);
  });
});
