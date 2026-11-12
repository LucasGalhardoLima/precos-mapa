jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('@/lib/supabase', () => ({ supabase: {} }));

import { loadTrackedSummary, type SummaryDeps, type TrackedRecordWithProduct } from '@/lib/tracked-summary';
import type { RawSearchRow } from '@/hooks/use-search';

const productRec: TrackedRecordWithProduct = {
  id: 't1',
  product_id: 'p1',
  category_label: null,
  category_size: null,
  products: { name: 'Leite Italac 1L', size_value: 1000, size_unit: 'ml' },
};
const genericRec: TrackedRecordWithProduct = { id: 't2', product_id: null, category_label: 'Arroz', category_size: '5 kg', products: null };

const searchRow = (name: string): RawSearchRow => ({
  product_id: 'p9',
  product_name: name,
  brand: null,
  image_url: null,
  has_active_price: true,
  cheapest_price: 4,
  prices: [{ store_id: 's1', store_name: 'Tenda', price: 4 }],
});

function deps(over: Partial<SummaryDeps> = {}): SummaryDeps {
  return {
    listTracked: async () => [productRec, genericRec],
    productPrices: async () => [{ store_id: 's1', store_name: 'Savegnago', price: 5 }],
    genericSearch: async () => [searchRow('Dog Chow Arroz'), searchRow('Arroz Camil 1kg')],
    ...over,
  };
}

describe('loadTrackedSummary', () => {
  it('resolves an item-product through its own prices and a generic one through the category search', async () => {
    const r = await loadTrackedSummary(deps());
    if (!r.ok) throw new Error('expected ok');
    expect(r.rows[0]).toMatchObject({ key: 't1', productId: 'p1', hasPriceToday: true, winnerStoreName: 'Savegnago' });
    expect(r.rows[1]).toMatchObject({ key: 't2', productId: 'p9', name: 'Arroz Camil 1kg', size: null, winnerStoreName: 'Tenda' });
  });

  it('no session is an empty list, not an error', async () => {
    expect(await loadTrackedSummary(deps({ listTracked: async () => null }))).toEqual({ ok: true, rows: [] });
  });

  it('a failed read is reported as failure, never as an empty list', async () => {
    const r = await loadTrackedSummary(
      deps({
        listTracked: async () => {
          throw new Error('network');
        },
      }),
    );
    expect(r).toEqual({ ok: false });
  });

  it('a generic item with no qualifying product is "sem preço hoje" and not tappable', async () => {
    const r = await loadTrackedSummary(deps({ genericSearch: async () => [searchRow('Dog Chow Arroz')] }));
    if (!r.ok) throw new Error('expected ok');
    expect(r.rows[1]).toMatchObject({ productId: null, name: 'Arroz', size: '5 kg', hasPriceToday: false, priceLabel: '—' });
  });

  it('one row failing to price degrades only that row', async () => {
    const r = await loadTrackedSummary(
      deps({
        productPrices: async () => {
          throw new Error('rpc');
        },
      }),
    );
    if (!r.ok) throw new Error('expected ok');
    expect(r.rows[0]).toMatchObject({ key: 't1', productId: 'p1', hasPriceToday: false, priceLabel: '—' });
    expect(r.rows[1]!.hasPriceToday).toBe(true);
  });

  it('product with no price today', async () => {
    const r = await loadTrackedSummary(deps({ listTracked: async () => [productRec], productPrices: async () => [] }));
    if (!r.ok) throw new Error('expected ok');
    expect(r.rows[0]).toMatchObject({ hasPriceToday: false, winnerStoreName: null });
  });
});
