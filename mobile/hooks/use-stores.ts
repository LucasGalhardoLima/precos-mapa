import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { calculateDistanceKm } from '@/hooks/use-location';
import { getGamificationMessage } from '@/constants/messages';
import type { Store, StoreWithPromotions, EnrichedPromotion, PromotionWithRelations } from '@/types';

interface UseStoresParams {
  userLatitude: number;
  userLongitude: number;
}

export function useStores(params: UseStoresParams) {
  const { userLatitude, userLongitude } = params;
  const [raw, setRaw] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      const { data } = await supabase
        .from('stores')
        .select(`
          *,
          promotions:promotions(
            *,
            product:products(*)
          )
        `)
        .eq('is_active', true)
        .eq('promotions.status', 'active')
        .gt('promotions.end_date', new Date().toISOString());

      if (data) setRaw(data);
      setIsLoading(false);
    }

    fetch();
  }, []);

  const stores = useMemo((): StoreWithPromotions[] => {
    return raw.map((store) => {
      const distanceKm = calculateDistanceKm(
        userLatitude,
        userLongitude,
        store.latitude,
        store.longitude
      );

      const storePromos: EnrichedPromotion[] = (store.promotions || [])
        .filter((p: any) => p.product)
        .map((promo: any) => {
          const discountPercent = Math.round(
            (1 - promo.promo_price / promo.original_price) * 100
          );
          const belowNormalPercent = Math.max(
            0,
            Math.round((1 - promo.promo_price / promo.product.reference_price) * 100)
          );
          const endDate = new Date(promo.end_date);
          const today = new Date();
          const isExpiringSoon =
            endDate.getFullYear() === today.getFullYear() &&
            endDate.getMonth() === today.getMonth() &&
            endDate.getDate() === today.getDate();

          return {
            ...promo,
            store,
            discountPercent,
            belowNormalPercent,
            gamificationMessage: getGamificationMessage(discountPercent),
            distanceKm,
            isExpiringSoon,
            isBestPrice: false,
          } as EnrichedPromotion;
        });

      const topDeals = [...storePromos]
        .sort((a, b) => b.discountPercent - a.discountPercent)
        .slice(0, 3);

      return {
        store: store as Store,
        activePromotionCount: storePromos.length,
        topDeals,
        distanceKm,
      };
    });
  }, [raw, userLatitude, userLongitude]);

  return { stores, isLoading };
}
