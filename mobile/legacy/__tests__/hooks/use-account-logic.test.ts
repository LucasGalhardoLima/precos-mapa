// mobile/__tests__/hooks/use-account-logic.test.ts

// Tests for account management logic: deletion order, export, consent

import { createSupabaseMock } from '../helpers/supabase-mock';

// ---------------------------------------------------------------------------
// Replicate deletion order from use-account.ts
// ---------------------------------------------------------------------------

async function deleteAccountInOrder(
  supabase: any,
  userId: string,
): Promise<{ success: boolean; deletionOrder: string[] }> {
  const deletionOrder: string[] = [];

  try {
    // 1. Get shopping list IDs for cascading delete
    const { data: lists } = await supabase
      .from('shopping_lists')
      .select('id')
      .eq('user_id', userId);

    const listIds = lists?.map((l: any) => l.id) ?? [];

    // 2. Delete in FK-safe order
    await supabase.from('shopping_list_items').delete().in('list_id', listIds);
    deletionOrder.push('shopping_list_items');

    await supabase.from('shopping_lists').delete().eq('user_id', userId);
    deletionOrder.push('shopping_lists');

    await supabase.from('user_alerts').delete().eq('user_id', userId);
    deletionOrder.push('user_alerts');

    await supabase.from('user_favorites').delete().eq('user_id', userId);
    deletionOrder.push('user_favorites');

    await supabase.from('push_tokens').delete().eq('user_id', userId);
    deletionOrder.push('push_tokens');

    await supabase.from('store_members').delete().eq('user_id', userId);
    deletionOrder.push('store_members');

    // 3. Record consent withdrawal
    await supabase.from('consent_log').insert({
      user_id: userId,
      action: 'account_deletion',
      version: '1.0',
    });
    deletionOrder.push('consent_log');

    // 4. Delete profile last
    await supabase.from('profiles').delete().eq('id', userId);
    deletionOrder.push('profiles');

    return { success: true, deletionOrder };
  } catch {
    return { success: false, deletionOrder };
  }
}

// ---------------------------------------------------------------------------
// Export data structure builder
// ---------------------------------------------------------------------------

interface ExportedData {
  profile: Record<string, unknown> | null;
  favorites: Record<string, unknown>[];
  alerts: Record<string, unknown>[];
  shopping_lists: Record<string, unknown>[];
}

function buildExportData(
  profileData: any,
  favoritesData: any[] | null,
  alertsData: any[] | null,
  listsData: any[] | null,
): ExportedData {
  return {
    profile: profileData,
    favorites: favoritesData ?? [],
    alerts: alertsData ?? [],
    shopping_lists: listsData ?? [],
  };
}

// ===========================================================================
// Tests
// ===========================================================================

describe('Account Deletion — Order', () => {
  it('deletes tables in FK-safe order', async () => {
    const { client } = createSupabaseMock();

    const result = await deleteAccountInOrder(client, 'user-123');

    expect(result.success).toBe(true);
    expect(result.deletionOrder).toEqual([
      'shopping_list_items', // depends on shopping_lists
      'shopping_lists',      // depends on profiles
      'user_alerts',         // depends on profiles
      'user_favorites',      // depends on profiles
      'push_tokens',         // depends on profiles
      'store_members',       // depends on profiles
      'consent_log',         // insert before profile delete
      'profiles',            // last — everything else references this
    ]);
  });

  it('shopping_list_items deleted before shopping_lists', async () => {
    const { client } = createSupabaseMock();
    const result = await deleteAccountInOrder(client, 'user-123');

    const itemsIdx = result.deletionOrder.indexOf('shopping_list_items');
    const listsIdx = result.deletionOrder.indexOf('shopping_lists');
    expect(itemsIdx).toBeLessThan(listsIdx);
  });

  it('consent_log inserted before profiles deleted', async () => {
    const { client } = createSupabaseMock();
    const result = await deleteAccountInOrder(client, 'user-123');

    const consentIdx = result.deletionOrder.indexOf('consent_log');
    const profilesIdx = result.deletionOrder.indexOf('profiles');
    expect(consentIdx).toBeLessThan(profilesIdx);
  });

  it('profiles is always the last deletion', async () => {
    const { client } = createSupabaseMock();
    const result = await deleteAccountInOrder(client, 'user-123');

    expect(result.deletionOrder[result.deletionOrder.length - 1]).toBe('profiles');
  });

  it('handles empty shopping lists gracefully', async () => {
    const { client, mockFrom } = createSupabaseMock();
    // Override shopping_lists select to return empty
    mockFrom('shopping_lists').select.mockReturnValue({
      eq: jest.fn().mockResolvedValue({ data: [], error: null }),
    });

    const result = await deleteAccountInOrder(client, 'user-123');
    expect(result.success).toBe(true);
  });
});

describe('Account Export — Data Structure', () => {
  it('returns all sections populated when data exists', () => {
    const result = buildExportData(
      { id: 'user-1', display_name: 'Lucas' },
      [{ id: 'fav-1', product_id: 'p1' }],
      [{ id: 'alert-1', product_id: 'p2' }],
      [{ id: 'list-1', name: 'Compras' }],
    );

    expect(result.profile).toEqual({ id: 'user-1', display_name: 'Lucas' });
    expect(result.favorites).toHaveLength(1);
    expect(result.alerts).toHaveLength(1);
    expect(result.shopping_lists).toHaveLength(1);
  });

  it('defaults null arrays to empty arrays', () => {
    const result = buildExportData(
      { id: 'user-1' },
      null,
      null,
      null,
    );

    expect(result.favorites).toEqual([]);
    expect(result.alerts).toEqual([]);
    expect(result.shopping_lists).toEqual([]);
  });

  it('allows null profile', () => {
    const result = buildExportData(null, [], [], []);
    expect(result.profile).toBeNull();
  });
});
