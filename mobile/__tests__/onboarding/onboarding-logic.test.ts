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
  parseDefaultSize,
  formatSize,
  displayProductName,
  nameVariants,
  isValidEmail,
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

  it('round-trips generic and pinned items and the area', async () => {
    const result = {
      items: [
        {
          ...GENERIC_ITEMS[0],
          product: { id: 'p1', name: 'Arroz Tio João Tipo 1', ean: '7896006711117', imageUrl: null, size: '5 kg' },
        },
        { ...GENERIC_ITEMS[2], product: null },
      ],
      area: 'covered' as const,
    };
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

describe('parseDefaultSize', () => {
  it.each([
    ['5 kg', { value: 5000, unit: 'g' }],
    ['1 kg', { value: 1000, unit: 'g' }],
    ['500 g', { value: 500, unit: 'g' }],
    ['1 L', { value: 1000, unit: 'ml' }],
    ['2 L', { value: 2000, unit: 'ml' }],
    ['900 ml', { value: 900, unit: 'ml' }],
    ['30 un', { value: 30, unit: 'un' }],
  ])('%s is stored as base units', (size, expected) => {
    expect(parseDefaultSize(size)).toEqual(expected);
  });

  it('returns null where products.size_* has no counterpart, so no size is claimed', () => {
    expect(parseDefaultSize('12 rolos')).toBeNull(); // not a unit the size parser knows
    expect(parseDefaultSize('kg')).toBeNull(); // no number
  });

  it('covers every generic item without throwing', () => {
    for (const item of GENERIC_ITEMS) expect(() => parseDefaultSize(item.size)).not.toThrow();
  });
});

describe('formatSize', () => {
  it('turns base units back into what a person reads', () => {
    expect(formatSize(5000, 'g')).toBe('5 kg');
    expect(formatSize(1500, 'g')).toBe('1,5 kg');
    expect(formatSize(500, 'g')).toBe('500 g');
    expect(formatSize(2000, 'ml')).toBe('2 L');
    expect(formatSize(900, 'ml')).toBe('900 ml');
    expect(formatSize(30, 'un')).toBe('30 un');
  });
});

describe('displayProductName', () => {
  it('drops a size the name already carries so the row does not show it twice', () => {
    expect(displayProductName('Arroz Tio João Tipo 1 5kg', '5 kg')).toBe('Arroz Tio João Tipo 1');
    expect(displayProductName('Arroz 5 KG Camil', '5 kg')).toBe('Arroz Camil');
  });

  it('leaves a name without the size untouched', () => {
    expect(displayProductName('Arroz Camil Tipo 1', '5 kg')).toBe('Arroz Camil Tipo 1');
    expect(displayProductName('Arroz Camil', null)).toBe('Arroz Camil');
  });

  it('does not strip a number that only looks like the size', () => {
    expect(displayProductName('Arroz Tipo 15 kg', '5 kg')).toBe('Arroz Tipo 15 kg');
  });

  it('never returns an empty name', () => {
    expect(displayProductName('5 kg', '5 kg')).toBe('5 kg');
  });
});

describe('nameVariants', () => {
  it('matches the accented and the plain spelling', () => {
    expect(nameVariants('Feijão')).toEqual(['Feijão', 'Feijao']);
    expect(nameVariants('Papel higiênico')).toEqual(['Papel higiênico', 'Papel higienico']);
  });

  it('a label without accents yields one variant', () => {
    expect(nameVariants('Arroz')).toEqual(['Arroz']);
  });
});

describe('isValidEmail', () => {
  it.each(['ana@exemplo.com', ' ana@exemplo.com.br '])('accepts "%s"', (email) => {
    expect(isValidEmail(email)).toBe(true);
  });

  it.each(['', 'ana', 'ana@', '@exemplo.com', 'ana@exemplo', 'ana @exemplo.com', 'a@b@c.com'])(
    'rejects "%s"',
    (email) => {
      expect(isValidEmail(email)).toBe(false);
    },
  );

  it('rejects an address over 254 characters', () => {
    expect(isValidEmail(`${'a'.repeat(250)}@x.com`)).toBe(false);
  });
});
