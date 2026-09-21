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

export type OnboardingArea = 'covered' | 'outside';

export interface OnboardingResult {
  items: GenericItem[];
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
