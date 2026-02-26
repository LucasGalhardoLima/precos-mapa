import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { alertSchema } from '@/lib/schemas';
import { useAuthStore } from '@precomapa/shared';
import type { AlertWithProduct } from '@/types';

export function useAlerts() {
  const [alerts, setAlerts] = useState<AlertWithProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const session = useAuthStore((s) => s.session);
  const userId = session?.user?.id;

  const fetchAlerts = useCallback(async () => {
    if (!userId) {
      setAlerts([]);
      setIsLoading(false);
      return;
    }

    const { data } = await supabase
      .from('user_alerts')
      .select('*, product:products(*)')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (data) setAlerts(data as AlertWithProduct[]);
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

      const { error } = await supabase.from('user_alerts').insert({
        user_id: userId,
        product_id: productId,
        target_price: targetPrice ?? null,
        radius_km: radiusKm ?? 5,
      });

      if (error) {
        throw new Error(
          error.message.includes('limit')
            ? 'Limite de alertas atingido. Faca upgrade para criar mais.'
            : error.message
        );
      }

      await fetchAlerts();
    },
    [userId, fetchAlerts]
  );

  const disableAlert = useCallback(
    async (alertId: string) => {
      if (!userId) return;

      await supabase
        .from('user_alerts')
        .update({ is_active: false })
        .eq('id', alertId)
        .eq('user_id', userId);

      await fetchAlerts();
    },
    [userId, fetchAlerts]
  );

  return {
    alerts,
    isLoading,
    create: createAlert,
    disable: disableAlert,
    count: alerts.length,
  };
}
