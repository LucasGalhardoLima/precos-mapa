// mobile/__tests__/hooks/tracked-items.test.ts

// lib/tracked-items.ts imports formatBRL from hooks/use-search.ts, which
// imports @/lib/supabase — eagerly creates a real client on import (fails
// without live env vars). Same fix as use-analytics.test.ts's note.
jest.mock('@/lib/supabase', () => ({ supabase: { from: jest.fn() } }));

import { trackedRowLabel, readTrackedState, saveTrackedItem, type TrackedReadDeps, type TrackedSaveDeps } from '@/lib/tracked-items';
import { formatBRL } from '@/hooks/use-search';

describe('trackedRowLabel', () => {
  it('shows the target price when one was set', () => {
    // formatBRL's own toLocaleString output (may use a non-breaking space
    // after "R$") — compared against itself, not a hardcoded literal, so
    // this doesn't depend on that encoding detail.
    expect(trackedRowLabel({ isTracked: true, targetPrice: 24.9 })).toBe(`acompanhando · avisar abaixo de ${formatBRL(24.9)}`);
  });

  it('is just "acompanhando" when tracked without a target price', () => {
    expect(trackedRowLabel({ isTracked: true, targetPrice: null })).toBe('acompanhando');
  });
});

describe('readTrackedState', () => {
  const deps = (over: Partial<TrackedReadDeps> = {}): TrackedReadDeps => ({
    getUserId: async () => 'u1',
    selectTarget: async () => ({ data: { target_price: 9.9 }, error: null }),
    ...over,
  });

  it('reads tracked + target price', async () => {
    expect(await readTrackedState(deps(), 'p1')).toEqual({ status: 'ok', state: { isTracked: true, targetPrice: 9.9 } });
  });

  it('no session is a real "not tracked"', async () => {
    expect(await readTrackedState(deps({ getUserId: async () => null }), 'p1')).toEqual({ status: 'ok', state: { isTracked: false, targetPrice: null } });
  });

  it('a rejected read is an error, not a rejection that leaves the state unresolved forever', async () => {
    const d = deps({
      selectTarget: async () => {
        throw new Error('Network request failed');
      },
    });
    await expect(readTrackedState(d, 'p1')).resolves.toEqual({ status: 'error' });
  });

  it('a read that returns an error is an error, not "not tracked"', async () => {
    const d = deps({ selectTarget: async () => ({ data: null, error: { message: 'boom' } }) });
    await expect(readTrackedState(d, 'p1')).resolves.toEqual({ status: 'error' });
  });
});

describe('saveTrackedItem', () => {
  const deps = (over: Partial<TrackedSaveDeps> = {}): TrackedSaveDeps => ({
    getUserId: async () => 'u1',
    signInAnonymously: async () => 'anon',
    selectExisting: async () => ({ data: null, error: null }),
    update: jest.fn(async () => ({ error: null })),
    insert: jest.fn(async () => ({ error: null })),
    ...over,
  });

  it('inserts when there is no row yet, updates when there is one', async () => {
    const d = deps();
    expect(await saveTrackedItem(d, 'p1', 5)).toBe(true);
    expect(d.insert).toHaveBeenCalledWith('u1', 'p1', 5);
    const d2 = deps({ selectExisting: async () => ({ data: { id: 'r1' }, error: null }) });
    expect(await saveTrackedItem(d2, 'p1', null)).toBe(true);
    expect(d2.update).toHaveBeenCalledWith('r1', null);
  });

  it('returns false (does not throw) when the write throws', async () => {
    const d = deps({
      insert: async () => {
        throw new Error('Network request failed');
      },
    });
    await expect(saveTrackedItem(d, 'p1', 5)).resolves.toBe(false);
  });

  it('returns false and writes nothing when looking up the existing row failed', async () => {
    const d = deps({ selectExisting: async () => ({ data: null, error: { message: 'boom' } }) });
    expect(await saveTrackedItem(d, 'p1', 5)).toBe(false);
    expect(d.insert).not.toHaveBeenCalled();
    expect(d.update).not.toHaveBeenCalled();
  });

  it('returns false when anonymous sign-in yields no user', async () => {
    expect(await saveTrackedItem(deps({ getUserId: async () => null, signInAnonymously: async () => null }), 'p1', 5)).toBe(false);
  });
});
