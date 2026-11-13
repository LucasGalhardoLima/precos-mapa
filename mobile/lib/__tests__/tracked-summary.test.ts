jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('@/lib/supabase', () => ({ supabase: {} }));

import { loadTrackedSummary, type SummaryDeps, type TrackedRecordWithProduct } from '@/lib/tracked-summary';
import type { SizedSearchRow } from '@/lib/raiz';

const productRec: TrackedRecordWithProduct = {
  id: 't1',
  product_id: 'p1',
  category_label: null,
  category_size: null,
  products: { name: 'Leite Italac 1L', size_value: 1000, size_unit: 'ml' },
};
const genericRec: TrackedRecordWithProduct = { id: 't2', product_id: null, category_label: 'Arroz', category_size: '5 kg', products: null };

const searchRow = (name: string, size: [number, string] = [5000, 'g']): SizedSearchRow => ({
  product_id: 'p9',
  product_name: name,
  brand: null,
  image_url: null,
  has_active_price: true,
  cheapest_price: 4,
  prices: [{ store_id: 's1', store_name: 'Tenda', price: 4, last_price_date: new Date().toISOString() }],
  size_value: size[0],
  size_unit: size[1],
});

function deps(over: Partial<SummaryDeps> = {}): SummaryDeps {
  return {
    listTracked: async () => [productRec, genericRec],
    productPrices: async () => [{ store_id: 's1', store_name: 'Savegnago', price: 5, last_price_date: new Date().toISOString() }],
    genericSearch: async () => [searchRow('Dog Chow Arroz'), searchRow('Arroz Camil 5kg')],
    ...over,
  };
}

describe('loadTrackedSummary', () => {
  it('resolves an item-product through its own prices and a generic one through the category search', async () => {
    const r = await loadTrackedSummary(deps());
    if (!r.ok) throw new Error('expected ok');
    expect(r.rows[0]).toMatchObject({ key: 't1', productId: 'p1', hasPriceToday: true, winnerStoreName: 'Savegnago' });
    expect(r.rows[1]).toMatchObject({ key: 't2', productId: 'p9', name: 'Arroz Camil 5kg', size: null, winnerStoreName: 'Tenda' });
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

  // Frescor (mobile/CLAUDE.md): get_product_prices applies no staleness cutoff
  // to crawler rows, so a tracked product whose only price is weeks old must
  // read "sem preço hoje" on Raiz, same as its Resposta.
  it('product whose only price is 57 days old is "sem preço hoje"', async () => {
    const old = new Date(Date.now() - 57 * 86_400_000).toISOString();
    const r = await loadTrackedSummary(
      deps({
        listTracked: async () => [productRec],
        productPrices: async () => [{ store_id: 's1', store_name: 'Savegnago', price: 3.99, last_price_date: old }],
      }),
    );
    if (!r.ok) throw new Error('expected ok');
    expect(r.rows[0]).toMatchObject({ hasPriceToday: false, priceLabel: '—', winnerStoreName: null });
  });

  it('skips a stale first entry and prices from the first fresh one', async () => {
    const old = new Date(Date.now() - 57 * 86_400_000).toISOString();
    const r = await loadTrackedSummary(
      deps({
        listTracked: async () => [productRec],
        productPrices: async () => [
          { store_id: 's1', store_name: 'Savegnago', price: 3.99, last_price_date: old },
          { store_id: 's2', store_name: 'Tenda', price: 5.49, last_price_date: new Date().toISOString() },
        ],
      }),
    );
    if (!r.ok) throw new Error('expected ok');
    expect(r.rows[0]).toMatchObject({ hasPriceToday: true, winnerStoreName: 'Tenda' });
  });
});
