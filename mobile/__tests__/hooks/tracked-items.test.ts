// mobile/__tests__/hooks/tracked-items.test.ts

// lib/tracked-items.ts imports formatBRL from hooks/use-search.ts, which
// imports @/lib/supabase — eagerly creates a real client on import (fails
// without live env vars). Same fix as use-analytics.test.ts's note.
jest.mock('@/lib/supabase', () => ({ supabase: { from: jest.fn() } }));

import { trackedRowLabel } from '@/lib/tracked-items';
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
