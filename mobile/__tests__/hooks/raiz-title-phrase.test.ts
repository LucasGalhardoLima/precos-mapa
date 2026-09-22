// mobile/__tests__/hooks/raiz-title-phrase.test.ts

import { computeTitlePhrase } from '@/lib/raiz';
import type { TrackedRow } from '@/hooks/use-tracked-summary';

function row(overrides: Partial<TrackedRow> = {}): TrackedRow {
  return {
    key: 'k',
    productId: 'p',
    name: 'Arroz',
    size: '5 kg',
    hasPriceToday: true,
    priceLabel: 'R$ 24,90',
    winnerStoreName: 'Tenda',
    ...overrides,
  };
}

describe('computeTitlePhrase', () => {
  it('returns null when no tracked items have a price today', () => {
    expect(computeTitlePhrase([row({ hasPriceToday: false, winnerStoreName: null })])).toBeNull();
  });

  it('returns null for an empty list', () => {
    expect(computeTitlePhrase([])).toBeNull();
  });

  it('names the store that wins the most rows, not just the first row', () => {
    const rows = [
      row({ winnerStoreName: 'Savegnago' }),
      row({ winnerStoreName: 'Tenda' }),
      row({ winnerStoreName: 'Tenda' }),
      row({ winnerStoreName: 'Tenda' }),
    ];
    const result = computeTitlePhrase(rows);
    expect(result?.winner).toBe('Tenda');
    expect(result?.count).toBe(3);
    expect(result?.total).toBe(4);
  });

  it('total counts every tracked row, including ones without a price today', () => {
    const rows = [row({ winnerStoreName: 'Tenda' }), row({ hasPriceToday: false, winnerStoreName: null })];
    expect(computeTitlePhrase(rows)?.total).toBe(2);
  });

  it('never credits a win to a null winnerStoreName even if hasPriceToday is true', () => {
    // Defensive: hasPriceToday true with no winner name shouldn't happen from
    // mapSearchRow, but the tally must not silently count it as a "null" win.
    const rows = [row({ winnerStoreName: null }), row({ winnerStoreName: 'Jaú Serve' })];
    const result = computeTitlePhrase(rows);
    expect(result?.winner).toBe('Jaú Serve');
    expect(result?.count).toBe(1);
  });

  it('breaks ties by first-encountered order, not alphabetically', () => {
    const rows = [row({ winnerStoreName: 'Amarelinha' }), row({ winnerStoreName: 'Savegnago' })];
    // Both tied at 1 — first store seen (Amarelinha) keeps the lead since
    // the tally loop only replaces on strictly-greater count.
    expect(computeTitlePhrase(rows)?.winner).toBe('Amarelinha');
  });
});
