// mobile/__tests__/hooks/resposta.test.ts

import {
  buildRespostaView,
  daysAgo,
  freshnessLabel,
  isStale,
  formatSize,
  normalizeBaseName,
  resolveSizeAlternatives,
  selectSizeFamily,
  classifyProductLoad,
  sizeOptionTappedPayload,
  type ProductInfo,
  type SizeFamilyRow,
  type RawStorePrice,
  type SizeCandidate,
} from '@/lib/resposta';
import { resolveHereStore } from '@/lib/ajustes';
import type { NearbyStore } from '@/hooks/use-stores';

const NOW = new Date('2026-09-23T12:00:00Z');

function product(overrides: Partial<ProductInfo> = {}): ProductInfo {
  return { id: 'p1', name: 'Arroz Tio João tipo 1', brand: 'Tio João', ean: '7891234567890', imageUrl: null, sizeValue: 5000, sizeUnit: 'g', ...overrides };
}

// store_name must be a real chain-matchable name (lib/chains.ts prefix-
// matches against Savegnago/Jaú Serve/Tenda/Amarelinha) — ONDE groups by
// chain now, so an unmatched name is silently dropped, same as production.
function row(overrides: Partial<RawStorePrice> = {}): RawStorePrice {
  return {
    store_id: 's1',
    store_name: 'Tenda Atacado - Matão',
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

describe('buildRespostaView — ONDE agrupa por rede, não por filial (Lucas, 2026-09-23)', () => {
  // The bug this whole redesign fixes: Morango Bandeja 250G had 5 Amarelinha
  // branches, all R$16,99 — a branch-level ONDE showed 4 of them as if they
  // were 4 different markets, and the nearest-but-not-winning branch made
  // the subphrase print a fake "R$ 0,00 a menos".
  it('collapses several branches of the same chain into one ONDE row, price = cheapest, distance = nearest AT that price', () => {
    const rows = [
      row({ store_id: 's-loja21', store_name: 'Amarelinha Loja 21 Flamboyant', price: 16.99, distance_km: 2.1 }),
      row({ store_id: 's-loja17', store_name: 'Amarelinha Loja 17', price: 16.99, distance_km: 0.3 }), // nearest at the winning price
      row({ store_id: 's-loja18', store_name: 'Amarelinha Loja 18', price: 18.5, distance_km: 0.1 }), // nearer, but NOT at the winning price — ignored for distance
    ];
    const view = buildRespostaView(product({ ean: null }), rows, NOW);

    expect(view.whereRows).toHaveLength(1);
    expect(view.whereRows[0]).toMatchObject({ chainLabel: 'Amarelinha', price: 16.99, distanceKm: 0.3 });
  });

  it('"aqui" resolves to the nearest branch\'s CHAIN, even across chains', () => {
    const rows = [
      row({ store_id: 's-tenda', store_name: 'Tenda Atacado - Matão', price: 24.9, distance_km: 1.8 }),
      row({ store_id: 's-savegnago', store_name: 'Savegnago', price: 27.0, distance_km: 0.4 }), // nearest overall
    ];
    const view = buildRespostaView(product(), rows, NOW, 'Savegnago');
    expect(view.whereRows.find((r) => r.chainLabel === 'Savegnago')?.isHere).toBe(true);
    expect(view.whereRows.find((r) => r.chainLabel === 'Tenda')?.isHere).toBe(false);
  });

  it('never compares a tied price between two chains — that reads as a fake "R$ 0,00 a menos"', () => {
    const rows = [
      row({ store_id: 's-tenda', store_name: 'Tenda Atacado - Matão', price: 16.99, distance_km: 2.1 }),
      row({ store_id: 's-savegnago', store_name: 'Savegnago', price: 16.99, distance_km: 0.3 }), // "aqui", tied with the winner
    ];
    const view = buildRespostaView(product(), rows, NOW);
    expect(view.comparison).toBeNull();
  });

  it('skips a tied "aqui" chain and compares against the first genuinely different price', () => {
    const rows = [
      row({ store_id: 's-tenda', store_name: 'Tenda Atacado - Matão', price: 16.99, distance_km: 2.1 }), // winner
      row({ store_id: 's-savegnago', store_name: 'Savegnago', price: 16.99, distance_km: 0.3 }), // "aqui", tied — skipped
      row({ store_id: 's-jau', store_name: 'Jaú Serve', price: 18.5, distance_km: 3.0 }), // genuinely different
    ];
    const view = buildRespostaView(product(), rows, NOW);
    expect(view.comparison).toEqual({ amount: 1.51, storeName: 'Jaú Serve', isHere: false });
  });

  it('branchRows carries every physical location unfiltered, for "ver todos os mercados"', () => {
    const rows = [
      row({ store_id: 's-loja21', store_name: 'Amarelinha Loja 21 Flamboyant', price: 16.99, distance_km: 2.1 }),
      row({ store_id: 's-loja17', store_name: 'Amarelinha Loja 17', price: 16.99, distance_km: 0.3 }),
    ];
    const view = buildRespostaView(product(), rows, NOW);
    expect(view.whereRows).toHaveLength(1); // grouped
    expect(view.branchRows).toHaveLength(2); // ungrouped
    expect(view.branchRows.map((b) => b.storeName)).toEqual(['Amarelinha Loja 21 Flamboyant', 'Amarelinha Loja 17']);
    expect(view.branchRows.every((b) => b.chainLabel === 'Amarelinha')).toBe(true);
  });
});

describe('buildRespostaView — 3a: com EAN, "aqui" não vence', () => {
  it('titles by the winning chain, compares winner to the here-chain, marks isHere/isWinner separately', () => {
    const rows = [
      row({ store_id: 's-tenda', store_name: 'Tenda Atacado - Matão', price: 24.9, distance_km: 1.8 }),
      row({ store_id: 's-savegnago', store_name: 'Savegnago', price: 27.0, distance_km: 0.6 }),
      row({ store_id: 's-jau', store_name: 'Jaú Serve', price: 27.49, distance_km: 2.4 }),
    ];
    const view = buildRespostaView(product(), rows, NOW, 'Savegnago');

    expect(view.mode).toBe('comparison');
    expect(view.title).toBe('Menor preço no Tenda');
    expect(view.price).toBe(24.9);
    expect(view.comparison).toEqual({ amount: 2.1, storeName: 'Savegnago', isHere: true });
    expect(view.whereRows.find((r) => r.chainLabel === 'Tenda')?.isWinner).toBe(true);
    expect(view.whereRows.find((r) => r.chainLabel === 'Savegnago')?.isHere).toBe(true);
    expect(view.whereRows.find((r) => r.chainLabel === 'Savegnago')?.isWinner).toBe(false);
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

describe('buildRespostaView — 3b: "aqui" vence, rede defasada', () => {
  it('compares the winner to 2nd place (not itself) when "aqui" is the winner, and pulls a fully-stale chain into staleStores', () => {
    const rows = [
      row({ store_id: 's-savegnago', store_name: 'Savegnago', price: 4.79, distance_km: 0.6 }),
      row({ store_id: 's-tenda', store_name: 'Tenda Atacado - Matão', price: 5.19, distance_km: 1.8 }),
      row({ store_id: 's-jau', store_name: 'Jaú Serve', price: 5.29, distance_km: 2.4 }),
      row({ store_id: 's-amarelinha', store_name: 'Amarelinha Loja 15', price: 4.5, distance_km: 3.1, last_price_date: '2026-09-18T10:00:00Z' }), // 5 days stale, cheaper than the winner but excluded from ranking
    ];
    const view = buildRespostaView(product({ sizeValue: 1000, sizeUnit: 'ml' }), rows, NOW);

    expect(view.title).toBe('Menor preço no Savegnago');
    expect(view.comparison).toEqual({ amount: 0.4, storeName: 'Tenda', isHere: false });
    expect(view.whereRows.some((r) => r.chainLabel === 'Amarelinha')).toBe(false);
    expect(view.staleStores).toEqual([{ storeName: 'Amarelinha', daysAgo: 5 }]);
    expect(view.freshCount).toBe(3);
    expect(view.footerNote).toBe('preços de hoje, 03:00 · 3 de 4 mercados');
  });

  it('a chain with one fresh AND one stale branch keeps its ONDE row — only a fully-stale chain goes to the amber band', () => {
    const rows = [
      row({ store_id: 's-loja21', store_name: 'Amarelinha Loja 21 Flamboyant', price: 16.99, distance_km: 2.1 }), // fresh
      row({ store_id: 's-loja17', store_name: 'Amarelinha Loja 17', price: 15.0, distance_km: 0.3, last_price_date: '2026-09-18T10:00:00Z' }), // stale, would be cheaper
      row({ store_id: 's-tenda', store_name: 'Tenda Atacado - Matão', price: 20.0, distance_km: 1.0 }),
    ];
    const view = buildRespostaView(product({ ean: null }), rows, NOW);
    expect(view.whereRows.find((r) => r.chainLabel === 'Amarelinha')).toMatchObject({ price: 16.99 }); // only the fresh branch counts
    expect(view.staleStores).toEqual([]); // Amarelinha still has a fresh branch, not fully stale
  });
});

describe('buildRespostaView — 3c: sem EAN, fato de um mercado só', () => {
  it('never compares, titles as a fact, shows a single un-badged chain row', () => {
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
  it('keeps stale chains out of ONDE when nothing fresh exists (even with EAN); they live behind "ver todos os mercados"', () => {
    const rows = [
      row({ store_id: 's-tenda', store_name: 'Tenda Atacado - Matão', price: 8.49, distance_km: 1.8, last_price_date: '2026-09-17T10:00:00Z' }), // 6 days
      row({ store_id: 's-savegnago', store_name: 'Savegnago', price: 8.99, distance_km: 0.6, last_price_date: '2026-09-14T10:00:00Z' }), // 9 days
    ];
    const view = buildRespostaView(product(), rows, NOW);

    expect(view.mode).toBe('no-price');
    expect(view.title).toBe('Sem preço hoje');
    expect(view.price).toBeNull();
    // Doc decisão 2 + "Resposta": >3 dias sai do ONDE; só "ver todos os mercados"
    // mostra. Nada defasado pode aparecer como linha do ONDE.
    expect(view.whereRows).toEqual([]);
    expect(view.whereHasMore).toBe(true);
    expect(view.branchRows).toHaveLength(2);
    expect(view.branchRows.every((b) => b.isStale)).toBe(true);
    expect(view.footerNote).toBe('últimos preços vistos · 2 de 4 mercados');
  });

  it('lists every stale branch (unfiltered) behind "ver todos os mercados", none in the default ONDE', () => {
    const staleRows = [
      row({ store_id: 's-loja21', store_name: 'Amarelinha Loja 21 Flamboyant', price: 20.0, last_price_date: '2026-09-17T10:00:00Z' }), // 6 days
      row({ store_id: 's-loja17', store_name: 'Amarelinha Loja 17', price: 25.0, last_price_date: '2026-09-19T10:00:00Z' }), // 4 days
    ];
    const view = buildRespostaView(product(), staleRows, NOW);
    expect(view.whereRows).toEqual([]);
    expect(view.whereHasMore).toBe(true);
    expect(view.branchRows.map((b) => b.storeId).sort()).toEqual(['s-loja17', 's-loja21']);
  });

  it('renders an empty ONDE, not an error, when there are zero rows at all', () => {
    const view = buildRespostaView(product(), [], NOW);
    expect(view.mode).toBe('no-price');
    expect(view.whereRows).toEqual([]);
    expect(view.whereHasMore).toBe(false); // nothing to expand
    expect(view.footerNote).toBe('últimos preços vistos · 0 de 4 mercados');
  });
});

describe('buildRespostaView — hereChain resolvida (folha "trocar")', () => {
  it('marks the resolved chain, not the GPS-nearest priced row', () => {
    const rows = [
      row({ store_id: 's-tenda', store_name: 'Tenda Atacado - Matão', price: 24.9, distance_km: 0.2 }), // GPS-nearest, but not preferred
      row({ store_id: 's-amarelinha', store_name: 'Amarelinha Loja 21 Flamboyant', price: 27.0, distance_km: 3.1 }),
    ];
    const view = buildRespostaView(product(), rows, NOW, 'Amarelinha');
    expect(view.whereRows.find((r) => r.chainLabel === 'Amarelinha')?.isHere).toBe(true);
    expect(view.whereRows.find((r) => r.chainLabel === 'Tenda')?.isHere).toBe(false);
  });

  it('marks nothing when the resolved chain has no row — never substitutes a priced chain', () => {
    const rows = [row({ store_id: 's-tenda', store_name: 'Tenda Atacado - Matão', distance_km: 0.2 })];
    const view = buildRespostaView(product(), rows, NOW, 'Amarelinha');
    expect(view.whereRows.some((r) => r.isHere)).toBe(false);
  });
});

describe('buildRespostaView — mais de 4 linhas frescas não é mais possível (só 4 redes existem)', () => {
  it('whereHasMore stays false with all 4 chains fresh — nothing to route to "ver todos"', () => {
    const rows = [
      row({ store_id: 's1', store_name: 'Tenda Atacado - Matão', price: 10, distance_km: 1 }),
      row({ store_id: 's2', store_name: 'Savegnago', price: 11, distance_km: 2 }),
      row({ store_id: 's3', store_name: 'Jaú Serve', price: 12, distance_km: 3 }),
      row({ store_id: 's4', store_name: 'Amarelinha Loja 15', price: 13, distance_km: 4 }),
    ];
    const view = buildRespostaView(product(), rows, NOW);
    expect(view.whereRows).toHaveLength(4);
    expect(view.whereHasMore).toBe(false);
  });

  it('whereHasMore is true when a chain is fully stale (excluded to the amber band)', () => {
    const rows = [
      row({ store_id: 's1', store_name: 'Tenda Atacado - Matão', price: 10, distance_km: 1 }),
      row({ store_id: 's2', store_name: 'Savegnago', price: 11, distance_km: 2, last_price_date: '2026-09-17T10:00:00Z' }), // stale
    ];
    const view = buildRespostaView(product(), rows, NOW);
    expect(view.whereHasMore).toBe(true);
  });
});

describe('buildRespostaView — sem localização (no "aqui")', () => {
  it('compares the winner to 2nd place when no row carries a distance', () => {
    const rows = [
      row({ store_id: 's-tenda', store_name: 'Tenda Atacado - Matão', price: 24.9, distance_km: null }),
      row({ store_id: 's-savegnago', store_name: 'Savegnago', price: 27.0, distance_km: null }),
    ];
    const view = buildRespostaView(product(), rows, NOW);
    expect(view.comparison).toEqual({ amount: 2.1, storeName: 'Savegnago', isHere: false });
    expect(view.whereRows.every((r) => !r.isHere)).toBe(true);
  });

  it('has no comparison when only one fresh chain exists', () => {
    const view = buildRespostaView(product(), [row({ distance_km: null })], NOW);
    expect(view.comparison).toBeNull();
  });
});

describe('formatSize', () => {
  it('converts grams to kg above 1000, trimming a whole-number decimal', () => {
    expect(formatSize(5000, 'g')).toBe('5 kg');
  });

  it('keeps one decimal (comma) for a non-whole kg conversion', () => {
    expect(formatSize(1500, 'g')).toBe('1,5 kg');
  });

  it('leaves sub-1000g values in grams', () => {
    expect(formatSize(900, 'g')).toBe('900 g');
  });

  it('converts ml to L above 1000', () => {
    expect(formatSize(1000, 'ml')).toBe('1 L');
  });

  it('passes through un/m unconverted', () => {
    expect(formatSize(12, 'un')).toBe('12 un');
  });
});

describe('normalizeBaseName — QUAL TAMANHO family match', () => {
  it('strips a spaced size token and normalizes case/accents', () => {
    expect(normalizeBaseName('Arroz Tio João Tipo 1 5 kg')).toBe('arroz tio joao tipo 1');
  });

  it('strips a glued size token (no space before the unit)', () => {
    expect(normalizeBaseName('Óleo de Soja Liza 900ml')).toBe('oleo de soja liza');
  });

  it('strips a glued liter token', () => {
    expect(normalizeBaseName('Leite Italac Integral 1l')).toBe('leite italac integral');
  });

  it('two sizes of the same product normalize to the same base name', () => {
    expect(normalizeBaseName('Arroz Tio João Tipo 1 · 5 kg')).toBe(normalizeBaseName('Arroz Tio João Tipo 1 · 2kg'));
  });

  it('does not accidentally strip a real word starting with a unit letter', () => {
    // "Leite" starts with 'l' but isn't preceded by a digit — must survive.
    expect(normalizeBaseName('Leite Condensado')).toBe('leite condensado');
  });
});

describe('resolveSizeAlternatives — QUAL TAMANHO', () => {
  const current5kg = product({ name: 'Arroz Tio João tipo 1', sizeValue: 5000, sizeUnit: 'g' });
  const currentPerUnit = 4.98; // R$24.90 / 5kg

  function candidate(overrides: Partial<SizeCandidate> = {}): SizeCandidate {
    return { id: 'c1', name: 'Arroz Tio João tipo 1', sizeValue: 2000, cheapestPriceToday: 9.49, cheapestStoreName: 'Tenda Atacado - Matão', ...overrides };
  }

  it('lists a candidate whose price/unit beats the current size, storeName shown as the chain', () => {
    const result = resolveSizeAlternatives(current5kg, currentPerUnit, [candidate()]); // 9.49/2kg = 4.745/kg < 4.98
    expect(result).toEqual({
      kind: 'alternatives',
      items: [{ productId: 'c1', name: 'Arroz Tio João tipo 1 · 2 kg', sizeLabel: '2 kg', pricePerUnitLabel: expect.stringContaining('4,75'), storeName: 'Tenda' }],
    });
  });

  it('falls back to the raw branch name if it somehow matches no known chain', () => {
    const result = resolveSizeAlternatives(current5kg, currentPerUnit, [candidate({ cheapestStoreName: 'Mercadinho Desconhecido' })]);
    expect(result.kind === 'alternatives' && result.items[0]?.storeName).toBe('Mercadinho Desconhecido');
  });

  it('caps at 3 alternatives, sorted ascending by price/unit', () => {
    const candidates = [
      candidate({ id: 'a', sizeValue: 1000, cheapestPriceToday: 4.5 }), // 4.50/kg
      candidate({ id: 'b', sizeValue: 1000, cheapestPriceToday: 4.0 }), // 4.00/kg
      candidate({ id: 'c', sizeValue: 1000, cheapestPriceToday: 4.9 }), // 4.90/kg
      candidate({ id: 'd', sizeValue: 1000, cheapestPriceToday: 4.2 }), // 4.20/kg
    ];
    const result = resolveSizeAlternatives(current5kg, currentPerUnit, candidates);
    expect(result.kind).toBe('alternatives');
    expect(result.kind === 'alternatives' && result.items.map((i) => i.productId)).toEqual(['b', 'd', 'a']);
  });

  it('returns current-best with the exact mockup phrasing when nothing beats it', () => {
    const result = resolveSizeAlternatives(current5kg, currentPerUnit, [candidate({ cheapestPriceToday: 30 })]); // way more expensive per kg
    expect(result).toEqual({ kind: 'current-best', label: '5 kg é o melhor por kg' });
  });

  it('is "none" (bloco some) when no candidate has a price today', () => {
    expect(resolveSizeAlternatives(current5kg, currentPerUnit, [candidate({ cheapestPriceToday: null })])).toEqual({ kind: 'none' });
  });

  it('is "none" when there are no candidates at all (family of one)', () => {
    expect(resolveSizeAlternatives(current5kg, currentPerUnit, [])).toEqual({ kind: 'none' });
  });

  it('is "none" when the current product has no parsed size', () => {
    const noSize = product({ sizeValue: null, sizeUnit: null });
    expect(resolveSizeAlternatives(noSize, currentPerUnit, [candidate()])).toEqual({ kind: 'none' });
  });

  it('formats the "melhor por" phrase for liters', () => {
    const current1L = product({ sizeValue: 1000, sizeUnit: 'ml' });
    const result = resolveSizeAlternatives(current1L, 4.79, [candidate({ cheapestPriceToday: 100 })]);
    expect(result).toEqual({ kind: 'current-best', label: '1 L é o melhor por litro' });
  });
});

describe('resolveSizeAlternatives — linha duplicada e tamanho repetido no nome', () => {
  const current5kg = product({ name: 'Arroz Tio João tipo 1', sizeValue: 5000, sizeUnit: 'g' });
  const cand = (overrides: Partial<SizeCandidate> = {}): SizeCandidate => ({
    id: 'c1', name: 'Arroz Tio João tipo 1', sizeValue: 2000, cheapestPriceToday: 9.0, cheapestStoreName: 'Tenda Atacado - Matão', ...overrides,
  });

  it('collapses duplicate catalog products of the same size into ONE row (keeps the cheapest per unit)', () => {
    const result = resolveSizeAlternatives(current5kg, 4.98, [
      cand({ id: 'dup-a', cheapestPriceToday: 9.49 }),
      cand({ id: 'dup-b', cheapestPriceToday: 9.0 }),
    ]);
    expect(result.kind === 'alternatives' && result.items.map((i) => i.productId)).toEqual(['dup-b']);
  });

  it('does not offer a duplicate of the CURRENT size as an "other size"', () => {
    const result = resolveSizeAlternatives(current5kg, 4.98, [cand({ id: 'twin', sizeValue: 5000, cheapestPriceToday: 20 })]);
    expect(result).toEqual({ kind: 'current-best', label: '5 kg é o melhor por kg' });
  });

  it('does not repeat the size when the product name already carries it', () => {
    const result = resolveSizeAlternatives(current5kg, 4.98, [cand({ name: 'Arroz Tio João tipo 1 2kg' })]);
    expect(result.kind === 'alternatives' && result.items[0]?.name).toBe('Arroz Tio João tipo 1 2kg');
  });
});

describe('resolveSizeAlternatives — um ou vários, empate, outras unidades', () => {
  const current5kg = product({ name: 'Arroz Tio João tipo 1', sizeValue: 5000, sizeUnit: 'g' });
  const cand = (overrides: Partial<SizeCandidate> = {}): SizeCandidate => ({
    id: 'c1', name: 'Arroz Tio João tipo 1', sizeValue: 1000, cheapestPriceToday: 4, cheapestStoreName: 'Tenda Atacado - Matão', ...overrides,
  });

  it('a single better alternative yields exactly one item', () => {
    const r = resolveSizeAlternatives(current5kg, 4.98, [cand()]);
    expect(r.kind === 'alternatives' && r.items).toHaveLength(1);
  });

  it('a candidate with the SAME price per unit does not count as better', () => {
    expect(resolveSizeAlternatives(current5kg, 4.98, [cand({ cheapestPriceToday: 4.98 })])).toEqual({ kind: 'current-best', label: '5 kg é o melhor por kg' });
  });

  it('only the candidates that beat the current one are listed; worse ones are dropped', () => {
    const r = resolveSizeAlternatives(current5kg, 4.98, [cand({ id: 'good', cheapestPriceToday: 4 }), cand({ id: 'bad', cheapestPriceToday: 6 })]);
    expect(r.kind === 'alternatives' && r.items.map((i) => i.productId)).toEqual(['good']);
  });

  it('un: per-unit is price per piece and the phrase says "por unidade"', () => {
    const current12 = product({ name: 'Ovos Branco', sizeValue: 12, sizeUnit: 'un' });
    const better = resolveSizeAlternatives(current12, 1, [cand({ sizeValue: 30, cheapestPriceToday: 24 })]); // 0,80/un
    expect(better.kind === 'alternatives' && better.items[0]?.pricePerUnitLabel).toMatch(/0,80\/un/);
    expect(resolveSizeAlternatives(current12, 1, [cand({ sizeValue: 30, cheapestPriceToday: 45 })])).toEqual({ kind: 'current-best', label: '12 un é o melhor por unidade' });
  });

  it('a pack under 1 kg keeps grams in the name but compares per kg', () => {
    const current500 = product({ sizeValue: 500, sizeUnit: 'g' });
    const r = resolveSizeAlternatives(current500, 10, [cand({ sizeValue: 1000, cheapestPriceToday: 8 })]);
    expect(r.kind === 'alternatives' && r.items[0]?.name).toBe('Arroz Tio João tipo 1 · 1 kg');
    expect(resolveSizeAlternatives(current500, 10, [cand({ sizeValue: 1000, cheapestPriceToday: 20 })])).toEqual({ kind: 'current-best', label: '500 g é o melhor por kg' });
  });
});

describe('selectSizeFamily — o que conta como "tamanho alternativo"', () => {
  const current = product({ id: 'cur', name: 'Arroz Tio João tipo 1 5kg', brand: 'Tio João', sizeValue: 5000, sizeUnit: 'g' });
  const fam = (overrides: Partial<SizeFamilyRow> = {}): SizeFamilyRow => ({
    id: 'x', name: 'Arroz Tio João tipo 1 1kg', brand: 'Tio João', size_value: 1000, size_unit: 'g', ...overrides,
  });

  it('keeps same brand + same unit + same base name', () => {
    expect(selectSizeFamily(current, [fam()]).map((r) => r.id)).toEqual(['x']);
  });

  it('never includes the product itself', () => {
    expect(selectSizeFamily(current, [fam({ id: 'cur' })])).toEqual([]);
  });

  it('drops a different unit (g vs un vs ml): price per unit would not be comparable', () => {
    expect(selectSizeFamily(current, [fam({ size_unit: 'un' }), fam({ size_unit: 'ml' })])).toEqual([]);
  });

  it('drops a row without a parsed size (or a zero size)', () => {
    expect(selectSizeFamily(current, [fam({ size_value: null }), fam({ size_value: 0 })])).toEqual([]);
  });

  it('drops a different brand and a different base name (no cross-product guessing)', () => {
    expect(selectSizeFamily(current, [fam({ brand: 'Camil' }), fam({ brand: null }), fam({ name: 'Arroz Tio João tipo 2 1kg' })])).toEqual([]);
  });

  it('is empty when the current product has no brand or no size unit', () => {
    expect(selectSizeFamily(product({ brand: null }), [fam()])).toEqual([]);
    expect(selectSizeFamily(product({ sizeValue: null, sizeUnit: null }), [fam()])).toEqual([]);
  });
});

// Ajustes and Resposta must agree on the one "aqui" chain: the nearest branch
// among ALL active stores (useStores), not among the chains that happen to have
// a price row for this product. Resposta used to derive it from `rows` and
// marked Jaú Serve (1,2 km) as "você está aqui" while Ajustes said Amarelinha
// (0,4 km) — it asserted "aqui" for a chain that is not the closest.
describe('buildRespostaView — "aqui" é a mesma rede de Ajustes (universo = todas as lojas ativas)', () => {
  function nearby(chainLabel: string, distanceKm: number | null): NearbyStore {
    return { storeId: `n-${chainLabel}`, chainLabel, storeName: chainLabel, distanceKm };
  }
  const stores = [nearby('Amarelinha', 0.4), nearby('Jaú Serve', 1.2), nearby('Tenda', 1.8), nearby('Savegnago', 2.4)];
  // Product has no Amarelinha row at all.
  const rowsWithoutAmarelinha = [
    row({ store_id: 's-jau', store_name: 'Jaú Serve', price: 25.0, distance_km: 1.2 }),
    row({ store_id: 's-tenda', store_name: 'Tenda Atacado - Matão', price: 24.9, distance_km: 1.8 }),
    row({ store_id: 's-sav', store_name: 'Savegnago', price: 27.0, distance_km: 2.4 }),
  ];
  const hereFromStores = (preferred: string | null) => resolveHereStore(stores, preferred)?.chainLabel ?? null;

  it('does not mark Jaú Serve as "aqui" when the nearest chain (Amarelinha) has no price row; no "aqui" row in ONDE', () => {
    const here = hereFromStores(null);
    expect(here).toBe('Amarelinha');
    const view = buildRespostaView(product(), rowsWithoutAmarelinha, NOW, here);
    expect(view.whereRows.some((r) => r.isHere)).toBe(false);
    expect(view.whereRows.find((r) => r.chainLabel === 'Jaú Serve')?.isHere).toBe(false);
    // "sem aqui": compares the winner (Tenda) with the next chain, not flagged as "onde você está"
    expect(view.comparison).toMatchObject({ storeName: 'Jaú Serve', isHere: false });
  });

  it.each([null, 'Savegnago'])('parity with resolveHereStore (preferredChain=%s)', (preferred) => {
    const here = hereFromStores(preferred);
    const view = buildRespostaView(product(), rowsWithoutAmarelinha, NOW, here);
    const marked = view.whereRows.filter((r) => r.isHere).map((r) => r.chainLabel);
    // marked chain is the resolved one when it has a row, otherwise nothing
    const expected = rowsWithoutAmarelinha.some((r) => r.store_name.startsWith(here ?? '\0')) ? [here] : [];
    expect(marked).toEqual(expected);
    expect(here).toBe(preferred ?? 'Amarelinha');
  });

  it('control: when the nearest chain HAS a price row it is still "aqui"', () => {
    const rows = [...rowsWithoutAmarelinha, row({ store_id: 's-amar', store_name: 'Amarelinha Loja 17', price: 26.0, distance_km: 0.4 })];
    const view = buildRespostaView(product(), rows, NOW, hereFromStores(null));
    expect(view.whereRows.find((r) => r.chainLabel === 'Amarelinha')?.isHere).toBe(true);
    expect(view.whereRows.filter((r) => r.isHere)).toHaveLength(1);
  });

  it('keeps the per-chain distance from the priced rows (nearest branch WITH a price)', () => {
    const view = buildRespostaView(product(), rowsWithoutAmarelinha, NOW, hereFromStores(null));
    expect(view.whereRows.find((r) => r.chainLabel === 'Jaú Serve')?.distanceKm).toBe(1.2);
  });
});

describe('classifyProductLoad', () => {
  const row = { id: 'p1' };
  const netErr = { message: 'Network request failed' };

  it('is ok when the product row and the prices both came back', () => {
    expect(classifyProductLoad({ productData: row, productError: null, pricesError: null })).toBe('ok');
  });

  it('is not-found when the id does not exist (PGRST116 from a single-row read)', () => {
    expect(classifyProductLoad({ productData: null, productError: { code: 'PGRST116' }, pricesError: null })).toBe('not-found');
  });

  it('is not-found when the id is a malformed uuid (22P02) on the product read or on the RPC', () => {
    expect(classifyProductLoad({ productData: null, productError: { code: '22P02' }, pricesError: null })).toBe('not-found');
    expect(classifyProductLoad({ productData: row, productError: null, pricesError: { code: '22P02' } })).toBe('not-found');
  });

  it('is not-found when the read succeeds but returns no row (maybeSingle)', () => {
    expect(classifyProductLoad({ productData: null, productError: null, pricesError: null })).toBe('not-found');
  });

  it('keeps a network failure as error, with or without a code', () => {
    expect(classifyProductLoad({ productData: null, productError: netErr, pricesError: null })).toBe('error');
    expect(classifyProductLoad({ productData: row, productError: null, pricesError: { code: '57014', message: 'timeout' } })).toBe('error');
  });

  it('a network failure on one read wins over not-found on the other', () => {
    expect(classifyProductLoad({ productData: null, productError: { code: 'PGRST116' }, pricesError: netErr })).toBe('error');
  });
});

describe('sizeOptionTappedPayload', () => {
  it('opens the tapped size (productId) and carries origin and both sizes in metadata', () => {
    const current = product({ id: 'cur', sizeValue: 5000, sizeUnit: 'g' });
    const item = { productId: 'alt', name: 'Arroz · 2 kg', sizeLabel: '2 kg', pricePerUnitLabel: 'R$ 4,75/kg', storeName: 'Tenda' };
    expect(sizeOptionTappedPayload(current, item)).toEqual({ productId: 'alt', metadata: { from_product_id: 'cur', from_size: '5 kg', to_size: '2 kg' } });
  });
});
