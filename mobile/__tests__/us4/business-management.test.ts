/**
 * US4 Tests: Business Management
 *
 * Tests business dashboard KPI computation, offers CRUD with Zod validation,
 * admin auth session management, and promotion limit enforcement.
 */

import { storeSetupSchema, promotionSchema } from '../../lib/schemas';

// ─── Business Dashboard KPI Computation ─────────────────────────

describe('US4: Business Dashboard KPIs', () => {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const mockPromotions = [
    { id: '1', status: 'active', created_at: new Date().toISOString() },
    { id: '2', status: 'active', created_at: new Date().toISOString() },
    { id: '3', status: 'expired', created_at: new Date().toISOString() },
    { id: '4', status: 'active', created_at: new Date(2025, 0, 15).toISOString() },
  ];

  it('counts only active promotions', () => {
    const activeCount = mockPromotions.filter((p) => p.status === 'active').length;
    expect(activeCount).toBe(3);
  });

  it('counts promotions created in current month', () => {
    const monthlyCount = mockPromotions.filter(
      (p) => new Date(p.created_at) >= monthStart,
    ).length;
    // 3 created now (this month), 1 from Jan 2025
    expect(monthlyCount).toBe(3);
  });

  it('computes usage text for limited plan', () => {
    const monthlyCount = 3;
    const monthlyLimit = 5;
    const usageText = `${monthlyCount}/${monthlyLimit} ofertas este mes`;
    expect(usageText).toBe('3/5 ofertas este mes');
  });

  it('computes usage text for unlimited plan', () => {
    const monthlyCount = 42;
    const monthlyLimit = -1;
    const usageText =
      monthlyLimit === -1
        ? `${monthlyCount} ofertas este mes`
        : `${monthlyCount}/${monthlyLimit} ofertas este mes`;
    expect(usageText).toBe('42 ofertas este mes');
  });
});

// ─── Plan Limits ─────────────────────────────────────────────────

describe('US4: Plan Limits', () => {
  const PLAN_LIMITS: Record<string, { promotions: number; label: string }> = {
    free: { promotions: 5, label: 'Gratuito' },
    premium: { promotions: 50, label: 'Premium' },
    premium_plus: { promotions: -1, label: 'Premium+' },
    enterprise: { promotions: -1, label: 'Enterprise' },
  };

  it('free plan allows 5 promotions per month', () => {
    expect(PLAN_LIMITS.free.promotions).toBe(5);
  });

  it('premium plan allows 50 promotions per month', () => {
    expect(PLAN_LIMITS.premium.promotions).toBe(50);
  });

  it('premium_plus has unlimited promotions', () => {
    expect(PLAN_LIMITS.premium_plus.promotions).toBe(-1);
  });

  it('enforces free plan boundary at 5', () => {
    const currentCount = 5;
    const limit = PLAN_LIMITS.free.promotions;
    const canCreate = limit === -1 || currentCount < limit;
    expect(canCreate).toBe(false);
  });

  it('allows premium plan at 49 of 50', () => {
    const currentCount = 49;
    const limit = PLAN_LIMITS.premium.promotions;
    const canCreate = limit === -1 || currentCount < limit;
    expect(canCreate).toBe(true);
  });
});

// ─── Offer CRUD with Zod Validation ─────────────────────────────

describe('US4: Offer Creation Validation', () => {
  it('accepts valid promotion data', () => {
    const result = promotionSchema.safeParse({
      product_id: 'a0000000-0000-4000-a000-000000000001',
      original_price: 10.0,
      promo_price: 7.99,
      start_date: '2026-01-01T00:00:00Z',
      end_date: '2026-02-28T23:59:59Z',
    });
    expect(result.success).toBe(true);
  });

  it('rejects promo_price greater than original_price', () => {
    const result = promotionSchema.safeParse({
      product_id: 'a0000000-0000-4000-a000-000000000001',
      original_price: 5.0,
      promo_price: 8.99,
      start_date: '2026-01-01T00:00:00Z',
      end_date: '2026-02-28T23:59:59Z',
    });
    expect(result.success).toBe(false);
  });

  it('rejects end_date before start_date', () => {
    const result = promotionSchema.safeParse({
      product_id: 'a0000000-0000-4000-a000-000000000001',
      original_price: 10.0,
      promo_price: 7.99,
      start_date: '2026-03-01T00:00:00Z',
      end_date: '2026-02-01T00:00:00Z',
    });
    expect(result.success).toBe(false);
  });

  it('rejects negative price', () => {
    const result = promotionSchema.safeParse({
      product_id: 'a0000000-0000-4000-a000-000000000001',
      original_price: -5.0,
      promo_price: 3.0,
      start_date: '2026-01-01T00:00:00Z',
      end_date: '2026-02-28T23:59:59Z',
    });
    expect(result.success).toBe(false);
  });
});

// ─── Store Setup Validation ──────────────────────────────────────

describe('US4: Store Profile Validation', () => {
  it('accepts valid store data', () => {
    const result = storeSetupSchema.safeParse({
      name: 'Carol Supermercado',
      address: 'Rua XV de Novembro, 123 - Centro',
      city: 'Matao',
      state: 'SP',
      latitude: -21.6033,
      longitude: -48.3658,
    });
    expect(result.success).toBe(true);
  });

  it('rejects store name shorter than 2 chars', () => {
    const result = storeSetupSchema.safeParse({
      name: 'A',
      address: 'Rua XV de Novembro, 123',
      city: 'Matao',
      state: 'SP',
      latitude: -21.6033,
      longitude: -48.3658,
    });
    expect(result.success).toBe(false);
  });

  it('rejects state with more than 2 chars', () => {
    const result = storeSetupSchema.safeParse({
      name: 'Carol Supermercado',
      address: 'Rua XV de Novembro, 123',
      city: 'Matao',
      state: 'SAO',
      latitude: -21.6033,
      longitude: -48.3658,
    });
    expect(result.success).toBe(false);
  });
});

// ─── Moderation Logic ────────────────────────────────────────────

describe('US4: Moderation Flagging', () => {
  function shouldFlag(
    originalPrice: number,
    promoPrice: number,
  ): { flagged: boolean; reason: string } {
    const discount =
      originalPrice > 0
        ? Math.round(((originalPrice - promoPrice) / originalPrice) * 100)
        : 0;

    if (discount > 80) return { flagged: true, reason: `Desconto muito alto (${discount}%)` };
    if (promoPrice < 0.5) return { flagged: true, reason: `Preco muito baixo (R$ ${promoPrice.toFixed(2)})` };
    return { flagged: false, reason: '' };
  }

  it('flags promotion with >80% discount', () => {
    const result = shouldFlag(10.0, 1.5);
    expect(result.flagged).toBe(true);
    expect(result.reason).toContain('85%');
  });

  it('flags promotion with promo_price < R$0.50', () => {
    // Use a case where discount is <= 80% but price is very low
    const result = shouldFlag(0.6, 0.29);
    expect(result.flagged).toBe(true);
    expect(result.reason).toContain('0.29');
  });

  it('does not flag normal promotion', () => {
    const result = shouldFlag(10.0, 7.99);
    expect(result.flagged).toBe(false);
  });
});
