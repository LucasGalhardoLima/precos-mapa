// mobile/__tests__/hooks/search-freshness.test.ts
//
// Defect (Maestro, busca "arroz branco"): Resultado showed "R$ 3,99, menor no
// Savegnago" while the Resposta of the same product said "Sem preço hoje"
// (that price was 57 days old). search_products_with_prices applies no
// staleness cutoff to crawler rows (and 14 days to crowdsourced), and
// mapSearchRow trusted the RPC's cheapest_price. mobile/CLAUDE.md "Frescor":
// >3 days must never be shown as today's price. The shared seam is
// mapSearchRow (feeds Resultado via useSearch AND Raiz's generic items via
// resolveTrackedRow), using the same daysAgo/isStale the Resposta uses.
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('@/lib/supabase',() => ({ supabase: { rpc: jest.fn() } }));

import { mapSearchRow, sortPricedFirst, type RawSearchRow, type RawPriceEntry } from '@/hooks/use-search';
import { resolveTrackedRow } from '@/lib/tracked-summary';

const NOW = new Date('2026-11-12T15:00:00Z');
const daysBefore = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString();

// The RPC's jsonb entries do carry last_price_date (migration 072); the mobile
// type just doesn't declare it yet, hence the cast.
function entry(store: string, price: number, ageDays: number): RawPriceEntry {
  return { store_id: store, store_name: store, price, last_price_date: daysBefore(ageDays) } as RawPriceEntry;
}

function row(prices: RawPriceEntry[]): RawSearchRow {
  return {
    product_id: 'camil-1kg',
    product_name: 'Arroz Branco Camil Tipo 1 1kg',
    brand: 'Camil',
    image_url: null,
    has_active_price: true,
    cheapest_price: Math.min(...prices.map((p) => p.price)),
    prices,
  };
}

beforeAll(() => {
  jest.useFakeTimers({ now: NOW });
});
afterAll(() => {
  jest.useRealTimers();
});

describe("mapSearchRow — Frescor (>3 days is never today's price)", () => {
  it('only a 57-day-old price: sem preço hoje, no price, no winner', () => {
    const r = mapSearchRow(row([entry('Savegnago', 3.99, 57)]));
    expect(r.hasPriceToday).toBe(false);
    expect(r.price).toBeNull();
    expect(r.winnerStoreName).toBeNull();
  });

  it('a 4-day-old price is already stale (boundary: 3 days is still fresh)', () => {
    expect(mapSearchRow(row([entry('Tenda', 5, 4)])).hasPriceToday).toBe(false);
    expect(mapSearchRow(row([entry('Tenda', 5, 3)])).hasPriceToday).toBe(true);
  });

  it('a stale price cheaper than a fresh one does not win', () => {
    const r = mapSearchRow(row([entry('Savegnago', 3.99, 57), entry('Tenda', 5.49, 0)]));
    expect(r.hasPriceToday).toBe(true);
    expect(r.price).toBe(5.49);
    expect(r.winnerStoreName).toBe('Tenda');
    expect(r.singleStore).toBe(true); // only one store is priced today
  });

  it('control: a fresh price still wins', () => {
    const r = mapSearchRow(row([entry('Savegnago', 3.99, 0), entry('Tenda', 5.49, 0)]));
    expect(r).toMatchObject({ hasPriceToday: true, price: 3.99, winnerStoreName: 'Savegnago', singleStore: false });
  });
});

describe('resolveTrackedRow — generic item shares the same rule', () => {
  it('stale-only winner renders "—" / sem preço hoje on Raiz', async () => {
    const out = await resolveTrackedRow(
      { id: 't1', product_id: null, category_label: 'Arroz', category_size: null, products: null },
      {
        productPrices: async () => [],
        genericSearch: async () => [row([entry('Savegnago', 3.99, 57)])],
      },
    );
    expect(out.hasPriceToday).toBe(false);
    expect(out.priceLabel).toBe('—');
    expect(out.winnerStoreName).toBeNull();
  });
});

// "Sem preço hoje: fim da lista" (docs/poup-mlp-decisoes.md, Resultado 5a–5c).
// The RPC orders by tier on rows that may only be stale, so after freshness
// filtering a no-price-today row can sit above priced ones.
describe('sortPricedFirst', () => {
  const r = (productId: string, hasPriceToday: boolean) => ({
    productId,
    name: productId,
    brand: null,
    imageUrl: null,
    hasPriceToday,
    price: hasPriceToday ? 1 : null,
    winnerStoreName: hasPriceToday ? 'Tenda' : null,
    singleStore: true,
  });

  it('moves sem-preço-hoje rows to the end, keeping the RPC order inside each group', () => {
    const out = sortPricedFirst([r('a', false), r('b', true), r('c', false), r('d', true)]);
    expect(out.map((x) => x.productId)).toEqual(['b', 'd', 'a', 'c']);
  });

  it('does not mutate its input', () => {
    const input = [r('a', false), r('b', true)];
    sortPricedFirst(input);
    expect(input.map((x) => x.productId)).toEqual(['a', 'b']);
  });
});
