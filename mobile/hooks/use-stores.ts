import { useMemo } from "react";
import { stores } from "@/data/stores";
import { promotions } from "@/data/promotions";
import { products } from "@/data/products";
import { calculateDistanceKm } from "@/hooks/use-location";
import { getGamificationMessage } from "@/constants/messages";
import type { StoreWithPromotions, EnrichedPromotion } from "@/types";

interface UseStoresParams {
  userLatitude: number;
  userLongitude: number;
}

export function useStores(params: UseStoresParams) {
  const { userLatitude, userLongitude } = params;

  const storesWithPromotions = useMemo((): StoreWithPromotions[] => {
    return stores.map((store) => {
      const distanceKm = calculateDistanceKm(
        userLatitude,
        userLongitude,
        store.latitude,
        store.longitude
      );

      const storePromos = promotions
        .filter((p) => p.storeId === store.id && p.status === "active")
        .map((promo) => {
          const product = products.find((p) => p.id === promo.productId);
          if (!product) return null;

          const discountPercent = Math.round(
            (1 - promo.promoPrice / promo.originalPrice) * 100
          );
          const belowNormalPercent = Math.max(
            0,
            Math.round((1 - promo.promoPrice / product.referencePrice) * 100)
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
            belowNormalPercent,
            gamificationMessage: getGamificationMessage(discountPercent),
            distanceKm,
            isExpiringSoon: hoursUntilEnd <= 24 && hoursUntilEnd > 0,
          } satisfies EnrichedPromotion;
        })
        .filter(Boolean) as EnrichedPromotion[];

      const topDeals = storePromos
        .sort((a, b) => b.discountPercent - a.discountPercent)
        .slice(0, 3);

      return {
        store,
        activePromotionCount: storePromos.length,
        topDeals,
        distanceKm,
      };
    });
  }, [userLatitude, userLongitude]);

  return {
    stores: storesWithPromotions,
    isLoading: false,
  };
}
