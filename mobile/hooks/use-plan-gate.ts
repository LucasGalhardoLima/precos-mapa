import { useCallback } from 'react';
import { useAuthStore } from '@precomapa/shared';

const FREE_LIMITS = {
  favorites: 10,
  alerts: 3,
  comparison_stores: 5,
} as const;

type Feature = 'favorites' | 'alerts' | 'comparison_stores' | 'smart_lists' | 'price_history';

const PLUS_FEATURES: Feature[] = ['smart_lists', 'price_history'];

export function usePlanGate() {
  const profile = useAuthStore((s) => s.profile);
  const plan = profile?.b2c_plan ?? 'free';
  const isPaid = plan === 'plus' || plan === 'family';

  const canUse = useCallback(
    (feature: Feature, currentCount?: number): boolean => {
      if (isPaid) return true;

      if (PLUS_FEATURES.includes(feature)) return false;

      const limit = FREE_LIMITS[feature as keyof typeof FREE_LIMITS];
      if (limit !== undefined && currentCount !== undefined) {
        return currentCount < limit;
      }

      return true;
    },
    [isPaid],
  );

  const getLimit = (feature: keyof typeof FREE_LIMITS): number | null => {
    return isPaid ? null : FREE_LIMITS[feature];
  };

  return { plan, isPaid, canUse, getLimit };
}
