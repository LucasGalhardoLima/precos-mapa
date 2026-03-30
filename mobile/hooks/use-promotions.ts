import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useRealtime } from '@/hooks/use-realtime';
import { getGamificationMessage } from '@/constants/messages';
import { calculateDistanceKm } from '@/hooks/use-location';
import { useAuthStore } from '@poup/shared';
import type {
  PromotionWithRelations,
  EnrichedPromotion,
  SortMode,
  ProductWithPrices,
  StorePrice,
} from '@/types';

// ---------------------------------------------------------------------------
// Params
// ---------------------------------------------------------------------------

interface UsePromotionsParams {
  query?: string;
  productQuery?: string;
  categoryId?: string;
  storeId?: string;
  sortMode?: SortMode;
  userLatitude: number;
  userLongitude: number;
  /** 'store' groups cheapest per store (default); 'product' returns products with nested store prices */
  groupBy?: 'store' | 'product';
  /** Filter results to within this distance (km) */
  maxDistanceKm?: number;
  /** Filter results to products at or below this price */
  maxPrice?: number;
}

// ---------------------------------------------------------------------------
// Return type
// ---------------------------------------------------------------------------

interface UsePromotionsReturn {
  promotions: EnrichedPromotion[];
  /** Available only when groupBy === 'product' */
  productResults: ProductWithPrices[];
  isLoading: boolean;
  isEmpty: boolean;
  error: Error | null;
  retry: () => void;
}

// ---------------------------------------------------------------------------
// Enrichment helpers (store-grouped mode)
// ---------------------------------------------------------------------------

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
  const isHistoricLow = hasDiscount && promo.promo_price <= bestPrice && discountPercent >= 20;

  return {
    ...promo,
    discountPercent,
    belowNormalPercent: Math.max(0, belowNormalPercent),
    gamificationMessage: getGamificationMessage(discountPercent),
    distanceKm,
    isExpiringSoon,
    isBestPrice: hasDiscount && promo.promo_price <= bestPrice,
    isHistoricLow,
    isLocked: false,
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
      case 'discount':
        return b.discountPercent - a.discountPercent || a.promo_price - b.promo_price;
    }
  });
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function usePromotions(params: UsePromotionsParams): UsePromotionsReturn {
  const [raw, setRaw] = useState<PromotionWithRelations[]>([]);
  const [productRaw, setProductRaw] = useState<ProductWithPrices[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const {
    query,
    productQuery,
    categoryId,
    storeId,
    sortMode = 'cheapest',
    userLatitude,
    userLongitude,
    groupBy = 'store',
    maxDistanceKm,
    maxPrice,
  } = params;

  // ─── Product-grouped mode (RPC) ──────────────────────────────────
  const fetchProductGrouped = useCallback(async () => {
    if (!productQuery) {
      setProductRaw([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    const { data, error } = await supabase.rpc('search_products_with_prices', {
      query: productQuery,
      user_lat: userLatitude,
      user_lng: userLongitude,
      radius_km: maxDistanceKm ?? 10,
      category_id: categoryId && categoryId !== 'cat_todos' ? categoryId : null,
    });

    if (error) {
      console.warn('[usePromotions] search_products_with_prices RPC error:', error);
      setError(new Error(error.message));
      setProductRaw([]);
    } else {
      setError(null);
      let products = (data as ProductWithPrices[] | null) ?? [];
      // Apply max price filter client-side
      if (maxPrice != null) {
        products = products.filter(
          (p) => p.prices.length > 0 && p.prices[0].price <= maxPrice,
        );
      }
      // Apply plan-based locking
      const profile = useAuthStore.getState().profile;
      const isFree = profile?.b2c_plan === 'free';
      setProductRaw(
        products.map((p, index) => ({
          ...p,
          isLocked: isFree && index >= 3,
        }))
      );
    }

    setIsLoading(false);
  }, [productQuery, categoryId, userLatitude, userLongitude, maxDistanceKm, maxPrice]);

  // ─── Store-grouped mode (existing query) ─────────────────────────
  const fetchStoreGrouped = useCallback(async () => {
    setIsLoading(true);

    let q = supabase
      .from('promotions')
      .select('*, product:products!inner(*), store:stores!inner(*)')
      .eq('status', 'active')
      .gt('end_date', new Date().toISOString());

    if (query) {
      q = q.ilike('product.name', `%${query}%`);
    }

    if (productQuery) {
      q = q.ilike('product.name', `%${productQuery}%`);
    }

    if (categoryId && categoryId !== 'cat_todos') {
      q = q.eq('product.category_id', categoryId);
    }

    if (storeId) {
      q = q.eq('store_id', storeId);
    }

    const { data, error: fetchErr } = await q.order('promo_price', { ascending: true });

    if (fetchErr) {
      setError(new Error(fetchErr.message));
    } else {
      setError(null);
      if (data) setRaw(data as PromotionWithRelations[]);
    }
    setIsLoading(false);
  }, [query, productQuery, categoryId, storeId]);

  // ─── Fetch dispatcher ────────────────────────────────────────────
  useEffect(() => {
    if (groupBy === 'product') {
      fetchProductGrouped();
    } else {
      fetchStoreGrouped();
    }
  }, [groupBy, fetchProductGrouped, fetchStoreGrouped]);

  // Listen for realtime promotion changes (refetch whichever mode is active)
  useRealtime({
    table: 'promotions',
    onInsert: groupBy === 'product' ? fetchProductGrouped : fetchStoreGrouped,
    onUpdate: groupBy === 'product' ? fetchProductGrouped : fetchStoreGrouped,
    onDelete: groupBy === 'product' ? fetchProductGrouped : fetchStoreGrouped,
  });

  // ─── Store-grouped enrichment ────────────────────────────────────
  const enriched = useMemo(() => {
    if (groupBy === 'product') return [];

    const bestPriceMap = new Map<string, number>();
    for (const p of raw) {
      const current = bestPriceMap.get(p.product_id);
      if (current === undefined || p.promo_price < current) {
        bestPriceMap.set(p.product_id, p.promo_price);
      }
    }

    let items = raw.map((p) =>
      enrichPromotion(p, userLatitude, userLongitude, bestPriceMap)
    );
    if (maxDistanceKm != null) {
      items = items.filter((p) => p.distanceKm <= maxDistanceKm);
    }
    if (maxPrice != null) {
      items = items.filter((p) => p.promo_price <= maxPrice);
    }
    return items;
  }, [raw, userLatitude, userLongitude, groupBy, maxDistanceKm, maxPrice]);

  const sorted = useMemo(
    () => (groupBy === 'product' ? [] : sortPromotions(enriched, sortMode)),
    [enriched, sortMode, groupBy]
  );

  const final = useMemo(() => {
    if (groupBy === 'product') return [];

    // Group by store: keep cheapest per store when doing product search
    let grouped: EnrichedPromotion[];
    if (productQuery) {
      const storeMap = new Map<string, EnrichedPromotion>();
      for (const promo of sorted) {
        if (!storeMap.has(promo.store_id)) {
          storeMap.set(promo.store_id, promo);
        }
      }
      grouped = [...storeMap.values()];
    } else {
      grouped = sorted;
    }

    // Apply isLocked for free-plan users (4th+ result)
    const profile = useAuthStore.getState().profile;
    const isFree = profile?.b2c_plan === 'free';

    return grouped.map((promo, index) => ({
      ...promo,
      isLocked: isFree && index >= 3,
    }));
  }, [sorted, productQuery, groupBy]);

  // ─── Retry ──────────────────────────────────────────────────────
  const retry = useCallback(() => {
    setError(null);
    if (groupBy === 'product') {
      fetchProductGrouped();
    } else {
      fetchStoreGrouped();
    }
  }, [groupBy, fetchProductGrouped, fetchStoreGrouped]);

  // ─── Return ──────────────────────────────────────────────────────
  const isProductMode = groupBy === 'product';

  return {
    promotions: final,
    productResults: productRaw,
    isLoading,
    isEmpty: !isLoading && (isProductMode ? productRaw.length === 0 : final.length === 0),
    error,
    retry,
  };
}
