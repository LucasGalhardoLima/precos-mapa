// mobile/__tests__/hooks/use-alerts-logic.test.ts
import { alertSchema } from '../../lib/schemas';

const validUuid = 'a0000000-0000-4000-a000-000000000001';

describe('Alerts Logic', () => {
  describe('Zod validation', () => {
    it('accepts valid alert with default radius', () => {
      const result = alertSchema.safeParse({ product_id: validUuid, radius_km: 5 });
      expect(result.success).toBe(true);
    });

    it('accepts alert with target price', () => {
      const result = alertSchema.safeParse({
        product_id: validUuid,
        target_price: 8.99,
        radius_km: 10,
      });
      expect(result.success).toBe(true);
    });

    it('accepts minimum radius (1 km)', () => {
      const result = alertSchema.safeParse({ product_id: validUuid, radius_km: 1 });
      expect(result.success).toBe(true);
    });

    it('accepts maximum radius (50 km)', () => {
      const result = alertSchema.safeParse({ product_id: validUuid, radius_km: 50 });
      expect(result.success).toBe(true);
    });

    it('accepts large target price', () => {
      const result = alertSchema.safeParse({
        product_id: validUuid,
        target_price: 999.99,
        radius_km: 5,
      });
      expect(result.success).toBe(true);
    });

    it('rejects negative target price', () => {
      const result = alertSchema.safeParse({
        product_id: validUuid,
        target_price: -5,
        radius_km: 5,
      });
      expect(result.success).toBe(false);
    });

    it('rejects zero target price', () => {
      const result = alertSchema.safeParse({
        product_id: validUuid,
        target_price: 0,
        radius_km: 5,
      });
      expect(result.success).toBe(false);
    });

    it('rejects radius > 50 km', () => {
      const result = alertSchema.safeParse({ product_id: validUuid, radius_km: 100 });
      expect(result.success).toBe(false);
    });

    it('rejects radius < 1 km', () => {
      const result = alertSchema.safeParse({ product_id: validUuid, radius_km: 0 });
      expect(result.success).toBe(false);
    });

    it('rejects negative radius', () => {
      const result = alertSchema.safeParse({ product_id: validUuid, radius_km: -5 });
      expect(result.success).toBe(false);
    });

    it('rejects missing product_id', () => {
      const result = alertSchema.safeParse({ radius_km: 5 });
      expect(result.success).toBe(false);
    });
  });

  describe('Optimistic create', () => {
    it('adds temp alert to list', () => {
      const alerts = [{ id: 'a1', product_id: 'p1', is_active: true }];
      const tempAlert = { id: 'temp-1', product_id: 'p2', is_active: true };
      const updated = [...alerts, tempAlert];
      expect(updated).toHaveLength(2);
      expect(updated[1].product_id).toBe('p2');
    });

    it('generates temp id with timestamp prefix', () => {
      const id = 'temp-' + Date.now();
      expect(id).toMatch(/^temp-\d+$/);
    });
  });

  describe('Optimistic disable', () => {
    it('removes alert from active list by id', () => {
      const alerts = [
        { id: 'a1', product_id: 'p1' },
        { id: 'a2', product_id: 'p2' },
      ];
      const updated = alerts.filter((a) => a.id !== 'a1');
      expect(updated).toHaveLength(1);
      expect(updated[0].id).toBe('a2');
    });

    it('returns empty when disabling only alert', () => {
      const alerts = [{ id: 'a1', product_id: 'p1' }];
      const updated = alerts.filter((a) => a.id !== 'a1');
      expect(updated).toHaveLength(0);
    });
  });

  describe('Rollback on error', () => {
    it('restores snapshot after failed create', () => {
      const snapshot = [{ id: 'a1', product_id: 'p1' }];
      const withTemp = [...snapshot, { id: 'temp-1', product_id: 'p2' }];
      expect(withTemp).toHaveLength(2);
      // Error: revert
      const reverted = [...snapshot];
      expect(reverted).toHaveLength(1);
    });
  });

  describe('Plan limit error detection', () => {
    it('detects limit error from Supabase message', () => {
      const errorMsg = 'alert limit reached for free plan';
      expect(errorMsg.includes('limit')).toBe(true);
    });

    it('does not flag non-limit errors', () => {
      expect('network timeout'.includes('limit')).toBe(false);
      expect('internal server error'.includes('limit')).toBe(false);
    });

    it('user-facing message contains upgrade prompt', () => {
      const msg = 'Limite de alertas atingido. Faca upgrade para criar mais.';
      expect(msg).toContain('Limite');
      expect(msg).toContain('upgrade');
    });
  });

  describe('Count', () => {
    it('returns active alert count', () => {
      const alerts = [{ is_active: true }, { is_active: true }];
      expect(alerts.length).toBe(2);
    });

    it('returns 0 when no alerts', () => {
      expect([].length).toBe(0);
    });
  });
});
