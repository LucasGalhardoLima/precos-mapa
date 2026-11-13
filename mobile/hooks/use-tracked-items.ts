import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { anonymousSignInArgs } from '@/lib/e2e';
import { usePushNotifications } from '@poup/shared';
import { readNotificationsEnabled, syncPushPreference } from './use-notification-setting';
import { readTrackedState, saveTrackedItem, type TrackedReadDeps, type TrackedSaveDeps } from '@/lib/tracked-items';

export interface TrackedState {
  isTracked: boolean;
  targetPrice: number | null;
}

// Folha "Acompanhar" (artefato seção 8, spec do Lucas 2026-09-23):
// - "Acompanhar e avisar ›": signInAnonymously (só se não há sessão) →
//   pedido de permissão de notificação → grava com target_price. Permissão
//   negada NÃO bloqueia a gravação ("negada insere sem push") — o alerta
//   fica pronto no banco, só sem como notificar até o usuário conceder a
//   permissão depois (ex.: pelos Ajustes do sistema).
// - "Acompanhar sem avisos ›": grava com target_price null, NUNCA pede
//   permissão (não há aviso pra dar).
// Ambos fazem upsert manual (select + insert/update) em vez de
// `.upsert(...)` — a constraint única em tracked_items é um índice parcial
// (migration 084), e o onConflict do supabase-js não mira índices parciais.
// O tratamento de erro (leitura e gravação) vive em lib/tracked-items.ts.

const readDeps: TrackedReadDeps = {
  async getUserId() {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.user.id ?? null;
  },
  selectTarget: (userId, productId) =>
    supabase.from('tracked_items').select('target_price').eq('user_id', userId).eq('product_id', productId).maybeSingle(),
};

const saveDeps: TrackedSaveDeps = {
  getUserId: readDeps.getUserId,
  async signInAnonymously() {
    const { data, error } = await supabase.auth.signInAnonymously(...anonymousSignInArgs);
    if (error || !data.session) return null;
    // A switch turned off in Ajustes before this point only lived locally —
    // push it to the new profile's notification_preferences so the server
    // respects it.
    if (!(await readNotificationsEnabled())) await syncPushPreference(false).catch(() => {});
    return data.session.user.id;
  },
  selectExisting: (userId, productId) =>
    supabase.from('tracked_items').select('id').eq('user_id', userId).eq('product_id', productId).maybeSingle(),
  update: (id, targetPrice) => supabase.from('tracked_items').update({ target_price: targetPrice }).eq('id', id),
  insert: (userId, productId, targetPrice) =>
    supabase.from('tracked_items').insert({ user_id: userId, product_id: productId, target_price: targetPrice }),
};

export function useTrackedItems(productId: string) {
  // null = ainda resolvendo, ou a leitura falhou (fica null: desconhecido não
  // é "não acompanhado"; o link "acompanhar" segue funcionando e um save atualiza).
  const [trackedState, setTrackedState] = useState<TrackedState | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // A última tentativa de salvar falhou. Zera a cada tentativa e em clearError
  // (chamado por quem reabre a folha).
  const [error, setError] = useState(false);
  const { requestPermission } = usePushNotifications({ autoRequest: false });

  const refresh = useCallback(async () => {
    const result = await readTrackedState(readDeps, productId);
    if (result.status === 'ok') setTrackedState(result.state);
  }, [productId]);

  useEffect(() => {
    setTrackedState(null);
    refresh();
  }, [refresh]);

  const save = useCallback(
    async (targetPrice: number | null): Promise<boolean> => {
      setIsSubmitting(true);
      setError(false);
      try {
        const ok = await saveTrackedItem(saveDeps, productId, targetPrice);
        if (ok) await refresh();
        else setError(true);
        return ok;
      } finally {
        setIsSubmitting(false);
      }
    },
    [productId, refresh],
  );

  const trackWithAlert = useCallback(
    async (targetPrice: number): Promise<boolean> => {
      // Session first: registerForPushToken saves the token against the
      // session that exists when permission resolves, so asking before
      // signInAnonymously lost the token on the very first "acompanhar".
      // If sign-in fails here, save() retries it and reports the failure.
      if (!(await saveDeps.getUserId())) await saveDeps.signInAnonymously();
      // Fire-and-forget, and deliberately not awaited before the write —
      // a denied/skipped permission must never block saving the alert.
      requestPermission().catch(() => {});
      return save(targetPrice);
    },
    [requestPermission, save],
  );

  const trackWithoutAlert = useCallback((): Promise<boolean> => save(null), [save]);

  const clearError = useCallback(() => setError(false), []);

  return { trackedState, isSubmitting, error, clearError, trackWithAlert, trackWithoutAlert };
}
