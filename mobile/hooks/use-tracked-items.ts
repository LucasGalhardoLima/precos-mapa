import { useCallback, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { usePushNotifications } from '@poup/shared';

interface TrackProductOptions {
  productId: string;
  targetPrice: number | null; // null for 'no-price'/'fact' products — nothing to suggest yet
}

// "acompanhar este item ›" (Resposta, doc decisão 10: permissão de
// notificação no primeiro toque, não antes). Sequence per the Etapa 5 spec:
// signInAnonymously() (only if no session yet) → notification permission
// with context → upsert tracked_items. RLS (migration 084) is `user_id =
// auth.uid()`, so once signed in the client's own JWT already scopes every
// request — no anonymous_id plumbing needed here (unlike use-analytics,
// which predates anonymous auth and had to build its own fallback).
//
// Only the write side. Ajustes' "itens acompanhados" list (teto 4, ✕
// remove) is Etapa 7 — this hook doesn't list/remove yet, add those methods
// there rather than duplicating this file.
export function useTrackedItems() {
  const [isTracking, setIsTracking] = useState(false);
  const { requestPermission } = usePushNotifications({ autoRequest: false });

  const trackProduct = useCallback(
    async ({ productId, targetPrice }: TrackProductOptions): Promise<boolean> => {
      setIsTracking(true);
      try {
        let {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          const { data, error } = await supabase.auth.signInAnonymously();
          if (error) throw error;
          session = data.session;
        }
        if (!session) return false; // signInAnonymously succeeded with no session — shouldn't happen, fail closed

        // Fire-and-forget: a declined/skipped notification permission must
        // never block tracking the item itself — "acompanhar" is the point,
        // the alert is a bonus. requestPermission() no-ops if already
        // granted/denied (expo-notifications only prompts once per install).
        requestPermission().catch(() => {});

        const userId = session.user.id;
        const { data: existing } = await supabase
          .from('tracked_items')
          .select('id')
          .eq('user_id', userId)
          .eq('product_id', productId)
          .maybeSingle();

        const { error: writeError } = existing
          ? await supabase.from('tracked_items').update({ target_price: targetPrice }).eq('id', existing.id)
          : await supabase.from('tracked_items').insert({ user_id: userId, product_id: productId, target_price: targetPrice });

        if (writeError) throw writeError;
        return true;
      } catch {
        return false;
      } finally {
        setIsTracking(false);
      }
    },
    [requestPermission],
  );

  return { trackProduct, isTracking };
}
