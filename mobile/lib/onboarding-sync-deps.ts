import { supabase } from '@/lib/supabase';
import type { SyncDeps } from '@/lib/onboarding-sync';

// Real Supabase wiring for syncOnboardingItems. Same anonymous-session pattern
// as hooks/use-tracked-items.ts (the only place a user is created).
export const supabaseSyncDeps: SyncDeps = {
  async getUserId() {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.user.id ?? null;
  },
  async signInAnonymously() {
    const { data, error } = await supabase.auth.signInAnonymously();
    if (error) return null;
    return data.session?.user.id ?? null;
  },
  async listExisting(userId) {
    const { data, error } = await supabase.from('tracked_items').select('product_id, category_label, category_size').eq('user_id', userId);
    if (error) throw error;
    return data ?? [];
  },
  async insert(rows) {
    const { error } = await supabase.from('tracked_items').insert(rows);
    if (error) throw error;
  },
  now: () => Date.now(),
};
