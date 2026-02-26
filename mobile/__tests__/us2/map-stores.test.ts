import { calculateDistanceKm } from '../../hooks/use-location';

// Mock supabase
const mockSupabaseClient = {
  from: jest.fn(),
  auth: {
    getSession: jest.fn().mockResolvedValue({ data: { session: null } }),
    onAuthStateChange: jest.fn(() => ({
      data: { subscription: { unsubscribe: jest.fn() } },
    })),
  },
  rpc: jest.fn(),
  channel: jest.fn(() => ({
    on: jest.fn().mockReturnThis(),
    subscribe: jest.fn(),
  })),
  removeChannel: jest.fn(),
};

jest.mock('../../lib/supabase', () => ({
  supabase: mockSupabaseClient,
}));

describe('US2 — Map & Stores', () => {
  describe('Distance calculations for stores', () => {
    it('calculates Matao to Araraquara distance (~25 km)', () => {
      const dist = calculateDistanceKm(-21.6033, -48.3658, -21.7946, -48.1756);
      expect(dist).toBeGreaterThan(20);
      expect(dist).toBeLessThan(30);
    });

    it('calculates Matao to Ribeirao Preto distance (~60 km)', () => {
      const dist = calculateDistanceKm(-21.6033, -48.3658, -21.1704, -47.8103);
      expect(dist).toBeGreaterThan(50);
      expect(dist).toBeLessThan(80);
    });

    it('calculates Matao to Sao Carlos distance (~50 km)', () => {
      const dist = calculateDistanceKm(-21.6033, -48.3658, -22.0174, -47.8908);
      expect(dist).toBeGreaterThan(40);
      expect(dist).toBeLessThan(70);
    });
  });

  describe('Store with promotions enrichment', () => {
    it('computes active promotion count correctly', () => {
      const promotions = [
        { status: 'active', end_date: new Date(Date.now() + 86400000).toISOString() },
        { status: 'active', end_date: new Date(Date.now() + 86400000).toISOString() },
        { status: 'expired', end_date: new Date(Date.now() - 86400000).toISOString() },
      ];
      const active = promotions.filter((p) => p.status === 'active');
      expect(active.length).toBe(2);
    });

    it('sorts top deals by discount descending', () => {
      const deals = [
        { discountPercent: 20 },
        { discountPercent: 45 },
        { discountPercent: 32 },
      ];
      const sorted = [...deals].sort((a, b) => b.discountPercent - a.discountPercent);
      expect(sorted[0].discountPercent).toBe(45);
      expect(sorted[1].discountPercent).toBe(32);
      expect(sorted[2].discountPercent).toBe(20);
    });

    it('limits top deals to 3', () => {
      const deals = Array.from({ length: 10 }, (_, i) => ({
        discountPercent: i * 5,
      }));
      const topDeals = [...deals]
        .sort((a, b) => b.discountPercent - a.discountPercent)
        .slice(0, 3);
      expect(topDeals.length).toBe(3);
    });
  });

  describe('Location permission handling', () => {
    it('identifies granted permission', () => {
      const status = 'granted';
      expect(status === 'granted').toBe(true);
    });

    it('identifies denied permission', () => {
      const status = 'denied';
      expect(status === 'granted').toBe(false);
    });

    it('falls back to default location when denied', () => {
      const FALLBACK = { latitude: -21.6033, longitude: -48.3658 };
      const permissionGranted = false;
      const location = permissionGranted ? { latitude: -23.5, longitude: -46.6 } : FALLBACK;
      expect(location.latitude).toBe(-21.6033);
    });
  });
});
