import { useState, useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
import { supabase } from '@/lib/supabase';
import { alertSchema } from '@/lib/schemas';
import { useAuthStore } from '@poup/shared';
import type { AlertWithProduct } from '@/types';

export function useAlerts() {
  const [alerts, setAlerts] = useState<AlertWithProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const session = useAuthStore((s) => s.session);
  const userId = session?.user?.id;

  const fetchAlerts = useCallback(async () => {
    if (!userId) {
      setAlerts([]);
      setIsLoading(false);
      return;
    }

    setError(null);
    const { data, error: fetchErr } = await supabase
      .from('user_alerts')
      .select('*, product:products(*), triggered_store:stores!user_alerts_triggered_store_id_fkey(id, name)')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (fetchErr) {
      setError(new Error(fetchErr.message));
    } else if (data) {
      setAlerts(data as AlertWithProduct[]);
    }
    setIsLoading(false);
  }, [userId]);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  const createAlert = useCallback(
    async (productId: string, targetPrice?: number, radiusKm?: number) => {
      if (!userId) return;

      const payload = {
        product_id: productId,
        target_price: targetPrice,
        radius_km: radiusKm ?? 5,
      };

      const result = alertSchema.safeParse(payload);
      if (!result.success) {
        throw new Error(result.error.issues[0].message);
      }

      const snapshot = [...alerts];

      const tempAlert = {
        id: 'temp-' + Date.now(),
        user_id: userId,
        product_id: productId,
        target_price: targetPrice ?? null,
        radius_km: radiusKm ?? 5,
        is_active: true,
        created_at: new Date().toISOString(),
        product: {} as AlertWithProduct['product'],
      } as AlertWithProduct;

      setAlerts((prev) => [...prev, tempAlert]);

      // Check if a disabled alert already exists for this product (unique constraint)
      const { data: existing } = await supabase
        .from('user_alerts')
        .select('id')
        .eq('user_id', userId)
        .eq('product_id', productId)
        .eq('is_active', false)
        .maybeSingle();

      let error: { message: string } | null = null;

      if (existing) {
        // Re-enable the existing alert and clear any stale trigger data
        ({ error } = await supabase
          .from('user_alerts')
          .update({
            is_active: true,
            target_price: targetPrice ?? null,
            radius_km: radiusKm ?? 5,
            triggered_at: null,
            triggered_price: null,
            triggered_store_id: null,
          })
          .eq('id', existing.id));
      } else {
        ({ error } = await supabase.from('user_alerts').insert({
          user_id: userId,
          product_id: productId,
          target_price: targetPrice ?? null,
          radius_km: radiusKm ?? 5,
        }));
      }

      if (error) {
        setAlerts(snapshot);
        if (error.message.includes('limit')) {
          throw new Error(
            'Limite de alertas atingido. Faca upgrade para criar mais.'
          );
        }
        Alert.alert('Erro', 'Não foi possível criar o alerta.');
        return;
      }

      fetchAlerts();
    },
    [userId, alerts, fetchAlerts]
  );

  const disableAlert = useCallback(
    async (alertId: string) => {
      if (!userId) return;

      const snapshot = [...alerts];

      setAlerts((prev) => prev.filter((a) => a.id !== alertId));

      const { error } = await supabase
        .from('user_alerts')
        .update({ is_active: false })
        .eq('id', alertId)
        .eq('user_id', userId);

      if (error) {
        setAlerts(snapshot);
        Alert.alert('Erro', 'Não foi possível atualizar o alerta.');
        return;
      }

      fetchAlerts();
    },
    [userId, alerts, fetchAlerts]
  );

  const toggleAlert = useCallback(
    async (alertId: string, active: boolean) => {
      if (!userId) return;

      const snapshot = [...alerts];

      if (!active) {
        setAlerts((prev) => prev.filter((a) => a.id !== alertId));
      } else {
        setAlerts((prev) =>
          prev.map((a) => (a.id === alertId ? { ...a, is_active: true } : a))
        );
      }

      const { error } = await supabase
        .from('user_alerts')
        .update({ is_active: active })
        .eq('id', alertId)
        .eq('user_id', userId);

      if (error) {
        setAlerts(snapshot);
        Alert.alert('Erro', 'Não foi possível atualizar o alerta.');
        return;
      }

      fetchAlerts();
    },
    [userId, alerts, fetchAlerts]
  );

  return {
    alerts,
    isLoading,
    error,
    create: createAlert,
    disable: disableAlert,
    toggle: toggleAlert,
    count: alerts.length,
    refresh: fetchAlerts,
  };
}
