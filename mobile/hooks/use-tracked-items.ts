import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Session } from '@supabase/supabase-js';
import { usePushNotifications } from '@poup/shared';
import { readNotificationsEnabled, syncPushPreference } from './use-notification-setting';

export interface TrackedState {
  isTracked: boolean;
  targetPrice: number | null;
}

// Folha "Acompanhar" (artefato seção 8, spec do Lucas 2026-09-23):
// - "Acompanhar e avisar ›": signInAnonymously (só se não há sessão) →
//   pedido de permissão de notificação (o token vai para profiles.push_token
//   dessa sessão) → grava com target_price. Permissão
//   negada NÃO bloqueia a gravação ("negada insere sem push") — o alerta
//   fica pronto no banco, só sem como notificar até o usuário conceder a
//   permissão depois (ex.: pelos Ajustes do sistema).
// - "Acompanhar sem avisos ›": grava com target_price null, NUNCA pede
//   permissão (não há aviso pra dar).
// Ambos fazem upsert manual (select + insert/update) em vez de
// `.upsert(...)` — a constraint única em tracked_items é um índice parcial
// (migration 084), e o onConflict do supabase-js não mira índices parciais.
export function useTrackedItems(productId: string) {
  const [trackedState, setTrackedState] = useState<TrackedState | null>(null); // null = ainda resolvendo
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { requestPermission } = usePushNotifications({ autoRequest: false });

  const refresh = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      setTrackedState({ isTracked: false, targetPrice: null });
      return;
    }
    const { data } = await supabase.from('tracked_items').select('target_price').eq('user_id', session.user.id).eq('product_id', productId).maybeSingle();
    setTrackedState({ isTracked: !!data, targetPrice: data?.target_price ?? null });
  }, [productId]);

  useEffect(() => {
    setTrackedState(null);
    refresh();
  }, [refresh]);

  // Anonymous session, created on the first "acompanhar". A switch turned off
  // in Ajustes before this point only lived locally — push it to the new
  // profile's notification_preferences so the server respects it.
  const ensureSession = useCallback(async (): Promise<Session | null> => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session) return session;

    const { data, error } = await supabase.auth.signInAnonymously();
    if (error || !data.session) return null;
    if (!(await readNotificationsEnabled())) await syncPushPreference(false).catch(() => {});
    return data.session;
  }, []);

  const write = useCallback(
    async (userId: string, targetPrice: number | null): Promise<boolean> => {
      const { data: existing } = await supabase.from('tracked_items').select('id').eq('user_id', userId).eq('product_id', productId).maybeSingle();

      const { error: writeError } = existing
        ? await supabase.from('tracked_items').update({ target_price: targetPrice }).eq('id', existing.id)
        : await supabase.from('tracked_items').insert({ user_id: userId, product_id: productId, target_price: targetPrice });

      return !writeError;
    },
    [productId],
  );

  const trackWithAlert = useCallback(
    async (targetPrice: number): Promise<boolean> => {
      setIsSubmitting(true);
      try {
        // Session first: registerForPushToken saves the token against the
        // session that exists when permission resolves, so asking before
        // signInAnonymously lost the token on the very first "acompanhar".
        const session = await ensureSession();
        if (!session) return false;
        // Fire-and-forget, and deliberately not awaited before the write —
        // a denied/skipped permission must never block saving the alert.
        requestPermission().catch(() => {});
        const ok = await write(session.user.id, targetPrice);
        if (ok) await refresh();
        return ok;
      } finally {
        setIsSubmitting(false);
      }
    },
    [ensureSession, requestPermission, write, refresh],
  );

  const trackWithoutAlert = useCallback(async (): Promise<boolean> => {
    setIsSubmitting(true);
    try {
      const session = await ensureSession();
      if (!session) return false;
      const ok = await write(session.user.id, null);
      if (ok) await refresh();
      return ok;
    } finally {
      setIsSubmitting(false);
    }
  }, [ensureSession, write, refresh]);

  return { trackedState, isSubmitting, trackWithAlert, trackWithoutAlert };
}
