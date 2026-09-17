import { useCallback, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@poup/shared';

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
    if (!session?.access_token) return false;

    setIsDeleting(true);
    try {
      // Call Edge Function which deletes auth.users via admin API.
      // Cascade FKs automatically remove profiles and all related data.
      const { error } = await supabase.functions.invoke('delete-account');

      if (error) {
        console.warn('[useAccount] Account deletion failed:', error);
        return false;
      }

      // Sign out locally
      await supabase.auth.signOut();
      setSession(null);

      return true;
    } catch (err) {
      console.warn('[useAccount] Account deletion failed:', err);
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
