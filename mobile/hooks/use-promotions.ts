import { useState, useEffect, useMemo } from "react";
import { promotions } from "@/data/promotions";
import { products } from "@/data/products";
import { stores } from "@/data/stores";
import { getGamificationMessage } from "@/constants/messages";
import { calculateDistanceKm } from "@/hooks/use-location";
import type { EnrichedPromotion, SortMode } from "@/types";

interface UsePromotionsParams {
  query?: string;
  categoryId?: string;
  sortMode?: SortMode;
  userLatitude: number;
  userLongitude: number;
}

function enrichPromotions(
  userLat: number,
  userLon: number
): EnrichedPromotion[] {
  return promotions
    .filter((p) => p.status === "active")
    .map((promo) => {
      const product = products.find((p) => p.id === promo.productId);
      const store = stores.find((s) => s.id === promo.storeId);
      if (!product || !store) return null;

      const discountPercent = Math.round(
        (1 - promo.promoPrice / promo.originalPrice) * 100
      );
      const belowNormalPercent = Math.round(
        (1 - promo.promoPrice / product.referencePrice) * 100
      );
      const distanceKm = calculateDistanceKm(
        userLat,
        userLon,
        store.latitude,
        store.longitude
      );
      const hoursUntilEnd =
        (new Date(promo.endDate).getTime() - Date.now()) / 3600000;

      return {
        id: promo.id,
        product,
        store,
        originalPrice: promo.originalPrice,
        promoPrice: promo.promoPrice,
        startDate: promo.startDate,
        endDate: promo.endDate,
        verified: promo.verified,
        discountPercent,
        belowNormalPercent: Math.max(0, belowNormalPercent),
        gamificationMessage: getGamificationMessage(discountPercent),
        distanceKm,
        isExpiringSoon: hoursUntilEnd <= 24 && hoursUntilEnd > 0,
      } satisfies EnrichedPromotion;
    })
    .filter(Boolean) as EnrichedPromotion[];
}

function matchesQuery(
  promo: EnrichedPromotion,
  query: string
): boolean {
  const q = query.toLowerCase().trim();
  if (!q) return true;
  return (
    promo.product.name.toLowerCase().includes(q) ||
    (promo.product.brand?.toLowerCase().includes(q) ?? false)
  );
}

function sortPromotions(
  items: EnrichedPromotion[],
  mode: SortMode
): EnrichedPromotion[] {
  return [...items].sort((a, b) => {
    switch (mode) {
      case "cheapest":
        return a.promoPrice - b.promoPrice || a.distanceKm - b.distanceKm;
      case "nearest":
        return a.distanceKm - b.distanceKm || a.promoPrice - b.promoPrice;
      case "expiring":
        return (
          new Date(a.endDate).getTime() - new Date(b.endDate).getTime() ||
          a.promoPrice - b.promoPrice
        );
    }
  });
}

export function usePromotions(params: UsePromotionsParams) {
  const [isLoading, setIsLoading] = useState(true);
  const {
    query,
    categoryId,
    sortMode = "cheapest",
    userLatitude,
    userLongitude,
  } = params;

  const enriched = useMemo(
    () => enrichPromotions(userLatitude, userLongitude),
    [userLatitude, userLongitude]
  );

  const filtered = useMemo(() => {
    let result = enriched;

    if (query) {
      result = result.filter((p) => matchesQuery(p, query));
    }

    if (categoryId && categoryId !== "cat_todos") {
      result = result.filter((p) => p.product.category === categoryId);
    }

    return sortPromotions(result, sortMode);
  }, [enriched, query, categoryId, sortMode]);

  useEffect(() => {
    setIsLoading(true);
    const timer = setTimeout(() => setIsLoading(false), 300);
    return () => clearTimeout(timer);
  }, [query, categoryId, sortMode]);

  return {
    promotions: filtered,
    isLoading,
    isEmpty: !isLoading && filtered.length === 0,
  };
}
