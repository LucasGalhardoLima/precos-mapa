// mobile/__tests__/hooks/raiz-generic-size.test.ts
//
// Defect (Maestro, simulator, 12/11): after onboarding with 'Leite · 1 L' and
// 'Arroz · 5 kg', Raiz showed "Leite Fermentado Jamava 120g R$ 1,89" and
// "Arroz Camil 1kg" for them. A generic item is category + default size
// (docs/poup-mlp-decisoes.md, "Item genérico vs. item-produto"), but the
// winner was picked by name prefix alone, so any product starting with the
// label won regardless of size. Products without a normalized size
// (size_value NULL) cannot be proven to match and are never matched.
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('@/lib/supabase', () => ({ supabase: { rpc: jest.fn() } }));

import { pickGenericWinner, type SizedSearchRow } from '@/lib/raiz';
import { resolveTrackedRow } from '@/lib/tracked-summary';
import { parseDefaultSize } from '@/lib/onboarding';

const fresh = new Date().toISOString();
const old = new Date(Date.now() - 57 * 86_400_000).toISOString();

function row(
  product_name: string,
  size: [number, string] | null,
  price: number | null,
  opts: { store?: string; date?: string } = {},
): SizedSearchRow {
  const prices =
    price == null ? [] : [{ store_id: 's', store_name: opts.store ?? 'Tenda', price, last_price_date: opts.date ?? fresh }];
  return {
    product_id: product_name,
    product_name,
    brand: null,
    image_url: null,
    has_active_price: price != null,
    cheapest_price: price,
    prices,
    size_value: size ? size[0] : null,
    size_unit: size ? size[1] : null,
  };
}

const LEITE_1L = parseDefaultSize('1 L'); // { value: 1000, unit: 'ml' }
const ARROZ_5KG = parseDefaultSize('5 kg'); // { value: 5000, unit: 'g' }

describe('pickGenericWinner — respects the generic item size', () => {
  it('does not resolve Leite · 1 L to Leite Fermentado 120g', () => {
    const rows = [row('Leite Fermentado Jamava 120g', [120, 'g'], 1.89)];
    expect(pickGenericWinner(rows, 'Leite', LEITE_1L)).toBeNull();
  });

  it('does not resolve to a product whose normalized size differs (Arroz Camil 1kg vs 5 kg)', () => {
    const rows = [row('Arroz Camil 1kg', [1000, 'g'], 4.5)];
    expect(pickGenericWinner(rows, 'Arroz', ARROZ_5KG)).toBeNull();
  });

  it('does not match across units (1000 g is not 1000 ml)', () => {
    const rows = [row('Leite em Pó Integral', [1000, 'g'], 30)];
    expect(pickGenericWinner(rows, 'Leite', LEITE_1L)).toBeNull();
  });

  it('never matches a product with no normalized size', () => {
    const rows = [row('Leite Integral Italac', null, 4.99)];
    expect(pickGenericWinner(rows, 'Leite', LEITE_1L)).toBeNull();
  });

  it('never matches when the generic item has no parsable size (conservative)', () => {
    const rows = [row('Leite Integral Italac 1L', [1000, 'ml'], 4.99)];
    expect(pickGenericWinner(rows, 'Leite', null)).toBeNull();
  });

  it('picks the lowest FRESH price among products that match the size (not RPC order)', () => {
    const rows = [
      row('Leite Integral Italac 1L', [1000, 'ml'], 5.49, { store: 'Tenda' }),
      row('Leite Integral Piracanjuba 1L', [1000, 'ml'], 4.79, { store: 'Savegnago' }),
      row('Leite Fermentado Jamava 120g', [120, 'g'], 1.89),
      row('Leite Integral Barato 1L', [1000, 'ml'], 3.0, { store: 'Tenda', date: old }),
    ];
    expect(pickGenericWinner(rows, 'Leite', LEITE_1L)?.product_name).toBe('Leite Integral Piracanjuba 1L');
  });

  it('control: a size match with a fresh price wins', () => {
    const rows = [row('Arroz Tio João Tipo 1 5kg', [5000, 'g'], 24.9)];
    expect(pickGenericWinner(rows, 'Arroz', ARROZ_5KG)?.product_name).toBe('Arroz Tio João Tipo 1 5kg');
  });

  it('size matches but only a stale price: returns that product so it reads "sem preço hoje"', () => {
    const rows = [row('Leite Integral Italac 1L', [1000, 'ml'], 4.99, { date: old })];
    expect(pickGenericWinner(rows, 'Leite', LEITE_1L)?.product_name).toBe('Leite Integral Italac 1L');
  });
});

describe('resolveTrackedRow — generic item on Raiz', () => {
  const rec = (label: string, size: string) => ({
    id: 't1',
    product_id: null,
    category_label: label,
    category_size: size,
    products: null,
  });

  it('Leite · 1 L with only a 120 g fermented milk available reads "sem preço hoje", not that product', async () => {
    const out = await resolveTrackedRow(rec('Leite', '1 L'), {
      productPrices: async () => [],
      genericSearch: async () => [row('Leite Fermentado Jamava 120g', [120, 'g'], 1.89)],
    });
    expect(out).toMatchObject({ productId: null, name: 'Leite', hasPriceToday: false, priceLabel: '—', winnerStoreName: null });
  });

  it('control: Leite · 1 L resolves to the matching product with its fresh price', async () => {
    const out = await resolveTrackedRow(rec('Leite', '1 L'), {
      productPrices: async () => [],
      genericSearch: async () => [
        row('Leite Fermentado Jamava 120g', [120, 'g'], 1.89),
        row('Leite Integral Italac 1L', [1000, 'ml'], 4.79, { store: 'Savegnago' }),
      ],
    });
    expect(out).toMatchObject({ productId: 'Leite Integral Italac 1L', hasPriceToday: true, winnerStoreName: 'Savegnago' });
  });
});
