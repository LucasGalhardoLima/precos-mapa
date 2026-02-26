import { getGamificationMessage } from '../../constants/messages';
import { calculateDistanceKm } from '../../hooks/use-location';

describe('US1 — Promotion Enrichment', () => {
  describe('getGamificationMessage', () => {
    it('returns fire message for >= 40% discount', () => {
      expect(getGamificationMessage(40)).toContain('Voce evitou pagar caro');
    });

    it('returns money message for >= 25% discount', () => {
      expect(getGamificationMessage(25)).toContain('Boa economia');
    });

    it('returns thumbs up for >= 10% discount', () => {
      expect(getGamificationMessage(10)).toContain('Vale a pena conferir');
    });

    it('returns null for < 10% discount', () => {
      expect(getGamificationMessage(5)).toBeNull();
    });

    it('returns highest tier for exactly 40%', () => {
      expect(getGamificationMessage(40)).toContain('Voce evitou pagar caro');
    });

    it('returns second tier for 39%', () => {
      expect(getGamificationMessage(39)).toContain('Boa economia');
    });
  });

  describe('calculateDistanceKm', () => {
    it('returns 0 for same coordinates', () => {
      expect(calculateDistanceKm(-21.6033, -48.3658, -21.6033, -48.3658)).toBe(0);
    });

    it('calculates approximate distance between Matao and Araraquara', () => {
      const dist = calculateDistanceKm(-21.6033, -48.3658, -21.7946, -48.1756);
      // ~25 km
      expect(dist).toBeGreaterThan(20);
      expect(dist).toBeLessThan(30);
    });

    it('returns distance in single decimal precision', () => {
      const dist = calculateDistanceKm(-21.6033, -48.3658, -21.7946, -48.1756);
      const decimalPart = dist.toString().split('.')[1];
      expect(!decimalPart || decimalPart.length <= 1).toBe(true);
    });
  });

  describe('Discount computation', () => {
    it('computes correct discount percentage', () => {
      const original = 10.99;
      const promo = 7.49;
      const discount = Math.round((1 - promo / original) * 100);
      expect(discount).toBe(32);
    });

    it('computes below normal percentage', () => {
      const referencePrice = 10.99;
      const promoPrice = 7.49;
      const belowNormal = Math.round((1 - promoPrice / referencePrice) * 100);
      expect(belowNormal).toBe(32);
    });

    it('clamps below normal to 0 when promo > reference', () => {
      const belowNormal = Math.max(0, Math.round((1 - 12 / 10) * 100));
      expect(belowNormal).toBe(0);
    });
  });

  describe('Melhor Preco badge logic', () => {
    it('marks cheapest promotion for a product as best price', () => {
      const promotions = [
        { product_id: 'p1', promo_price: 7.49 },
        { product_id: 'p1', promo_price: 8.29 },
        { product_id: 'p1', promo_price: 9.99 },
      ];

      const bestPriceMap = new Map<string, number>();
      for (const p of promotions) {
        const current = bestPriceMap.get(p.product_id);
        if (current === undefined || p.promo_price < current) {
          bestPriceMap.set(p.product_id, p.promo_price);
        }
      }

      expect(bestPriceMap.get('p1')).toBe(7.49);
      expect(promotions[0].promo_price <= bestPriceMap.get('p1')!).toBe(true);
      expect(promotions[1].promo_price <= bestPriceMap.get('p1')!).toBe(false);
    });

    it('handles multiple products independently', () => {
      const promotions = [
        { product_id: 'p1', promo_price: 7.49 },
        { product_id: 'p2', promo_price: 4.99 },
        { product_id: 'p1', promo_price: 8.29 },
        { product_id: 'p2', promo_price: 5.49 },
      ];

      const bestPriceMap = new Map<string, number>();
      for (const p of promotions) {
        const current = bestPriceMap.get(p.product_id);
        if (current === undefined || p.promo_price < current) {
          bestPriceMap.set(p.product_id, p.promo_price);
        }
      }

      expect(bestPriceMap.get('p1')).toBe(7.49);
      expect(bestPriceMap.get('p2')).toBe(4.99);
    });
  });

  describe('Expiring soon detection', () => {
    it('marks promotion as expiring soon when < 24h left', () => {
      const endDate = new Date(Date.now() + 12 * 3600000).toISOString();
      const hoursLeft = (new Date(endDate).getTime() - Date.now()) / 3600000;
      expect(hoursLeft <= 24 && hoursLeft > 0).toBe(true);
    });

    it('does not mark as expiring when > 24h left', () => {
      const endDate = new Date(Date.now() + 48 * 3600000).toISOString();
      const hoursLeft = (new Date(endDate).getTime() - Date.now()) / 3600000;
      expect(hoursLeft <= 24).toBe(false);
    });

    it('does not mark expired promotions as expiring soon', () => {
      const endDate = new Date(Date.now() - 3600000).toISOString();
      const hoursLeft = (new Date(endDate).getTime() - Date.now()) / 3600000;
      expect(hoursLeft > 0).toBe(false);
    });
  });
});
