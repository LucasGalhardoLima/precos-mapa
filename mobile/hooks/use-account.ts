import { useCallback, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@precomapa/shared';

interface ExportedData {
  profile: Record<string, unknown> | null;
  favorites: Record<string, unknown>[];
  alerts: Record<string, unknown>[];
  shopping_lists: Record<string, unknown>[];
}

export function useAccount() {
  const session = useAuthStore((s) => s.session);
  const setSession = useAuthStore((s) => s.setSession);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const exportData = useCallback(async (): Promise<ExportedData | null> => {
    const userId = session?.user?.id;
    if (!userId) return null;

    setIsExporting(true);
    try {
      const [profileRes, favoritesRes, alertsRes, listsRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', userId).single(),
        supabase.from('user_favorites').select('*, product:products(name, brand)').eq('user_id', userId),
        supabase.from('user_alerts').select('*, product:products(name)').eq('user_id', userId),
        supabase.from('shopping_lists').select('*, items:shopping_list_items(*, product:products(name))').eq('user_id', userId),
      ]);

      return {
        profile: profileRes.data,
        favorites: favoritesRes.data ?? [],
        alerts: alertsRes.data ?? [],
        shopping_lists: listsRes.data ?? [],
      };
    } finally {
      setIsExporting(false);
    }
  }, [session]);

  const deleteAccount = useCallback(async (): Promise<boolean> => {
    const userId = session?.user?.id;
    if (!userId) return false;

    setIsDeleting(true);
    try {
      // Delete user data in order (respecting foreign keys)
      await supabase.from('shopping_list_items')
        .delete()
        .in('list_id',
          (await supabase.from('shopping_lists').select('id').eq('user_id', userId)).data?.map(l => l.id) ?? []
        );
      await supabase.from('shopping_lists').delete().eq('user_id', userId);
      await supabase.from('user_alerts').delete().eq('user_id', userId);
      await supabase.from('user_favorites').delete().eq('user_id', userId);
      await supabase.from('push_tokens').delete().eq('user_id', userId);
      await supabase.from('store_members').delete().eq('user_id', userId);

      // Record consent withdrawal
      await supabase.from('consent_log').insert({
        user_id: userId,
        action: 'account_deletion',
        version: '1.0',
      });

      // Delete profile (RLS should allow own profile deletion)
      await supabase.from('profiles').delete().eq('id', userId);

      // Sign out
      await supabase.auth.signOut();
      setSession(null);

      return true;
    } catch {
      return false;
    } finally {
      setIsDeleting(false);
    }
  }, [session, setSession]);

  const recordConsent = useCallback(async (version: string = '1.0') => {
    const userId = session?.user?.id;
    if (!userId) return;

    await supabase.from('consent_log').insert({
      user_id: userId,
      action: 'privacy_policy_accepted',
      version,
    });
  }, [session]);

  return {
    exportData,
    deleteAccount,
    recordConsent,
    isDeleting,
    isExporting,
  };
}
