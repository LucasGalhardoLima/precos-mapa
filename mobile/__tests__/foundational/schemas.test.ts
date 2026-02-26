import { promotionSchema, storeSetupSchema, alertSchema, profileUpdateSchema } from '../../lib/schemas';

describe('Zod schemas', () => {
  describe('promotionSchema', () => {
    const validPromotion = {
      product_id: 'a0000000-0000-4000-a000-000000000001',
      original_price: 10.99,
      promo_price: 7.49,
      start_date: '2026-02-10T00:00:00.000Z',
      end_date: '2026-02-17T00:00:00.000Z',
    };

    it('accepts valid promotion', () => {
      const result = promotionSchema.safeParse(validPromotion);
      expect(result.success).toBe(true);
    });

    it('rejects promo_price >= original_price', () => {
      const result = promotionSchema.safeParse({
        ...validPromotion,
        promo_price: 11.00,
      });
      expect(result.success).toBe(false);
    });

    it('rejects end_date before start_date', () => {
      const result = promotionSchema.safeParse({
        ...validPromotion,
        start_date: '2026-02-17T00:00:00.000Z',
        end_date: '2026-02-10T00:00:00.000Z',
      });
      expect(result.success).toBe(false);
    });

    it('rejects missing required fields', () => {
      const result = promotionSchema.safeParse({
        original_price: 10.99,
      });
      expect(result.success).toBe(false);
    });

    it('rejects negative prices', () => {
      const result = promotionSchema.safeParse({
        ...validPromotion,
        original_price: -5,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('storeSetupSchema', () => {
    const validStore = {
      name: 'Carol Supermercado',
      address: 'Rua Sao Paulo, 1234',
      city: 'Matao',
      state: 'SP',
      latitude: -21.6033,
      longitude: -48.3658,
    };

    it('accepts valid store', () => {
      const result = storeSetupSchema.safeParse(validStore);
      expect(result.success).toBe(true);
    });

    it('rejects short name', () => {
      const result = storeSetupSchema.safeParse({ ...validStore, name: 'A' });
      expect(result.success).toBe(false);
    });

    it('rejects invalid state (must be 2 chars)', () => {
      const result = storeSetupSchema.safeParse({ ...validStore, state: 'São Paulo' });
      expect(result.success).toBe(false);
    });

    it('rejects latitude out of range', () => {
      const result = storeSetupSchema.safeParse({ ...validStore, latitude: 100 });
      expect(result.success).toBe(false);
    });
  });

  describe('alertSchema', () => {
    it('accepts valid alert without target price', () => {
      const result = alertSchema.safeParse({
        product_id: 'a0000000-0000-4000-a000-000000000001',
        radius_km: 5,
      });
      expect(result.success).toBe(true);
    });

    it('accepts valid alert with target price', () => {
      const result = alertSchema.safeParse({
        product_id: 'a0000000-0000-4000-a000-000000000001',
        target_price: 8.99,
        radius_km: 10,
      });
      expect(result.success).toBe(true);
    });

    it('rejects radius > 50', () => {
      const result = alertSchema.safeParse({
        product_id: 'a0000000-0000-4000-a000-000000000001',
        radius_km: 100,
      });
      expect(result.success).toBe(false);
    });

    it('rejects negative target price', () => {
      const result = alertSchema.safeParse({
        product_id: 'a0000000-0000-4000-a000-000000000001',
        target_price: -5,
        radius_km: 5,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('profileUpdateSchema', () => {
    it('accepts valid partial update', () => {
      const result = profileUpdateSchema.safeParse({
        display_name: 'Maria',
        search_radius_km: 10,
      });
      expect(result.success).toBe(true);
    });

    it('rejects radius > 50', () => {
      const result = profileUpdateSchema.safeParse({
        search_radius_km: 60,
      });
      expect(result.success).toBe(false);
    });
  });
});
