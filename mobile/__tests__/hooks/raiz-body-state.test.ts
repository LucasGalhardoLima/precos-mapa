// mobile/__tests__/hooks/raiz-body-state.test.ts
jest.mock('@/lib/supabase', () => ({ supabase: { from: jest.fn() } }));

import { raizBodyState } from '@/lib/raiz';

const base = { rowCount: 0, isLoading: false, syncFailed: false, readFailed: false };

describe('raizBodyState', () => {
  it('is dia-zero only when everything resolved and there are no items', () => {
    expect(raizBodyState(base)).toBe('dia-zero');
  });

  it('is loading while the read is in flight', () => {
    expect(raizBodyState({ ...base, isLoading: true })).toBe('loading');
  });

  it('a pending sync with no rows is sync-pending, never a blank body or dia zero', () => {
    expect(raizBodyState({ ...base, syncFailed: true })).toBe('sync-pending');
  });

  it('a failed read with no rows is read-failed, never a blank body or dia zero', () => {
    expect(raizBodyState({ ...base, readFailed: true })).toBe('read-failed');
  });

  it('when both failed, the pending sync wins (the read has nothing to read yet)', () => {
    expect(raizBodyState({ ...base, syncFailed: true, readFailed: true })).toBe('sync-pending');
  });

  it('a failure does not hide rows already shown', () => {
    expect(raizBodyState({ ...base, rowCount: 3, syncFailed: true, readFailed: true })).toBe('items');
  });
});
