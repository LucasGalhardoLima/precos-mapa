jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('@/lib/supabase', () => ({ supabase: {} }));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { buildRows, rowsToInsert, syncOnboardingItems, type SyncDeps, type NewTrackedRow } from '@/lib/onboarding-sync';
import { isOnboardingDone, markOnboardingDone, saveOnboarding, areItemsMigrated, type OnboardingItem } from '@/lib/onboarding';

const generic: OnboardingItem = { label: 'Arroz', size: '5 kg', product: null };
const pinned: OnboardingItem = {
  label: 'Leite',
  size: '1 L',
  product: { id: 'prod-1', name: 'Leite Italac 1L', ean: '789', imageUrl: null, size: '1 L' },
};

function deps(over: Partial<SyncDeps> = {}): SyncDeps & { inserted: NewTrackedRow[][] } {
  const inserted: NewTrackedRow[][] = [];
  return {
    inserted,
    getUserId: async () => 'u1',
    signInAnonymously: async () => 'u-anon',
    listExisting: async () => [],
    insert: async (rows) => {
      inserted.push(rows);
    },
    now: () => 1_000_000,
    ...over,
  };
}

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('buildRows', () => {
  it('maps a generic item to category+size and a pinned one to product_id only', () => {
    const [g, p] = buildRows([generic, pinned], 'u1', 0);
    expect(g).toMatchObject({ user_id: 'u1', category_label: 'Arroz', category_size: '5 kg', target_price: null });
    expect(g).not.toHaveProperty('product_id');
    expect(p).toMatchObject({ user_id: 'u1', product_id: 'prod-1', target_price: null });
    expect(p).not.toHaveProperty('category_label');
  });

  it('keeps the chosen order via increasing created_at', () => {
    const [a, b] = buildRows([generic, pinned], 'u1', 5000);
    expect(new Date(a!.created_at).getTime()).toBeLessThan(new Date(b!.created_at).getTime());
  });

  it('drops duplicates within the batch', () => {
    expect(buildRows([generic, generic], 'u1', 0)).toHaveLength(1);
  });
});

describe('rowsToInsert', () => {
  it('skips rows the user already has', () => {
    const rows = buildRows([generic, pinned], 'u1', 0);
    const missing = rowsToInsert(rows, [{ product_id: 'prod-1', category_label: null, category_size: null }]);
    expect(missing.map((r) => r.category_label)).toEqual(['Arroz']);
  });
});

describe('syncOnboardingItems', () => {
  it('writes the stored items and marks migrated only afterwards', async () => {
    await saveOnboarding({ items: [generic, pinned], area: 'covered' });
    const d = deps();
    expect(await syncOnboardingItems(d)).toBe('synced');
    expect(d.inserted[0]).toHaveLength(2);
    expect(await areItemsMigrated()).toBe(true);
  });

  it('is idempotent: second run does nothing', async () => {
    await saveOnboarding({ items: [generic], area: 'covered' });
    const d = deps();
    await syncOnboardingItems(d);
    expect(await syncOnboardingItems(d)).toBe('nothing-to-do');
    expect(d.inserted).toHaveLength(1);
  });

  it('does not duplicate when rows already exist (retry after a half-done run)', async () => {
    await saveOnboarding({ items: [generic, pinned], area: 'covered' });
    const d = deps({ listExisting: async () => [{ category_label: 'Arroz', category_size: '5 kg', product_id: null }] });
    await syncOnboardingItems(d);
    expect(d.inserted[0]).toHaveLength(1);
    expect(d.inserted[0]![0]).toMatchObject({ product_id: 'prod-1' });
  });

  it('signs in anonymously when there is no session', async () => {
    await saveOnboarding({ items: [generic], area: 'covered' });
    const d = deps({ getUserId: async () => null });
    await syncOnboardingItems(d);
    expect(d.inserted[0]![0]!.user_id).toBe('u-anon');
  });

  it('fails without marking migrated when sign-in is refused', async () => {
    await saveOnboarding({ items: [generic], area: 'covered' });
    const d = deps({ getUserId: async () => null, signInAnonymously: async () => null });
    expect(await syncOnboardingItems(d)).toBe('failed');
    expect(await areItemsMigrated()).toBe(false);
  });

  it('fails without marking migrated on a network error, and a later run succeeds', async () => {
    await saveOnboarding({ items: [generic], area: 'covered' });
    const failing = deps({
      insert: async () => {
        throw new Error('network');
      },
    });
    expect(await syncOnboardingItems(failing)).toBe('failed');
    expect(await areItemsMigrated()).toBe(false);
    expect(await syncOnboardingItems(deps())).toBe('synced');
  });

  it('one unwritable row (e.g. a product merged out of the catalog) does not block the others', async () => {
    await saveOnboarding({ items: [generic, pinned], area: 'covered' });
    const written: NewTrackedRow[] = [];
    const d = deps({
      insert: async (rows) => {
        if (rows.some((r) => r.product_id === 'prod-1')) throw new Error('fk violation');
        written.push(...rows);
      },
    });
    expect(await syncOnboardingItems(d)).toBe('synced');
    expect(written.map((r) => r.category_label)).toEqual(['Arroz']);
    expect(await areItemsMigrated()).toBe(true);
  });

  it('with no items chosen writes nothing and marks migrated', async () => {
    await saveOnboarding({ items: [], area: 'covered' });
    const d = deps();
    expect(await syncOnboardingItems(d)).toBe('nothing-to-do');
    expect(d.inserted).toHaveLength(0);
    expect(await areItemsMigrated()).toBe(true);
  });

  it('with no stored onboarding does nothing and does not mark migrated', async () => {
    expect(await syncOnboardingItems(deps())).toBe('nothing-to-do');
    expect(await areItemsMigrated()).toBe(false);
  });
});

describe('isOnboardingDone', () => {
  it('is false on a fresh device', async () => {
    expect(await isOnboardingDone()).toBe(false);
  });
  it('is true with the new key alone', async () => {
    await markOnboardingDone();
    expect(await isOnboardingDone()).toBe(true);
  });
  it('is true for an existing user who only has the legacy payload', async () => {
    await saveOnboarding({ items: [], area: 'covered' });
    expect(await isOnboardingDone()).toBe(true);
  });
});
