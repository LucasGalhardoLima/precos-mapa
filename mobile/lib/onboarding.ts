import AsyncStorage from '@react-native-async-storage/async-storage';

// The 12 fixed generic items of onboarding step 2 (artifact 7b). A generic
// item is a category plus its default size ("arroz · 5 kg"); the label is
// what the chip shows, the size is what the selected row shows.
export interface GenericItem {
  label: string;
  size: string;
}

export const GENERIC_ITEMS: readonly GenericItem[] = [
  { label: 'Arroz', size: '5 kg' },
  { label: 'Feijão', size: '1 kg' },
  { label: 'Leite', size: '1 L' },
  { label: 'Óleo', size: '900 ml' },
  { label: 'Açúcar', size: '1 kg' },
  { label: 'Café', size: '500 g' },
  { label: 'Ovos', size: '30 un' },
  { label: 'Frango', size: 'kg' },
  { label: 'Papel higiênico', size: '12 rolos' },
  { label: 'Sabão em pó', size: '1 kg' },
  { label: 'Detergente', size: '500 ml' },
  { label: 'Refrigerante', size: '2 L' },
];

export interface CoveredCity {
  city: string;
  state: string;
}

// shortcut: hardcoded Matão fallback for when use-cities returns nothing
// (offline or a failed request). Without it a covered city would read as
// uncovered and the app would say "Ainda não estamos em Matão" because OUR
// fetch failed. Upgrade: an offline state for onboarding once one is designed.
export const FALLBACK_COVERED_CITIES: readonly CoveredCity[] = [{ city: 'Matão', state: 'SP' }];

// Geocoders and our own stores table disagree on accents and case ("Matão",
// "Matao", "MATÃO"), so every city comparison goes through this.
export function normalizeCity(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase();
}

// City name only, not state: the state a geocoder returns is unreliable
// (`region` is a full name on Android, and use-location truncates it to 2
// letters), while the covered cities are all distinct names.
export function isCovered(city: string, covered: readonly CoveredCity[]): boolean {
  const target = normalizeCity(city);
  return covered.some((c) => normalizeCity(c.city) === target);
}

// Empty query lists every covered city, so the typing state offers a tap
// before the user types anything.
export function filterCities(query: string, covered: readonly CoveredCity[]): CoveredCity[] {
  const q = normalizeCity(query);
  return covered.filter((c) => normalizeCity(c.city).includes(q));
}

// The step-2 button never disables: with nothing picked it still goes to the
// day-zero root.
export function ctaLabel(count: number): string {
  if (count === 0) return 'Ver preços de hoje ›';
  return `Ver preços de hoje · ${count} ${count === 1 ? 'item' : 'itens'} ›`;
}

// A generic item becomes an item-product (EAN) once the user picks a type in
// the sheet; `size` is the product's own size as shown, null when the catalog
// has none.
export interface PinnedProduct {
  id: string;
  name: string;
  ean: string;
  imageUrl: string | null;
  size: string | null;
}

// One chosen item: the generic category, plus the product it was pinned to
// (null while it is still generic).
export interface OnboardingItem extends GenericItem {
  product: PinnedProduct | null;
}

export type SizeUnit = 'g' | 'ml' | 'un';

export interface SizeFilter {
  value: number;
  unit: SizeUnit;
}

// products.size_value/size_unit are normalized to base units (kg→g, L→ml, see
// migration 074), so a default size like "5 kg" is looked up as 5000 g.
// Returns null when the default size has no counterpart there — "12 rolos" is
// not a unit the size parser knows, and "kg" alone has no number — so the
// sheet must not claim a size it did not filter on.
export function parseDefaultSize(size: string): SizeFilter | null {
  const match = size.trim().toLowerCase().match(/^(\d+(?:[.,]\d+)?)\s*(kg|g|l|ml|un)$/);
  if (!match) return null;
  const n = Number(match[1].replace(',', '.'));
  switch (match[2]) {
    case 'kg':
      return { value: n * 1000, unit: 'g' };
    case 'l':
      return { value: n * 1000, unit: 'ml' };
    case 'g':
    case 'ml':
    case 'un':
      return { value: n, unit: match[2] };
    default:
      return null;
  }
}

const pt = (n: number) => String(n).replace('.', ',');

// Inverse of the normalization above, for display: 5000 g → "5 kg".
export function formatSize(value: number, unit: string): string {
  if (unit === 'g') return value >= 1000 ? `${pt(value / 1000)} kg` : `${pt(value)} g`;
  if (unit === 'ml') return value >= 1000 ? `${pt(value / 1000)} L` : `${pt(value)} ml`;
  return `${pt(value)} ${unit}`;
}

// Retailer names usually already carry the size ("Arroz Tio João Tipo 1 5kg"),
// and the row appends " · 5 kg" itself, so drop the size token from the name
// to avoid showing it twice. Falls back to the original when nothing is left.
export function displayProductName(name: string, size: string | null): string {
  if (!size) return name;
  const pattern = size
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .trim()
    .split(/\s+/)
    .join('\\s*');
  const stripped = name
    .replace(new RegExp(`\\b${pattern}\\b`, 'i'), '')
    .replace(/\s{2,}/g, ' ')
    .replace(/[\s\-–·,]+$/, '')
    .trim();
  return stripped.length > 0 ? stripped : name;
}

// Catalog names may or may not carry accents ("Feijão" / "Feijao"), so the
// sheet matches on both spellings of the label.
export function nameVariants(label: string): string[] {
  const plain = label.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return plain === label ? [label] : [label, plain];
}

// Deliberately loose: one @, something on both sides, a dot in the domain.
// A typo the regex lets through only costs one undeliverable notice.
export function isValidEmail(email: string): boolean {
  const e = email.trim();
  return e.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

export type OnboardingArea = 'covered' | 'outside';

export interface OnboardingResult {
  items: OnboardingItem[];
  area: OnboardingArea;
}

const STORAGE_KEY = 'poup:onboarding';

// shortcut: the chosen generic items and coverage area are stored raw in
// AsyncStorage and read by nobody yet (the root screen is Etapa 4). Upgrade:
// use-tracked-items owns tracked items from Etapa 4 and migrates this key.
export async function saveOnboarding(result: OnboardingResult): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(result));
}

export async function loadOnboarding(): Promise<OnboardingResult | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as OnboardingResult) : null;
  } catch {
    return null;
  }
}
