// mobile/__tests__/hooks/resposta.test.ts

import { buildRespostaView, daysAgo, freshnessLabel, isStale, type ProductInfo, type RawStorePrice } from '@/lib/resposta';

const NOW = new Date('2026-09-23T12:00:00Z');

function product(overrides: Partial<ProductInfo> = {}): ProductInfo {
  return { id: 'p1', name: 'Arroz Tio João tipo 1', brand: 'Tio João', ean: '7891234567890', imageUrl: null, sizeValue: 5000, sizeUnit: 'g', ...overrides };
}

function row(overrides: Partial<RawStorePrice> = {}): RawStorePrice {
  return {
    store_id: 's1',
    store_name: 'Tenda',
    price: 24.9,
    distance_km: 1.8,
    last_price_date: NOW.toISOString(),
    store_logo_initial: 'T',
    store_logo_color: '#000',
    ...overrides,
  };
}

describe('daysAgo / isStale / freshnessLabel', () => {
  it('is 0 for the same UTC calendar day', () => {
    expect(daysAgo('2026-09-23T09:14:00Z', NOW)).toBe(0);
  });

  it('counts whole calendar days, not 24h windows', () => {
    // 2 days before NOW's date, even though only ~26h apart in wall-clock time
    expect(daysAgo('2026-09-21T23:00:00Z', NOW)).toBe(2);
  });

  it('flags >3 days as stale, 3 as not', () => {
    expect(isStale(3)).toBe(false);
    expect(isStale(4)).toBe(true);
  });

  it('has no label for 0 days, singular for 1, plural for 2+', () => {
    expect(freshnessLabel(0)).toBeNull();
    expect(freshnessLabel(1)).toBe('há 1 dia');
    expect(freshnessLabel(2)).toBe('há 2 dias');
  });
});

describe('buildRespostaView — 3a: com EAN, "aqui" não vence', () => {
  it('titles by the winner, compares winner to the here-store, marks isHere/isWinner separately', () => {
    const rows = [
      row({ store_id: 's-tenda', store_name: 'Tenda', price: 24.9, distance_km: 1.8, last_price_date: NOW.toISOString() }),
      row({ store_id: 's-savegnago', store_name: 'Savegnago', price: 27.0, distance_km: 0.6, last_price_date: NOW.toISOString() }),
      row({ store_id: 's-jau', store_name: 'Jaú Serve', price: 27.49, distance_km: 2.4, last_price_date: NOW.toISOString() }),
    ];
    const view = buildRespostaView(product(), rows, NOW);

    expect(view.mode).toBe('comparison');
    expect(view.title).toBe('Menor preço no Tenda');
    expect(view.price).toBe(24.9);
    expect(view.comparison).toEqual({ amount: 2.1, storeName: 'Savegnago', isHere: true });
    expect(view.whereRows.find((r) => r.storeId === 's-tenda')?.isWinner).toBe(true);
    expect(view.whereRows.find((r) => r.storeId === 's-savegnago')?.isHere).toBe(true);
    expect(view.whereRows.find((r) => r.storeId === 's-savegnago')?.isWinner).toBe(false);
    expect(view.freshCount).toBe(3);
  });

  it('computes price per unit in kg for a gram-sized product', () => {
    const view = buildRespostaView(product({ sizeValue: 5000, sizeUnit: 'g' }), [row({ price: 24.9 })], NOW);
    expect(view.pricePerUnit).toEqual({ value: 4.98, unit: 'kg' });
  });

  it('has no price-per-unit when the product has no parsed size', () => {
    const view = buildRespostaView(product({ sizeValue: null, sizeUnit: null }), [row()], NOW);
    expect(view.pricePerUnit).toBeNull();
  });
});

describe('buildRespostaView — 3b: "aqui" vence, loja defasada, stale store excluded', () => {
  it('compares the winner to 2nd place (not itself) when "aqui" is the winner, and pulls >3-day stores into staleStores', () => {
    const rows = [
      row({ store_id: 's-savegnago', store_name: 'Savegnago', price: 4.79, distance_km: 0.6, last_price_date: NOW.toISOString() }),
      row({ store_id: 's-tenda', store_name: 'Tenda', price: 5.19, distance_km: 1.8, last_price_date: NOW.toISOString() }),
      row({ store_id: 's-jau', store_name: 'Jaú Serve', price: 5.29, distance_km: 2.4, last_price_date: NOW.toISOString() }),
      row({ store_id: 's-amarelinha', store_name: 'Amarelinha', price: 4.5, distance_km: 3.1, last_price_date: '2026-09-18T10:00:00Z' }), // 5 days stale, cheaper than the winner but excluded from ranking
    ];
    const view = buildRespostaView(product({ sizeValue: 1000, sizeUnit: 'ml' }), rows, NOW);

    expect(view.title).toBe('Menor preço no Savegnago');
    expect(view.comparison).toEqual({ amount: 0.4, storeName: 'Tenda', isHere: false });
    expect(view.whereRows.some((r) => r.storeId === 's-amarelinha')).toBe(false);
    expect(view.staleStores).toEqual([{ storeName: 'Amarelinha', daysAgo: 5 }]);
    expect(view.freshCount).toBe(3);
    expect(view.footerNote).toBe('preços de hoje, 03:00 · 3 de 4 mercados');
  });
});

describe('buildRespostaView — 3c: sem EAN, fato de um mercado só', () => {
  it('never compares, titles as a fact, shows a single un-badged row', () => {
    const view = buildRespostaView(product({ ean: null, sizeValue: null, sizeUnit: null }), [row({ store_name: 'Jaú Serve', price: 16.9 })], NOW);

    expect(view.mode).toBe('fact');
    expect(view.title).toBe('Preço de hoje no Jaú Serve');
    expect(view.comparison).toBeNull();
    expect(view.whereRows).toHaveLength(1);
    expect(view.whereRows[0]?.isWinner).toBe(false);
    expect(view.footerNote).toBe('preço de hoje, 03:00 · Jaú Serve');
  });
});

describe('buildRespostaView — 3d: sem preço hoje', () => {
  it('falls back to the flat muted list when nothing fresh exists, even with EAN', () => {
    const rows = [
      row({ store_id: 's-tenda', store_name: 'Tenda', price: 8.49, distance_km: 1.8, last_price_date: '2026-09-17T10:00:00Z' }), // 6 days
      row({ store_id: 's-savegnago', store_name: 'Savegnago', price: 8.99, distance_km: 0.6, last_price_date: '2026-09-14T10:00:00Z' }), // 9 days
    ];
    const view = buildRespostaView(product(), rows, NOW);

    expect(view.mode).toBe('no-price');
    expect(view.title).toBe('Sem preço hoje');
    expect(view.price).toBeNull();
    expect(view.whereRows).toHaveLength(2);
    expect(view.whereRows.every((r) => r.isStale)).toBe(true);
    expect(view.whereRows.every((r) => !r.isWinner)).toBe(true);
    expect(view.footerNote).toBe('últimos preços vistos · 2 de 4 mercados');
  });

  it('renders an empty ONDE, not an error, when there are zero rows at all', () => {
    const view = buildRespostaView(product(), [], NOW);
    expect(view.mode).toBe('no-price');
    expect(view.whereRows).toEqual([]);
    expect(view.footerNote).toBe('últimos preços vistos · 0 de 4 mercados');
  });
});

describe('buildRespostaView — preferredChain (folha "trocar")', () => {
  it('overrides GPS-nearest when a row for the preferred chain exists', () => {
    const rows = [
      row({ store_id: 's-tenda', store_name: 'Tenda Atacado - Matão', price: 24.9, distance_km: 0.2 }), // GPS-nearest, but not preferred
      row({ store_id: 's-amarelinha', store_name: 'Amarelinha Loja 21 Flamboyant', price: 27.0, distance_km: 3.1 }),
    ];
    const view = buildRespostaView(product(), rows, NOW, 'Amarelinha');
    expect(view.whereRows.find((r) => r.storeId === 's-amarelinha')?.isHere).toBe(true);
    expect(view.whereRows.find((r) => r.storeId === 's-tenda')?.isHere).toBe(false);
  });

  it('falls back to GPS-nearest when no row matches the preferred chain', () => {
    const rows = [row({ store_id: 's-tenda', store_name: 'Tenda Atacado - Matão', distance_km: 0.2 })];
    const view = buildRespostaView(product(), rows, NOW, 'Amarelinha');
    expect(view.whereRows[0]?.isHere).toBe(true);
  });
});

describe('buildRespostaView — mais de 4 lojas frescas', () => {
  it('does not truncate whereRows itself, and flags whereHasMore for the screen to decide', () => {
    const rows = Array.from({ length: 5 }, (_, i) => row({ store_id: `s${i}`, store_name: `Loja ${i}`, price: 10 + i, distance_km: i }));
    const view = buildRespostaView(product(), rows, NOW);
    expect(view.whereRows).toHaveLength(5);
    expect(view.whereHasMore).toBe(true);
  });

  it('whereHasMore is false at exactly 4', () => {
    const rows = Array.from({ length: 4 }, (_, i) => row({ store_id: `s${i}`, store_name: `Loja ${i}`, price: 10 + i }));
    const view = buildRespostaView(product(), rows, NOW);
    expect(view.whereHasMore).toBe(false);
  });
});

describe('buildRespostaView — sem localização (no "aqui")', () => {
  it('compares the winner to 2nd place when no row carries a distance', () => {
    const rows = [
      row({ store_id: 's-tenda', store_name: 'Tenda', price: 24.9, distance_km: null }),
      row({ store_id: 's-savegnago', store_name: 'Savegnago', price: 27.0, distance_km: null }),
    ];
    const view = buildRespostaView(product(), rows, NOW);
    expect(view.comparison).toEqual({ amount: 2.1, storeName: 'Savegnago', isHere: false });
    expect(view.whereRows.every((r) => !r.isHere)).toBe(true);
  });

  it('has no comparison when only one fresh row exists', () => {
    const view = buildRespostaView(product(), [row({ distance_km: null })], NOW);
    expect(view.comparison).toBeNull();
  });
});
