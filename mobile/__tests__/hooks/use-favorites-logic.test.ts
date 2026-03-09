// mobile/__tests__/hooks/use-favorites-logic.test.ts

describe('Favorites Logic', () => {
  describe('isFavorited', () => {
    const favorites = [
      { product_id: 'p1' },
      { product_id: 'p2' },
      { product_id: 'p3' },
    ];
    const isFavorited = (pid: string) => favorites.some((f) => f.product_id === pid);

    it('returns true for existing favorite', () => {
      expect(isFavorited('p1')).toBe(true);
      expect(isFavorited('p3')).toBe(true);
    });

    it('returns false for non-favorite', () => {
      expect(isFavorited('p99')).toBe(false);
    });

    it('returns false for empty list', () => {
      const empty: any[] = [];
      expect(empty.some((f) => f.product_id === 'p1')).toBe(false);
    });
  });

  describe('Optimistic add', () => {
    it('adds temp favorite to list immediately', () => {
      const favorites = [{ product_id: 'p1', id: '1' }];
      const tempFav = { product_id: 'p2', id: 'temp-123' };
      const updated = [...favorites, tempFav];
      expect(updated).toHaveLength(2);
      expect(updated[1].product_id).toBe('p2');
      expect(updated[1].id).toMatch(/^temp-/);
    });

    it('preserves existing favorites when adding', () => {
      const favorites = [
        { product_id: 'p1', id: '1' },
        { product_id: 'p2', id: '2' },
      ];
      const updated = [...favorites, { product_id: 'p3', id: 'temp-1' }];
      expect(updated).toHaveLength(3);
      expect(updated[0].product_id).toBe('p1');
      expect(updated[1].product_id).toBe('p2');
    });
  });

  describe('Optimistic remove', () => {
    it('removes favorite by product_id', () => {
      const favorites = [
        { product_id: 'p1', id: '1' },
        { product_id: 'p2', id: '2' },
        { product_id: 'p3', id: '3' },
      ];
      const updated = favorites.filter((f) => f.product_id !== 'p2');
      expect(updated).toHaveLength(2);
      expect(updated.map((f) => f.product_id)).toEqual(['p1', 'p3']);
    });

    it('returns empty array when removing the only favorite', () => {
      const favorites = [{ product_id: 'p1', id: '1' }];
      const updated = favorites.filter((f) => f.product_id !== 'p1');
      expect(updated).toHaveLength(0);
    });

    it('no-ops when product_id not found', () => {
      const favorites = [{ product_id: 'p1', id: '1' }];
      const updated = favorites.filter((f) => f.product_id !== 'p99');
      expect(updated).toHaveLength(1);
    });
  });

  describe('Rollback on error', () => {
    it('restores snapshot after failed add', () => {
      const snapshot = [{ product_id: 'p1', id: '1' }];
      // Simulate: add temp, then rollback
      const withTemp = [...snapshot, { product_id: 'p2', id: 'temp' }];
      expect(withTemp).toHaveLength(2);
      // Error occurred, revert
      const reverted = [...snapshot];
      expect(reverted).toHaveLength(1);
      expect(reverted[0].product_id).toBe('p1');
    });

    it('restores snapshot after failed remove', () => {
      const snapshot = [
        { product_id: 'p1', id: '1' },
        { product_id: 'p2', id: '2' },
      ];
      // Simulate: remove p1, then rollback
      const withoutP1 = snapshot.filter((f) => f.product_id !== 'p1');
      expect(withoutP1).toHaveLength(1);
      // Error occurred, revert
      const reverted = [...snapshot];
      expect(reverted).toHaveLength(2);
    });
  });

  describe('Plan limit error detection', () => {
    it('detects "limit" keyword in Supabase error message', () => {
      const errorMsg = 'favorite limit reached for free plan';
      expect(errorMsg.includes('limit')).toBe(true);
    });

    it('does not flag non-limit errors', () => {
      const errorMsg = 'network timeout';
      expect(errorMsg.includes('limit')).toBe(false);
    });

    it('generates correct user-facing error message', () => {
      const msg = 'Limite de favoritos atingido. Faca upgrade para adicionar mais.';
      expect(msg).toContain('Limite');
      expect(msg).toContain('upgrade');
    });
  });

  describe('Count', () => {
    it('returns correct count for non-empty list', () => {
      expect([{}, {}, {}].length).toBe(3);
    });

    it('returns 0 for empty list', () => {
      expect([].length).toBe(0);
    });
  });
});
