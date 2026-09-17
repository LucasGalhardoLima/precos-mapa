// mobile/__tests__/hooks/use-featured-deals-logic.test.ts

// Replicate the enrichment/sorting logic from use-featured-deals.ts

import { getGamificationMessage } from '../../constants/messages';

interface RawPromotion {
  id: string;
  promo_price: number;
  original_price: number;
  end_date: string;
  product: { reference_price: number; name: string };
  store: { id: string; name: string };
}

interface EnrichedDeal {
  id: string;
  promo_price: number;
  original_price: number;
  end_date: string;
  product: { reference_price: number; name: string };
  store: { id: string; name: string };
  discountPercent: number;
  belowNormalPercent: number;
  gamificationMessage: string | null;
  distanceKm: number;
  isExpiringSoon: boolean;
  isBestPrice: boolean;
}

function enrichDeals(raw: RawPromotion[], now: Date = new Date()): EnrichedDeal[] {
  return raw
    .map((promo) => {
      const discountPercent = Math.round(
        (1 - promo.promo_price / promo.original_price) * 100,
      );
      const belowNormalPercent = Math.round(
        (1 - promo.promo_price / promo.product.reference_price) * 100,
      );
      const endDate = new Date(promo.end_date);
      const isExpiringSoon =
        endDate.getFullYear() === now.getFullYear() &&
        endDate.getMonth() === now.getMonth() &&
        endDate.getDate() === now.getDate();

      return {
        ...promo,
        discountPercent,
        belowNormalPercent: Math.max(0, belowNormalPercent),
        gamificationMessage: getGamificationMessage(discountPercent),
        distanceKm: 0,
        isExpiringSoon,
        isBestPrice: false,
      };
    })
    .sort((a, b) => b.discountPercent - a.discountPercent)
    .slice(0, 5);
}

// ===========================================================================
// Helpers
// ===========================================================================

function makePromo(overrides: Partial<RawPromotion> & { id: string }): RawPromotion {
  return {
    promo_price: 5.0,
    original_price: 10.0,
    end_date: '2026-12-31T23:59:59Z',
    product: { reference_price: 9.0, name: 'Produto' },
    store: { id: 'store-1', name: 'Mercado' },
    ...overrides,
  };
}

// ===========================================================================
// Tests
// ===========================================================================

describe('Featured Deals — Discount Calculation', () => {
  it('calculates discount percent correctly', () => {
    const deals = enrichDeals([
      makePromo({ id: 'd1', promo_price: 7.0, original_price: 10.0 }),
    ]);

    expect(deals[0].discountPercent).toBe(30); // (1 - 7/10) * 100
  });

  it('calculates 50% discount for half-price items', () => {
    const deals = enrichDeals([
      makePromo({ id: 'd1', promo_price: 5.0, original_price: 10.0 }),
    ]);

    expect(deals[0].discountPercent).toBe(50);
  });

  it('calculates below-normal percent vs reference price', () => {
    const deals = enrichDeals([
      makePromo({
        id: 'd1',
        promo_price: 6.0,
        original_price: 12.0,
        product: { reference_price: 8.0, name: 'Arroz' },
      }),
    ]);

    // (1 - 6/8) * 100 = 25%
    expect(deals[0].belowNormalPercent).toBe(25);
  });

  it('clamps belowNormalPercent to 0 when promo > reference', () => {
    const deals = enrichDeals([
      makePromo({
        id: 'd1',
        promo_price: 9.0,
        original_price: 12.0,
        product: { reference_price: 7.0, name: 'Leite' },
      }),
    ]);

    // (1 - 9/7) * 100 = -28.6 → clamped to 0
    expect(deals[0].belowNormalPercent).toBe(0);
  });

  it('handles 0% discount', () => {
    const deals = enrichDeals([
      makePromo({ id: 'd1', promo_price: 10.0, original_price: 10.0 }),
    ]);

    expect(deals[0].discountPercent).toBe(0);
  });
});

describe('Featured Deals — Expiring Soon', () => {
  it('flags deal as expiring when end_date is today', () => {
    const today = new Date('2026-03-12T10:00:00Z');
    const deals = enrichDeals(
      [makePromo({ id: 'd1', end_date: '2026-03-12T23:59:59Z' })],
      today,
    );

    expect(deals[0].isExpiringSoon).toBe(true);
  });

  it('does not flag deal expiring tomorrow', () => {
    const today = new Date('2026-03-12T10:00:00Z');
    const deals = enrichDeals(
      [makePromo({ id: 'd1', end_date: '2026-03-13T23:59:59Z' })],
      today,
    );

    expect(deals[0].isExpiringSoon).toBe(false);
  });

  it('does not flag deal expiring yesterday', () => {
    const today = new Date('2026-03-12T10:00:00Z');
    const deals = enrichDeals(
      [makePromo({ id: 'd1', end_date: '2026-03-11T23:59:59Z' })],
      today,
    );

    expect(deals[0].isExpiringSoon).toBe(false);
  });
});

describe('Featured Deals — Sorting & Limiting', () => {
  it('sorts by discountPercent descending', () => {
    const deals = enrichDeals([
      makePromo({ id: 'd1', promo_price: 9.0, original_price: 10.0 }), // 10%
      makePromo({ id: 'd2', promo_price: 5.0, original_price: 10.0 }), // 50%
      makePromo({ id: 'd3', promo_price: 7.0, original_price: 10.0 }), // 30%
    ]);

    expect(deals.map((d) => d.id)).toEqual(['d2', 'd3', 'd1']);
  });

  it('limits to top 5 deals', () => {
    const raw = Array.from({ length: 8 }, (_, i) =>
      makePromo({
        id: `d${i}`,
        promo_price: 10 - i,
        original_price: 10.0,
      }),
    );

    const deals = enrichDeals(raw);
    expect(deals).toHaveLength(5);
  });

  it('returns fewer than 5 when input is smaller', () => {
    const deals = enrichDeals([
      makePromo({ id: 'd1' }),
      makePromo({ id: 'd2' }),
    ]);

    expect(deals).toHaveLength(2);
  });
});

describe('Featured Deals — Gamification Messages', () => {
  it('assigns fire message for 40%+ discount', () => {
    const deals = enrichDeals([
      makePromo({ id: 'd1', promo_price: 5.0, original_price: 10.0 }), // 50%
    ]);

    expect(deals[0].gamificationMessage).toContain('🔥');
  });

  it('assigns money message for 25-39% discount', () => {
    const deals = enrichDeals([
      makePromo({ id: 'd1', promo_price: 7.0, original_price: 10.0 }), // 30%
    ]);

    expect(deals[0].gamificationMessage).toContain('💰');
  });

  it('assigns thumbs up message for 10-24% discount', () => {
    const deals = enrichDeals([
      makePromo({ id: 'd1', promo_price: 8.5, original_price: 10.0 }), // 15%
    ]);

    expect(deals[0].gamificationMessage).toContain('👍');
  });
});

describe('Featured Deals — Default Values', () => {
  it('sets distanceKm to 0', () => {
    const deals = enrichDeals([makePromo({ id: 'd1' })]);
    expect(deals[0].distanceKm).toBe(0);
  });

  it('sets isBestPrice to false', () => {
    const deals = enrichDeals([makePromo({ id: 'd1' })]);
    expect(deals[0].isBestPrice).toBe(false);
  });
});
