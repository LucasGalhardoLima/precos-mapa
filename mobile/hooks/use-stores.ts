import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { calculateDistanceKm } from '@/hooks/use-location';
import { getGamificationMessage } from '@/constants/messages';
import type { Store, StoreWithPromotions, EnrichedPromotion, PromotionWithRelations } from '@/types';

const DEFAULT_PAGE_SIZE = 20;

interface UseStoresParams {
  userLatitude: number;
  userLongitude: number;
  pageSize?: number;
}

export function useStores(params: UseStoresParams) {
  const { userLatitude, userLongitude, pageSize = DEFAULT_PAGE_SIZE } = params;
  const [raw, setRaw] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const offsetRef = useRef(0);

  const fetchPage = useCallback(async (offset: number, append: boolean) => {
    if (append) {
      setIsLoadingMore(true);
    } else {
      setIsLoading(true);
    }
    setError(null);

    const { data, error: fetchErr } = await supabase
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
      .gt('promotions.end_date', new Date().toISOString())
      .range(offset, offset + pageSize - 1);

    if (fetchErr) {
      setError(new Error(fetchErr.message));
    } else if (data) {
      setRaw((prev) => (append ? [...prev, ...data] : data));
      setHasMore(data.length >= pageSize);
      offsetRef.current = offset + data.length;
    }

    if (append) {
      setIsLoadingMore(false);
    } else {
      setIsLoading(false);
    }
  }, [pageSize]);

  useEffect(() => {
    offsetRef.current = 0;
    setRaw([]);
    setHasMore(true);
    fetchPage(0, false);
  }, [fetchPage]);

  const loadMore = useCallback(() => {
    if (!hasMore || isLoadingMore) return;
    fetchPage(offsetRef.current, true);
  }, [hasMore, isLoadingMore, fetchPage]);

  const retry = useCallback(() => {
    offsetRef.current = 0;
    setRaw([]);
    setHasMore(true);
    fetchPage(0, false);
  }, [fetchPage]);

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
            isHistoricLow: false,
            isLocked: false,
          } as EnrichedPromotion;
        });

      const topDeals = [...storePromos]
        .sort((a, b) => b.discountPercent - a.discountPercent)
        .slice(0, 5);

      const countByCategory: Record<string, number> = {};
      for (const promo of storePromos) {
        const catId = promo.product.category_id;
        countByCategory[catId] = (countByCategory[catId] ?? 0) + 1;
      }

      return {
        store: store as Store,
        activePromotionCount: storePromos.length,
        topDeals,
        distanceKm,
        promotionCountByCategory: countByCategory,
      };
    });
  }, [raw, userLatitude, userLongitude]);

  return { stores, isLoading, isLoadingMore, hasMore, loadMore, error, retry };
}
