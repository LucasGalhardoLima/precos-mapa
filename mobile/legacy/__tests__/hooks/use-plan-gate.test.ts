// mobile/__tests__/hooks/use-plan-gate.test.ts

// Replicate the pure logic from use-plan-gate.ts (not exported, needs React context)
const FREE_LIMITS = {
  favorites: 10,
  alerts: 3,
  comparison_stores: 5,
} as const;

type Feature = 'favorites' | 'alerts' | 'comparison_stores' | 'smart_lists' | 'price_history';
const PLUS_FEATURES: Feature[] = ['smart_lists', 'price_history'];

function canUse(isPaid: boolean, feature: Feature, currentCount?: number): boolean {
  if (isPaid) return true;
  if (PLUS_FEATURES.includes(feature)) return false;
  const limit = FREE_LIMITS[feature as keyof typeof FREE_LIMITS];
  if (limit !== undefined && currentCount !== undefined) {
    return currentCount < limit;
  }
  return true;
}

function getLimit(isPaid: boolean, feature: keyof typeof FREE_LIMITS): number | null {
  return isPaid ? null : FREE_LIMITS[feature];
}

describe('Plan Gate Logic', () => {
  describe('Free plan', () => {
    const isPaid = false;

    it('allows favorites under limit (9 < 10)', () => {
      expect(canUse(isPaid, 'favorites', 9)).toBe(true);
    });

    it('blocks favorites at limit (10 >= 10)', () => {
      expect(canUse(isPaid, 'favorites', 10)).toBe(false);
    });

    it('blocks favorites over limit (15 >= 10)', () => {
      expect(canUse(isPaid, 'favorites', 15)).toBe(false);
    });

    it('allows alerts under limit (2 < 3)', () => {
      expect(canUse(isPaid, 'alerts', 2)).toBe(true);
    });

    it('blocks alerts at limit (3 >= 3)', () => {
      expect(canUse(isPaid, 'alerts', 3)).toBe(false);
    });

    it('allows comparison_stores under limit (4 < 5)', () => {
      expect(canUse(isPaid, 'comparison_stores', 4)).toBe(true);
    });

    it('blocks comparison_stores at limit (5 >= 5)', () => {
      expect(canUse(isPaid, 'comparison_stores', 5)).toBe(false);
    });

    it('blocks smart_lists (plus-only feature)', () => {
      expect(canUse(isPaid, 'smart_lists')).toBe(false);
    });

    it('blocks price_history (plus-only feature)', () => {
      expect(canUse(isPaid, 'price_history')).toBe(false);
    });

    it('returns numeric limit for favorites', () => {
      expect(getLimit(false, 'favorites')).toBe(10);
    });

    it('returns numeric limit for alerts', () => {
      expect(getLimit(false, 'alerts')).toBe(3);
    });

    it('returns numeric limit for comparison_stores', () => {
      expect(getLimit(false, 'comparison_stores')).toBe(5);
    });
  });

  describe('Paid plan (plus or family)', () => {
    const isPaid = true;

    it('allows favorites regardless of count', () => {
      expect(canUse(isPaid, 'favorites', 999)).toBe(true);
    });

    it('allows alerts regardless of count', () => {
      expect(canUse(isPaid, 'alerts', 999)).toBe(true);
    });

    it('allows comparison_stores regardless of count', () => {
      expect(canUse(isPaid, 'comparison_stores', 999)).toBe(true);
    });

    it('allows smart_lists', () => {
      expect(canUse(isPaid, 'smart_lists')).toBe(true);
    });

    it('allows price_history', () => {
      expect(canUse(isPaid, 'price_history')).toBe(true);
    });

    it('returns null limit for favorites', () => {
      expect(getLimit(true, 'favorites')).toBeNull();
    });

    it('returns null limit for alerts', () => {
      expect(getLimit(true, 'alerts')).toBeNull();
    });

    it('returns null limit for comparison_stores', () => {
      expect(getLimit(true, 'comparison_stores')).toBeNull();
    });
  });

  describe('Edge cases', () => {
    it('allows feature when no count provided and not plus-only', () => {
      expect(canUse(false, 'favorites')).toBe(true);
      expect(canUse(false, 'alerts')).toBe(true);
    });

    it('allows feature at count 0', () => {
      expect(canUse(false, 'favorites', 0)).toBe(true);
      expect(canUse(false, 'alerts', 0)).toBe(true);
      expect(canUse(false, 'comparison_stores', 0)).toBe(true);
    });

    it('allows feature at count 1', () => {
      expect(canUse(false, 'favorites', 1)).toBe(true);
      expect(canUse(false, 'alerts', 1)).toBe(true);
    });
  });
});
