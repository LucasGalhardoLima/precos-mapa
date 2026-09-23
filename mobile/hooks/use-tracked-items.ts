import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { usePushNotifications } from '@poup/shared';

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

  const upsert = useCallback(
    async (targetPrice: number | null): Promise<boolean> => {
      let {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        const { data, error } = await supabase.auth.signInAnonymously();
        if (error) return false;
        session = data.session;
      }
      if (!session) return false;

      const userId = session.user.id;
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
        // Fire-and-forget, and deliberately not awaited before the write —
        // a denied/skipped permission must never block saving the alert.
        requestPermission().catch(() => {});
        const ok = await upsert(targetPrice);
        if (ok) await refresh();
        return ok;
      } finally {
        setIsSubmitting(false);
      }
    },
    [requestPermission, upsert, refresh],
  );

  const trackWithoutAlert = useCallback(async (): Promise<boolean> => {
    setIsSubmitting(true);
    try {
      const ok = await upsert(null);
      if (ok) await refresh();
      return ok;
    } finally {
      setIsSubmitting(false);
    }
  }, [upsert, refresh]);

  return { trackedState, isSubmitting, trackWithAlert, trackWithoutAlert };
}
