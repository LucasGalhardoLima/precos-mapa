import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import type { PromotionWithRelations, EnrichedPromotion } from '@/types';
import { getGamificationMessage } from '@/constants/messages';

export function useFeaturedDeals() {
  const [raw, setRaw] = useState<PromotionWithRelations[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      const { data } = await supabase
        .from('promotions')
        .select('*, product:products(*), store:stores(*)')
        .eq('status', 'active')
        .gt('end_date', new Date().toISOString())
        .order('promo_price', { ascending: true })
        .limit(10);

      if (data) setRaw(data as PromotionWithRelations[]);
      setIsLoading(false);
    }

    fetch();
  }, []);

  const deals = useMemo((): EnrichedPromotion[] => {
    return raw
      .map((promo) => {
        const discountPercent = Math.round(
          (1 - promo.promo_price / promo.original_price) * 100
        );
        const belowNormalPercent = Math.round(
          (1 - promo.promo_price / promo.product.reference_price) * 100
        );
        const endDate = new Date(promo.end_date);
        const today = new Date();
        const isExpiringSoon =
          endDate.getFullYear() === today.getFullYear() &&
          endDate.getMonth() === today.getMonth() &&
          endDate.getDate() === today.getDate();

        return {
          ...promo,
          discountPercent,
          belowNormalPercent: Math.max(0, belowNormalPercent),
          gamificationMessage: getGamificationMessage(discountPercent),
          distanceKm: 0,
          isExpiringSoon,
          isBestPrice: false,
        };
      })
      .sort((a, b) => b.discountPercent - a.discountPercent)
      .slice(0, 5);
  }, [raw]);

  return { deals, isLoading };
}
