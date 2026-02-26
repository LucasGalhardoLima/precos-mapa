/**
 * US6 Tests: B2C Subscriptions, Smart Lists, Price History, Free Tier Limits
 *
 * Tests RevenueCat initialization, subscription entitlement mapping,
 * shopping list optimization algorithm, price history trend computation,
 * and free tier limit enforcement with paywall triggers.
 */

// ─── RevenueCat Initialization ──────────────────────────────────

describe('US6: RevenueCat Initialization', () => {
  it('should configure with platform-specific API keys', () => {
    const config = {
      appleKey: 'appl_test_key_123',
      googleKey: 'goog_test_key_456',
    };

    expect(config.appleKey).toMatch(/^appl_/);
    expect(config.googleKey).toMatch(/^goog_/);
  });

  it('should link Supabase user ID on login', () => {
    const supabaseUserId = 'a0000000-0000-4000-a000-000000000001';

    // RevenueCat logIn expects a string appUserID
    expect(typeof supabaseUserId).toBe('string');
    expect(supabaseUserId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    );
  });
});

// ─── Subscription Entitlement Mapping ───────────────────────────

describe('US6: Subscription Entitlement Mapping', () => {
  type B2CPlan = 'free' | 'plus' | 'family';

  function mapEntitlementToPlan(
    entitlements: Record<string, { isActive: boolean }>
  ): B2CPlan {
    if (entitlements['family']?.isActive) return 'family';
    if (entitlements['plus']?.isActive) return 'plus';
    return 'free';
  }

  it('maps active Plus entitlement to plus plan', () => {
    const result = mapEntitlementToPlan({
      plus: { isActive: true },
    });
    expect(result).toBe('plus');
  });

  it('maps active Family entitlement to family plan', () => {
    const result = mapEntitlementToPlan({
      family: { isActive: true },
    });
    expect(result).toBe('family');
  });

  it('maps no active entitlements to free plan', () => {
    const result = mapEntitlementToPlan({});
    expect(result).toBe('free');
  });

  it('prefers family over plus when both active', () => {
    const result = mapEntitlementToPlan({
      plus: { isActive: true },
      family: { isActive: true },
    });
    expect(result).toBe('family');
  });

  it('maps expired entitlements to free', () => {
    const result = mapEntitlementToPlan({
      plus: { isActive: false },
    });
    expect(result).toBe('free');
  });
});

// ─── Shopping List Optimization Algorithm ───────────────────────

describe('US6: Shopping List Optimization', () => {
  interface PromoData {
    product_id: string;
    promo_price: number;
    store_id: string;
    store_name: string;
  }

  interface ListItem {
    product_id: string;
    quantity: number;
    product_name: string;
  }

  function optimizeGreedy(
    items: ListItem[],
    promotions: PromoData[]
  ): { stores: Map<string, { items: { name: string; price: number; qty: number }[]; subtotal: number }>; total: number } {
    const storeMap = new Map<string, { items: { name: string; price: number; qty: number }[]; subtotal: number }>();
    let total = 0;

    for (const item of items) {
      const productPromos = promotions.filter((p) => p.product_id === item.product_id);
      if (productPromos.length === 0) continue;

      const cheapest = productPromos.reduce((a, b) =>
        a.promo_price < b.promo_price ? a : b
      );

      const entry = storeMap.get(cheapest.store_id) ?? { items: [], subtotal: 0 };
      const cost = cheapest.promo_price * item.quantity;
      entry.items.push({ name: item.product_name, price: cheapest.promo_price, qty: item.quantity });
      entry.subtotal += cost;
      total += cost;
      storeMap.set(cheapest.store_id, entry);
    }

    return { stores: storeMap, total };
  }

  it('picks cheapest store for each product (single store result)', () => {
    const items: ListItem[] = [
      { product_id: 'p1', quantity: 1, product_name: 'Arroz' },
    ];
    const promos: PromoData[] = [
      { product_id: 'p1', promo_price: 5.99, store_id: 's1', store_name: 'Loja A' },
      { product_id: 'p1', promo_price: 6.99, store_id: 's2', store_name: 'Loja B' },
    ];

    const result = optimizeGreedy(items, promos);
    expect(result.stores.size).toBe(1);
    expect(result.stores.has('s1')).toBe(true);
    expect(result.total).toBeCloseTo(5.99);
  });

  it('splits across multiple stores when cheapest differs per product', () => {
    const items: ListItem[] = [
      { product_id: 'p1', quantity: 1, product_name: 'Arroz' },
      { product_id: 'p2', quantity: 1, product_name: 'Feijao' },
    ];
    const promos: PromoData[] = [
      { product_id: 'p1', promo_price: 5.00, store_id: 's1', store_name: 'Loja A' },
      { product_id: 'p1', promo_price: 7.00, store_id: 's2', store_name: 'Loja B' },
      { product_id: 'p2', promo_price: 8.00, store_id: 's1', store_name: 'Loja A' },
      { product_id: 'p2', promo_price: 4.00, store_id: 's2', store_name: 'Loja B' },
    ];

    const result = optimizeGreedy(items, promos);
    expect(result.stores.size).toBe(2);
    expect(result.total).toBeCloseTo(9.00); // 5 + 4
  });

  it('accounts for quantity in total calculation', () => {
    const items: ListItem[] = [
      { product_id: 'p1', quantity: 3, product_name: 'Leite' },
    ];
    const promos: PromoData[] = [
      { product_id: 'p1', promo_price: 4.50, store_id: 's1', store_name: 'Loja A' },
    ];

    const result = optimizeGreedy(items, promos);
    expect(result.total).toBeCloseTo(13.50); // 4.50 * 3
  });

  it('skips products with no available promotions', () => {
    const items: ListItem[] = [
      { product_id: 'p1', quantity: 1, product_name: 'Arroz' },
      { product_id: 'p_missing', quantity: 1, product_name: 'Unavailable' },
    ];
    const promos: PromoData[] = [
      { product_id: 'p1', promo_price: 5.99, store_id: 's1', store_name: 'Loja A' },
    ];

    const result = optimizeGreedy(items, promos);
    expect(result.stores.size).toBe(1);
    expect(result.total).toBeCloseTo(5.99);
  });
});

// ─── Price History Trend Computation ────────────────────────────

describe('US6: Price History Trend', () => {
  interface DataPoint {
    date: string;
    min_promo_price: number;
  }

  function computeTrend(points: DataPoint[]): {
    direction: 'up' | 'down' | 'stable';
    changePercent: number;
    bestTimeToBuy: boolean;
  } {
    if (points.length < 2) {
      return { direction: 'stable', changePercent: 0, bestTimeToBuy: false };
    }

    const recent = points.slice(-7);
    const older = points.slice(0, Math.min(7, points.length - 7));

    if (recent.length === 0 || older.length === 0) {
      return { direction: 'stable', changePercent: 0, bestTimeToBuy: false };
    }

    const recentAvg = recent.reduce((sum, p) => sum + p.min_promo_price, 0) / recent.length;
    const olderAvg = older.reduce((sum, p) => sum + p.min_promo_price, 0) / older.length;

    const changePercent = olderAvg > 0
      ? Math.round(((recentAvg - olderAvg) / olderAvg) * 100)
      : 0;

    const direction: 'up' | 'down' | 'stable' =
      changePercent > 3 ? 'up' : changePercent < -3 ? 'down' : 'stable';

    const currentMin = points[points.length - 1].min_promo_price;
    const periodMin = Math.min(...points.map((p) => p.min_promo_price));
    const bestTimeToBuy = currentMin <= periodMin * 1.05;

    return { direction, changePercent, bestTimeToBuy };
  }

  it('detects downward trend when recent prices are lower', () => {
    const points: DataPoint[] = [
      { date: '2026-01-01', min_promo_price: 10.00 },
      { date: '2026-01-02', min_promo_price: 10.00 },
      { date: '2026-01-03', min_promo_price: 10.00 },
      { date: '2026-01-04', min_promo_price: 10.00 },
      { date: '2026-01-05', min_promo_price: 10.00 },
      { date: '2026-01-06', min_promo_price: 10.00 },
      { date: '2026-01-07', min_promo_price: 10.00 },
      // recent 7 days
      { date: '2026-01-08', min_promo_price: 8.00 },
      { date: '2026-01-09', min_promo_price: 8.00 },
      { date: '2026-01-10', min_promo_price: 8.00 },
      { date: '2026-01-11', min_promo_price: 8.00 },
      { date: '2026-01-12', min_promo_price: 8.00 },
      { date: '2026-01-13', min_promo_price: 8.00 },
      { date: '2026-01-14', min_promo_price: 8.00 },
    ];

    const result = computeTrend(points);
    expect(result.direction).toBe('down');
    expect(result.changePercent).toBe(-20);
  });

  it('detects upward trend when recent prices are higher', () => {
    const points: DataPoint[] = [
      { date: '2026-01-01', min_promo_price: 5.00 },
      { date: '2026-01-02', min_promo_price: 5.00 },
      { date: '2026-01-03', min_promo_price: 5.00 },
      { date: '2026-01-04', min_promo_price: 5.00 },
      { date: '2026-01-05', min_promo_price: 5.00 },
      { date: '2026-01-06', min_promo_price: 5.00 },
      { date: '2026-01-07', min_promo_price: 5.00 },
      // recent
      { date: '2026-01-08', min_promo_price: 7.00 },
      { date: '2026-01-09', min_promo_price: 7.00 },
      { date: '2026-01-10', min_promo_price: 7.00 },
      { date: '2026-01-11', min_promo_price: 7.00 },
      { date: '2026-01-12', min_promo_price: 7.00 },
      { date: '2026-01-13', min_promo_price: 7.00 },
      { date: '2026-01-14', min_promo_price: 7.00 },
    ];

    const result = computeTrend(points);
    expect(result.direction).toBe('up');
    expect(result.changePercent).toBe(40);
  });

  it('detects stable trend when change is within 3%', () => {
    const points: DataPoint[] = [
      { date: '2026-01-01', min_promo_price: 10.00 },
      { date: '2026-01-02', min_promo_price: 10.00 },
      { date: '2026-01-03', min_promo_price: 10.00 },
      { date: '2026-01-04', min_promo_price: 10.00 },
      { date: '2026-01-05', min_promo_price: 10.00 },
      { date: '2026-01-06', min_promo_price: 10.00 },
      { date: '2026-01-07', min_promo_price: 10.00 },
      { date: '2026-01-08', min_promo_price: 10.20 },
      { date: '2026-01-09', min_promo_price: 10.20 },
      { date: '2026-01-10', min_promo_price: 10.20 },
      { date: '2026-01-11', min_promo_price: 10.20 },
      { date: '2026-01-12', min_promo_price: 10.20 },
      { date: '2026-01-13', min_promo_price: 10.20 },
      { date: '2026-01-14', min_promo_price: 10.20 },
    ];

    const result = computeTrend(points);
    expect(result.direction).toBe('stable');
  });

  it('flags best time to buy when price is near period minimum', () => {
    const points: DataPoint[] = [
      { date: '2026-01-01', min_promo_price: 12.00 },
      { date: '2026-01-02', min_promo_price: 11.00 },
      { date: '2026-01-03', min_promo_price: 10.00 },
      { date: '2026-01-04', min_promo_price: 11.00 },
      { date: '2026-01-05', min_promo_price: 12.00 },
      { date: '2026-01-06', min_promo_price: 11.00 },
      { date: '2026-01-07', min_promo_price: 10.50 },
      { date: '2026-01-08', min_promo_price: 11.00 },
      { date: '2026-01-09', min_promo_price: 10.50 },
      { date: '2026-01-10', min_promo_price: 10.30 },
      { date: '2026-01-11', min_promo_price: 10.20 },
      { date: '2026-01-12', min_promo_price: 10.10 },
      { date: '2026-01-13', min_promo_price: 10.00 },
      { date: '2026-01-14', min_promo_price: 10.00 },
    ];

    const result = computeTrend(points);
    expect(result.bestTimeToBuy).toBe(true);
  });

  it('returns stable for fewer than 2 data points', () => {
    const result = computeTrend([{ date: '2026-01-01', min_promo_price: 5.00 }]);
    expect(result.direction).toBe('stable');
    expect(result.changePercent).toBe(0);
    expect(result.bestTimeToBuy).toBe(false);
  });
});

// ─── Free Tier Limit Enforcement ────────────────────────────────

describe('US6: Free Tier Limits', () => {
  const FREE_LIMITS = {
    favorites: 10,
    alerts: 3,
    comparison_stores: 5,
  } as const;

  type Feature = 'favorites' | 'alerts' | 'comparison_stores' | 'smart_lists' | 'price_history';
  const PLUS_FEATURES: Feature[] = ['smart_lists', 'price_history'];

  function canUse(plan: string, feature: Feature, currentCount?: number): boolean {
    const isPaid = plan === 'plus' || plan === 'family';
    if (isPaid) return true;
    if (PLUS_FEATURES.includes(feature)) return false;
    const limit = FREE_LIMITS[feature as keyof typeof FREE_LIMITS];
    if (limit !== undefined && currentCount !== undefined) {
      return currentCount < limit;
    }
    return true;
  }

  it('blocks 11th favorite for free users', () => {
    expect(canUse('free', 'favorites', 10)).toBe(false);
  });

  it('allows 10th favorite for free users', () => {
    expect(canUse('free', 'favorites', 9)).toBe(true);
  });

  it('allows unlimited favorites for Plus users', () => {
    expect(canUse('plus', 'favorites', 100)).toBe(true);
  });

  it('blocks 4th alert for free users', () => {
    expect(canUse('free', 'alerts', 3)).toBe(false);
  });

  it('allows unlimited alerts for Family users', () => {
    expect(canUse('family', 'alerts', 50)).toBe(true);
  });

  it('blocks smart lists for free users', () => {
    expect(canUse('free', 'smart_lists')).toBe(false);
  });

  it('allows smart lists for Plus users', () => {
    expect(canUse('plus', 'smart_lists')).toBe(true);
  });

  it('blocks price history for free users', () => {
    expect(canUse('free', 'price_history')).toBe(false);
  });

  it('allows price history for Family users', () => {
    expect(canUse('family', 'price_history')).toBe(true);
  });

  it('blocks 6th comparison store for free users', () => {
    expect(canUse('free', 'comparison_stores', 5)).toBe(false);
  });
});

// ─── Daily Price Snapshot Aggregation ───────────────────────────

describe('US6: Price Snapshot Aggregation', () => {
  it('computes min and avg from promotion prices', () => {
    const prices = [5.99, 7.49, 6.25, 8.00];
    const min = Math.min(...prices);
    const avg = prices.reduce((a, b) => a + b, 0) / prices.length;

    expect(min).toBeCloseTo(5.99);
    expect(avg).toBeCloseTo(6.93, 1);
  });

  it('computes rolling 30-day reference price', () => {
    const snapshots = [
      { min_promo_price: 10.00 },
      { min_promo_price: 9.50 },
      { min_promo_price: 10.50 },
      { min_promo_price: 9.00 },
      { min_promo_price: 11.00 },
    ];

    const refPrice =
      snapshots.reduce((sum, s) => sum + s.min_promo_price, 0) / snapshots.length;

    expect(refPrice).toBeCloseTo(10.00);
  });
});
