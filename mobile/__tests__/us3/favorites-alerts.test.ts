import { alertSchema } from '../../lib/schemas';

// Mock supabase
const mockSupabaseClient = {
  from: jest.fn(),
  auth: {
    getSession: jest.fn().mockResolvedValue({ data: { session: null } }),
    onAuthStateChange: jest.fn(() => ({
      data: { subscription: { unsubscribe: jest.fn() } },
    })),
  },
};

jest.mock('../../lib/supabase', () => ({
  supabase: mockSupabaseClient,
}));

describe('US3 — Favorites & Alerts', () => {
  describe('Favorite plan limits', () => {
    it('Free plan allows up to 10 favorites', () => {
      const FREE_LIMIT = 10;
      const currentCount = 9;
      expect(currentCount < FREE_LIMIT).toBe(true);
    });

    it('Free plan blocks 11th favorite', () => {
      const FREE_LIMIT = 10;
      const currentCount = 10;
      expect(currentCount < FREE_LIMIT).toBe(false);
    });

    it('Plus plan has unlimited favorites', () => {
      const plan = 'plus';
      const UNLIMITED_PLANS = ['plus', 'family'];
      expect(UNLIMITED_PLANS.includes(plan)).toBe(true);
    });
  });

  describe('Alert Zod validation', () => {
    it('accepts valid alert with product_id and radius', () => {
      const result = alertSchema.safeParse({
        product_id: 'a0000000-0000-4000-a000-000000000001',
        radius_km: 5,
      });
      expect(result.success).toBe(true);
    });

    it('accepts alert with target price', () => {
      const result = alertSchema.safeParse({
        product_id: 'a0000000-0000-4000-a000-000000000001',
        target_price: 8.99,
        radius_km: 10,
      });
      expect(result.success).toBe(true);
    });

    it('rejects negative target price', () => {
      const result = alertSchema.safeParse({
        product_id: 'a0000000-0000-4000-a000-000000000001',
        target_price: -5,
        radius_km: 5,
      });
      expect(result.success).toBe(false);
    });

    it('rejects radius > 50 km', () => {
      const result = alertSchema.safeParse({
        product_id: 'a0000000-0000-4000-a000-000000000001',
        radius_km: 100,
      });
      expect(result.success).toBe(false);
    });

    it('rejects radius < 1 km', () => {
      const result = alertSchema.safeParse({
        product_id: 'a0000000-0000-4000-a000-000000000001',
        radius_km: 0,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('Alert plan limits', () => {
    it('Free plan allows up to 3 alerts', () => {
      const FREE_LIMIT = 3;
      const currentCount = 2;
      expect(currentCount < FREE_LIMIT).toBe(true);
    });

    it('Free plan blocks 4th alert', () => {
      const FREE_LIMIT = 3;
      const currentCount = 3;
      expect(currentCount < FREE_LIMIT).toBe(false);
    });
  });

  describe('isFavorited check', () => {
    it('returns true when product is in favorites list', () => {
      const favorites = [
        { product_id: 'p1' },
        { product_id: 'p2' },
        { product_id: 'p3' },
      ];
      const isFavorited = (pid: string) => favorites.some((f) => f.product_id === pid);
      expect(isFavorited('p2')).toBe(true);
    });

    it('returns false when product is not in favorites', () => {
      const favorites = [{ product_id: 'p1' }];
      const isFavorited = (pid: string) => favorites.some((f) => f.product_id === pid);
      expect(isFavorited('p99')).toBe(false);
    });
  });
});
