jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  GENERIC_ITEMS,
  FALLBACK_COVERED_CITIES,
  normalizeCity,
  isCovered,
  filterCities,
  ctaLabel,
  saveOnboarding,
  loadOnboarding,
  type CoveredCity,
} from '../../lib/onboarding';

const covered: CoveredCity[] = [{ city: 'Matão', state: 'SP' }];

describe('normalizeCity', () => {
  it('drops accents, case and surrounding whitespace', () => {
    expect(normalizeCity(' MATÃO ')).toBe('matao');
    expect(normalizeCity('São Carlos')).toBe('sao carlos');
  });
});

describe('isCovered', () => {
  it.each(['Matão', 'Matao', 'MATÃO', ' matão '])('treats "%s" as covered', (name) => {
    expect(isCovered(name, covered)).toBe(true);
  });

  it('treats another city as not covered', () => {
    expect(isCovered('Araraquara', covered)).toBe(false);
  });

  it('is not fooled by a covered name inside another city', () => {
    expect(isCovered('Matão do Sul', covered)).toBe(false);
  });

  it('the fallback list covers Matão, so a failed cities fetch cannot make it "uncovered"', () => {
    expect(isCovered('Matão', FALLBACK_COVERED_CITIES)).toBe(true);
  });
});

describe('filterCities', () => {
  it('lists every covered city for an empty query', () => {
    expect(filterCities('', covered)).toEqual(covered);
    expect(filterCities('   ', covered)).toEqual(covered);
  });

  it('matches a prefix or fragment, ignoring accents and case', () => {
    expect(filterCities('mat', covered)).toEqual(covered);
    expect(filterCities('TAO', covered)).toEqual(covered);
  });

  it('returns nothing when no covered city matches', () => {
    expect(filterCities('Arara', covered)).toEqual([]);
  });
});

describe('ctaLabel', () => {
  it('never disables: zero items is still a full label', () => {
    expect(ctaLabel(0)).toBe('Ver preços de hoje ›');
  });

  it('singular for one item, plural otherwise', () => {
    expect(ctaLabel(1)).toBe('Ver preços de hoje · 1 item ›');
    expect(ctaLabel(2)).toBe('Ver preços de hoje · 2 itens ›');
    expect(ctaLabel(12)).toBe('Ver preços de hoje · 12 itens ›');
  });
});

describe('GENERIC_ITEMS', () => {
  it('has the 12 fixed chips, each with a size and no duplicate label', () => {
    expect(GENERIC_ITEMS).toHaveLength(12);
    expect(new Set(GENERIC_ITEMS.map((i) => i.label)).size).toBe(12);
    expect(GENERIC_ITEMS.every((i) => i.size.length > 0)).toBe(true);
  });
});

describe('saveOnboarding / loadOnboarding', () => {
  beforeEach(() => AsyncStorage.clear());

  it('round-trips the chosen items and area', async () => {
    const result = { items: [GENERIC_ITEMS[0], GENERIC_ITEMS[2]], area: 'covered' as const };
    await saveOnboarding(result);
    expect(await loadOnboarding()).toEqual(result);
  });

  it('returns null when nothing was saved', async () => {
    expect(await loadOnboarding()).toBeNull();
  });

  it('returns null for corrupt stored JSON instead of throwing', async () => {
    await AsyncStorage.setItem('poup:onboarding', '{not json');
    expect(await loadOnboarding()).toBeNull();
  });
});
