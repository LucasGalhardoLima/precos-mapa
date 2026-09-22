// mobile/__tests__/hooks/raiz-generic-winner.test.ts

import { pickGenericWinner } from '@/lib/raiz';
import type { RawSearchRow } from '@/hooks/use-search';

function row(product_name: string, overrides: Partial<RawSearchRow> = {}): RawSearchRow {
  return {
    product_id: product_name,
    product_name,
    brand: null,
    image_url: null,
    has_active_price: true,
    cheapest_price: 5,
    prices: [{ store_id: 's1', store_name: 'Tenda', price: 5 }],
    ...overrides,
  };
}

describe('pickGenericWinner', () => {
  // The bug this guards: querying "Arroz" via search_products_with_prices
  // returns dog food ranked first (cheapest, tier-1) because "arroz" is a
  // listed ingredient in its own product name — verified live 2026-09-22
  // against production data (docs/poup-mlp-decisoes.md's catalog).
  it('skips a cheaper ingredient-mention match that does not start with the label', () => {
    const rows = [
      row('Alimento Cão Dog Chow Cordeiro E Arroz 85g Sachê', { cheapest_price: 3.69 }),
      row('Tempero Toque De Sabor Siamar 50G Feijão, Ovos E Arroz', { cheapest_price: 3.85 }),
      row('Arroz Branco Camil Tipo 1 1kg', { cheapest_price: 3.99 }),
    ];
    expect(pickGenericWinner(rows, 'Arroz')?.product_name).toBe('Arroz Branco Camil Tipo 1 1kg');
  });

  it('is case-insensitive', () => {
    expect(pickGenericWinner([row('ARROZ TIPO 1')], 'arroz')?.product_name).toBe('ARROZ TIPO 1');
  });

  it('is accent-insensitive', () => {
    expect(pickGenericWinner([row('Oleo de Soja')], 'Óleo')?.product_name).toBe('Oleo de Soja');
  });

  it('returns null rather than a wrong product when nothing starts with the label', () => {
    const rows = [row('Feijão Camil'), row('Leite Italac')];
    expect(pickGenericWinner(rows, 'Arroz')).toBeNull();
  });

  it('returns null for an empty result set', () => {
    expect(pickGenericWinner([], 'Arroz')).toBeNull();
  });

  it('keeps the RPC\'s own price-tier order among qualifying matches (first match wins)', () => {
    const rows = [row('Arroz Parboilizado', { cheapest_price: 6 }), row('Arroz Tipo 1', { cheapest_price: 4 })];
    expect(pickGenericWinner(rows, 'Arroz')?.product_name).toBe('Arroz Parboilizado');
  });
});
