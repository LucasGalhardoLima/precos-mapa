// mobile/__tests__/hooks/use-competitive-logic.test.ts

// Replicate the competitiveness score logic from use-competitive.ts

interface CompetitorPrice {
  product_id: string;
  product_name: string;
  my_price: number;
  competitor_store_name: string;
  competitor_price: number;
  price_diff_percent: number;
}

interface StoreRanking {
  store_id: string;
  store_name: string;
  active_promotions: number;
  avg_discount: number;
  rank: number;
}

function computeCompetitivenessScore(competitorPrices: CompetitorPrice[]): number {
  const uniqueProducts = new Map<
    string,
    { myPrice: number; competitorPrices: number[] }
  >();

  for (const cp of competitorPrices) {
    const entry = uniqueProducts.get(cp.product_id) ?? {
      myPrice: cp.my_price,
      competitorPrices: [],
    };
    entry.competitorPrices.push(cp.competitor_price);
    uniqueProducts.set(cp.product_id, entry);
  }

  let competitive = 0;
  let total = 0;

  for (const [, data] of uniqueProducts) {
    const avg =
      data.competitorPrices.reduce((a, b) => a + b, 0) /
      data.competitorPrices.length;
    if (data.myPrice <= avg) competitive++;
    total++;
  }

  return total > 0 ? Math.round((competitive / total) * 100) : 0;
}

function findMyRank(
  rankings: StoreRanking[],
  storeId: string,
): number | null {
  return rankings.find((r) => r.store_id === storeId)?.rank ?? null;
}

function hasPremiumAccess(
  role: string | null,
  b2bPlan: string,
): boolean {
  return (
    role === 'super_admin' ||
    b2bPlan === 'premium' ||
    b2bPlan === 'premium_plus' ||
    b2bPlan === 'enterprise'
  );
}

// ===========================================================================
// Helpers
// ===========================================================================

function makeCP(
  productId: string,
  myPrice: number,
  competitorPrice: number,
  competitorName: string = 'Concorrente',
): CompetitorPrice {
  return {
    product_id: productId,
    product_name: `Produto ${productId}`,
    my_price: myPrice,
    competitor_store_name: competitorName,
    competitor_price: competitorPrice,
    price_diff_percent: Math.round(((myPrice - competitorPrice) / competitorPrice) * 100),
  };
}

// ===========================================================================
// Tests
// ===========================================================================

describe('Competitive — Competitiveness Score', () => {
  it('returns 0 when no competitor prices', () => {
    expect(computeCompetitivenessScore([])).toBe(0);
  });

  it('returns 100% when all my prices <= competitor avg', () => {
    const prices = [
      makeCP('p1', 5.0, 6.0),
      makeCP('p2', 3.0, 4.0),
      makeCP('p3', 7.0, 8.0),
    ];

    expect(computeCompetitivenessScore(prices)).toBe(100);
  });

  it('returns 0% when all my prices > competitor avg', () => {
    const prices = [
      makeCP('p1', 10.0, 6.0),
      makeCP('p2', 8.0, 4.0),
    ];

    expect(computeCompetitivenessScore(prices)).toBe(0);
  });

  it('counts as competitive when my price equals competitor avg', () => {
    const prices = [
      makeCP('p1', 5.0, 5.0), // equal → competitive
    ];

    expect(computeCompetitivenessScore(prices)).toBe(100);
  });

  it('handles multiple competitors for same product', () => {
    const prices = [
      // Product p1: my_price=7, competitors=[5, 9] → avg=7 → 7<=7 → competitive
      makeCP('p1', 7.0, 5.0, 'Loja A'),
      makeCP('p1', 7.0, 9.0, 'Loja B'),
      // Product p2: my_price=10, competitors=[6, 8] → avg=7 → 10>7 → not competitive
      makeCP('p2', 10.0, 6.0, 'Loja A'),
      makeCP('p2', 10.0, 8.0, 'Loja B'),
    ];

    // 1 out of 2 products competitive → 50%
    expect(computeCompetitivenessScore(prices)).toBe(50);
  });

  it('calculates correct percentage with mixed results', () => {
    const prices = [
      makeCP('p1', 5.0, 6.0),  // competitive
      makeCP('p2', 5.0, 4.0),  // not competitive
      makeCP('p3', 5.0, 5.0),  // competitive (equal)
    ];

    // 2/3 → 67%
    expect(computeCompetitivenessScore(prices)).toBe(67);
  });
});

describe('Competitive — My Rank', () => {
  const rankings: StoreRanking[] = [
    { store_id: 's1', store_name: 'A', active_promotions: 10, avg_discount: 15, rank: 1 },
    { store_id: 's2', store_name: 'B', active_promotions: 8, avg_discount: 12, rank: 2 },
    { store_id: 's3', store_name: 'C', active_promotions: 5, avg_discount: 10, rank: 3 },
  ];

  it('returns rank when store is in rankings', () => {
    expect(findMyRank(rankings, 's2')).toBe(2);
  });

  it('returns null when store is not in rankings', () => {
    expect(findMyRank(rankings, 's999')).toBeNull();
  });

  it('returns null for empty rankings', () => {
    expect(findMyRank([], 's1')).toBeNull();
  });
});

describe('Competitive — Premium Access Gate', () => {
  it('grants access to super_admin regardless of plan', () => {
    expect(hasPremiumAccess('super_admin', 'free')).toBe(true);
  });

  it('grants access to premium plan', () => {
    expect(hasPremiumAccess('business', 'premium')).toBe(true);
  });

  it('grants access to premium_plus plan', () => {
    expect(hasPremiumAccess('business', 'premium_plus')).toBe(true);
  });

  it('grants access to enterprise plan', () => {
    expect(hasPremiumAccess('business', 'enterprise')).toBe(true);
  });

  it('denies access for free plan without super_admin', () => {
    expect(hasPremiumAccess('business', 'free')).toBe(false);
    expect(hasPremiumAccess(null, 'free')).toBe(false);
  });
});
