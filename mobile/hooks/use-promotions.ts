import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useRealtime } from '@/hooks/use-realtime';
import { getGamificationMessage } from '@/constants/messages';
import { calculateDistanceKm } from '@/hooks/use-location';
import type { PromotionWithRelations, EnrichedPromotion, SortMode } from '@/types';

interface UsePromotionsParams {
  query?: string;
  categoryId?: string;
  sortMode?: SortMode;
  userLatitude: number;
  userLongitude: number;
}

function enrichPromotion(
  promo: PromotionWithRelations,
  userLat: number,
  userLon: number,
  bestPriceMap: Map<string, number>
): EnrichedPromotion {
  const discountPercent = Math.round(
    (1 - promo.promo_price / promo.original_price) * 100
  );
  const belowNormalPercent = Math.round(
    (1 - promo.promo_price / promo.product.reference_price) * 100
  );
  const distanceKm = calculateDistanceKm(
    userLat,
    userLon,
    promo.store.latitude,
    promo.store.longitude
  );
  const endDate = new Date(promo.end_date);
  const today = new Date();
  const isExpiringSoon =
    endDate.getFullYear() === today.getFullYear() &&
    endDate.getMonth() === today.getMonth() &&
    endDate.getDate() === today.getDate();

  const bestPrice = bestPriceMap.get(promo.product_id) ?? promo.promo_price;
  const hasDiscount = promo.promo_price < promo.original_price;

  return {
    ...promo,
    discountPercent,
    belowNormalPercent: Math.max(0, belowNormalPercent),
    gamificationMessage: getGamificationMessage(discountPercent),
    distanceKm,
    isExpiringSoon,
    isBestPrice: hasDiscount && promo.promo_price <= bestPrice,
  };
}

function sortPromotions(
  items: EnrichedPromotion[],
  mode: SortMode
): EnrichedPromotion[] {
  return [...items].sort((a, b) => {
    // Paid stores always first
    const priorityDiff = (b.store.search_priority ?? 0) - (a.store.search_priority ?? 0);
    if (priorityDiff !== 0) return priorityDiff;

    switch (mode) {
      case 'cheapest':
        return a.promo_price - b.promo_price || a.distanceKm - b.distanceKm;
      case 'nearest':
        return a.distanceKm - b.distanceKm || a.promo_price - b.promo_price;
      case 'expiring':
        return (
          new Date(a.end_date).getTime() - new Date(b.end_date).getTime() ||
          a.promo_price - b.promo_price
        );
    }
  });
}

export function usePromotions(params: UsePromotionsParams) {
  const [raw, setRaw] = useState<PromotionWithRelations[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const {
    query,
    categoryId,
    sortMode = 'cheapest',
    userLatitude,
    userLongitude,
  } = params;

  const fetchPromotions = useCallback(async () => {
    setIsLoading(true);

    let q = supabase
      .from('promotions')
      .select('*, product:products!inner(*), store:stores!inner(*)')
      .eq('status', 'active')
      .gt('end_date', new Date().toISOString());

    if (query) {
      q = q.ilike('product.name', `%${query}%`);
    }

    if (categoryId && categoryId !== 'cat_todos') {
      q = q.eq('product.category_id', categoryId);
    }

    const { data } = await q.order('promo_price', { ascending: true });

    if (data) setRaw(data as PromotionWithRelations[]);
    setIsLoading(false);
  }, [query, categoryId]);

  useEffect(() => {
    fetchPromotions();
  }, [fetchPromotions]);

  // Listen for realtime promotion changes
  useRealtime({
    table: 'promotions',
    onInsert: fetchPromotions,
    onUpdate: fetchPromotions,
    onDelete: fetchPromotions,
  });

  const enriched = useMemo(() => {
    // Build best price map per product
    const bestPriceMap = new Map<string, number>();
    for (const p of raw) {
      const current = bestPriceMap.get(p.product_id);
      if (current === undefined || p.promo_price < current) {
        bestPriceMap.set(p.product_id, p.promo_price);
      }
    }

    return raw.map((p) =>
      enrichPromotion(p, userLatitude, userLongitude, bestPriceMap)
    );
  }, [raw, userLatitude, userLongitude]);

  const sorted = useMemo(
    () => sortPromotions(enriched, sortMode),
    [enriched, sortMode]
  );

  return {
    promotions: sorted,
    isLoading,
    isEmpty: !isLoading && sorted.length === 0,
  };
}
