// mobile/__tests__/hooks/use-search-logic.test.ts
//
// use-search.ts imports '@/lib/supabase' at module scope, which eagerly
// creates a real Supabase client on import (fails without live env vars,
// same issue documented in use-analytics.test.ts). Only mapSearchRow and
// formatBRL (pure functions) are under test here.
jest.mock('@/lib/supabase', () => ({ supabase: { rpc: jest.fn() } }));

import { mapSearchRow, formatBRL } from '@/hooks/use-search';

function row(overrides: Partial<Parameters<typeof mapSearchRow>[0]> = {}) {
  return {
    product_id: 'p1',
    product_name: 'Arroz Tio João tipo 1 · 5 kg',
    brand: 'Tio João',
    image_url: null,
    has_active_price: true,
    cheapest_price: 24.9,
    prices: [{ store_id: 's1', store_name: 'Tenda', price: 24.9 }],
    ...overrides,
  };
}

describe('mapSearchRow — has_active_price false ("sem preço hoje")', () => {
  it('never surfaces reference_price as if it were today\'s', () => {
    const result = mapSearchRow(row({ has_active_price: false, cheapest_price: 19.9 }));
    expect(result.hasPriceToday).toBe(false);
    expect(result.price).toBeNull();
    expect(result.winnerStoreName).toBeNull();
  });

  it('treats a null cheapest_price the same as has_active_price false', () => {
    const result = mapSearchRow(row({ has_active_price: true, cheapest_price: null }));
    expect(result.hasPriceToday).toBe(false);
    expect(result.price).toBeNull();
  });
});

describe('mapSearchRow — winner resolution', () => {
  it('picks the store whose price equals cheapest_price, not prices[0]', () => {
    const result = mapSearchRow(
      row({
        cheapest_price: 22.9,
        prices: [
          { store_id: 's1', store_name: 'Tenda', price: 24.9 },
          { store_id: 's2', store_name: 'Savegnago', price: 22.9 },
        ],
      }),
    );
    expect(result.winnerStoreName).toBe('Savegnago');
    expect(result.price).toBe(22.9);
  });

  it('falls back to prices[0] if nothing matches cheapest_price exactly', () => {
    const result = mapSearchRow(
      row({ cheapest_price: 99, prices: [{ store_id: 's1', store_name: 'Tenda', price: 24.9 }] }),
    );
    expect(result.winnerStoreName).toBe('Tenda');
  });
});

describe('mapSearchRow — singleStore ("só no X" vs "menor no X")', () => {
  it('is true with exactly one priced store', () => {
    expect(mapSearchRow(row({ prices: [{ store_id: 's1', store_name: 'Jaú Serve', price: 8.99 }] })).singleStore).toBe(
      true,
    );
  });

  it('is false with more than one priced store', () => {
    const result = mapSearchRow(
      row({
        prices: [
          { store_id: 's1', store_name: 'Tenda', price: 24.9 },
          { store_id: 's2', store_name: 'Savegnago', price: 23.49 },
        ],
      }),
    );
    expect(result.singleStore).toBe(false);
  });

  it('is true with zero priced stores (has_active_price false, catalog-only row)', () => {
    expect(mapSearchRow(row({ has_active_price: false, cheapest_price: null, prices: [] })).singleStore).toBe(true);
  });
});

describe('formatBRL', () => {
  it('formats with the R$ symbol and comma decimal separator', () => {
    expect(formatBRL(24.9)).toBe('R$ 24,90');
  });

  it('formats whole numbers with two decimal places', () => {
    expect(formatBRL(5)).toBe('R$ 5,00');
  });

  it('formats values over 1000 with a thousands separator', () => {
    expect(formatBRL(1234.5)).toBe('R$ 1.234,50');
  });
});
