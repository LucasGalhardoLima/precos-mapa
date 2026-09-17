// mobile/__tests__/hooks/use-price-history-logic.test.ts

// Replicate the computeTrend logic from use-price-history.ts

interface PriceDataPoint {
  date: string;
  min_promo_price: number;
  avg_promo_price: number;
  store_count: number;
  reference_price: number | null;
}

interface TrendAnalysis {
  direction: 'up' | 'down' | 'stable';
  changePercent: number;
  bestTimeToBuy: boolean;
}

function computeTrend(points: PriceDataPoint[]): TrendAnalysis {
  if (points.length < 2) {
    return { direction: 'stable', changePercent: 0, bestTimeToBuy: false };
  }

  const recent = points.slice(-7);
  const older = points.slice(0, Math.min(7, points.length - 7));

  if (recent.length === 0 || older.length === 0) {
    return { direction: 'stable', changePercent: 0, bestTimeToBuy: false };
  }

  const recentAvg =
    recent.reduce((sum, p) => sum + p.min_promo_price, 0) / recent.length;
  const olderAvg =
    older.reduce((sum, p) => sum + p.min_promo_price, 0) / older.length;

  const changePercent =
    olderAvg > 0
      ? Math.round(((recentAvg - olderAvg) / olderAvg) * 100)
      : 0;

  const direction: 'up' | 'down' | 'stable' =
    changePercent > 3 ? 'up' : changePercent < -3 ? 'down' : 'stable';

  const currentMin = points[points.length - 1].min_promo_price;
  const periodMin = Math.min(...points.map((p) => p.min_promo_price));
  const bestTimeToBuy = currentMin <= periodMin * 1.05;

  return { direction, changePercent, bestTimeToBuy };
}

// ===========================================================================
// Helpers
// ===========================================================================

function makePoint(
  day: number,
  min_promo_price: number,
  overrides?: Partial<PriceDataPoint>,
): PriceDataPoint {
  return {
    date: `2026-03-${String(day).padStart(2, '0')}`,
    min_promo_price,
    avg_promo_price: min_promo_price + 1,
    store_count: 3,
    reference_price: null,
    ...overrides,
  };
}

// ===========================================================================
// Tests
// ===========================================================================

describe('Price History — computeTrend', () => {
  it('returns stable with 0 change for fewer than 2 data points', () => {
    expect(computeTrend([])).toEqual({
      direction: 'stable',
      changePercent: 0,
      bestTimeToBuy: false,
    });

    expect(computeTrend([makePoint(1, 5.0)])).toEqual({
      direction: 'stable',
      changePercent: 0,
      bestTimeToBuy: false,
    });
  });

  it('detects upward trend when recent prices are >3% higher', () => {
    // Older: days 1-7 avg = 10.0, Recent: days 8-14 avg = 11.0 → +10%
    const points = [
      ...Array.from({ length: 7 }, (_, i) => makePoint(i + 1, 10.0)),
      ...Array.from({ length: 7 }, (_, i) => makePoint(i + 8, 11.0)),
    ];

    const trend = computeTrend(points);
    expect(trend.direction).toBe('up');
    expect(trend.changePercent).toBe(10);
  });

  it('detects downward trend when recent prices are >3% lower', () => {
    // Older avg = 10.0, Recent avg = 9.0 → -10%
    const points = [
      ...Array.from({ length: 7 }, (_, i) => makePoint(i + 1, 10.0)),
      ...Array.from({ length: 7 }, (_, i) => makePoint(i + 8, 9.0)),
    ];

    const trend = computeTrend(points);
    expect(trend.direction).toBe('down');
    expect(trend.changePercent).toBe(-10);
  });

  it('returns stable when change is within ±3%', () => {
    // Older avg = 10.0, Recent avg = 10.2 → +2%
    const points = [
      ...Array.from({ length: 7 }, (_, i) => makePoint(i + 1, 10.0)),
      ...Array.from({ length: 7 }, (_, i) => makePoint(i + 8, 10.2)),
    ];

    const trend = computeTrend(points);
    expect(trend.direction).toBe('stable');
  });

  it('bestTimeToBuy = true when current price is at period minimum', () => {
    const points = [
      makePoint(1, 12.0),
      makePoint(2, 11.0),
      makePoint(3, 10.0),
      makePoint(4, 9.0),
      makePoint(5, 8.0),
      makePoint(6, 7.0),
      makePoint(7, 6.0),
      makePoint(8, 5.0), // current = period minimum
    ];

    const trend = computeTrend(points);
    expect(trend.bestTimeToBuy).toBe(true);
  });

  it('bestTimeToBuy = true when current is within 5% of period minimum', () => {
    const points = [
      makePoint(1, 10.0),
      makePoint(2, 10.0),
      makePoint(3, 8.0),   // period minimum
      makePoint(4, 9.0),
      makePoint(5, 9.0),
      makePoint(6, 9.0),
      makePoint(7, 9.0),
      makePoint(8, 8.3),   // current: 8.3 <= 8.0 * 1.05 = 8.4 → true
    ];

    const trend = computeTrend(points);
    expect(trend.bestTimeToBuy).toBe(true);
  });

  it('bestTimeToBuy = false when current is >5% above period minimum', () => {
    const points = [
      makePoint(1, 10.0),
      makePoint(2, 10.0),
      makePoint(3, 8.0),   // period minimum
      makePoint(4, 9.0),
      makePoint(5, 9.0),
      makePoint(6, 9.0),
      makePoint(7, 9.0),
      makePoint(8, 9.0),   // current: 9.0 > 8.0 * 1.05 = 8.4 → false
    ];

    const trend = computeTrend(points);
    expect(trend.bestTimeToBuy).toBe(false);
  });

  it('handles exactly 2 data points', () => {
    // With 2 points: recent = last 7 = both, older = first min(7, 2-7=0) → empty
    // Actually: slice(0, min(7, 2-7)) = slice(0, 0) → empty → returns stable
    const points = [makePoint(1, 10.0), makePoint(2, 12.0)];
    const trend = computeTrend(points);
    // older slice is empty → returns stable
    expect(trend.direction).toBe('stable');
  });

  it('handles 8 data points (split: older=1, recent=7)', () => {
    // 8 points: recent = slice(-7) = [2..8], older = slice(0, min(7, 1)) = [1]
    const points = [
      makePoint(1, 10.0), // older
      ...Array.from({ length: 7 }, (_, i) => makePoint(i + 2, 12.0)), // recent
    ];

    const trend = computeTrend(points);
    expect(trend.direction).toBe('up');
    expect(trend.changePercent).toBe(20); // (12-10)/10 * 100
  });

  it('returns changePercent 0 when olderAvg is 0', () => {
    const points = [
      ...Array.from({ length: 7 }, (_, i) => makePoint(i + 1, 0)),
      ...Array.from({ length: 7 }, (_, i) => makePoint(i + 8, 5.0)),
    ];

    const trend = computeTrend(points);
    expect(trend.changePercent).toBe(0);
  });
});
