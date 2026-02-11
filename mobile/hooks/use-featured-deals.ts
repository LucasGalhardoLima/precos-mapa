import { useMemo } from "react";
import { usePromotions } from "@/hooks/use-promotions";
import { DEMO_USER_LOCATION } from "@/constants/messages";
import type { EnrichedPromotion } from "@/types";

export function useFeaturedDeals() {
  const { promotions } = usePromotions({
    userLatitude: DEMO_USER_LOCATION.latitude,
    userLongitude: DEMO_USER_LOCATION.longitude,
  });

  const deals = useMemo((): EnrichedPromotion[] => {
    return [...promotions]
      .sort((a, b) => b.discountPercent - a.discountPercent)
      .slice(0, 5);
  }, [promotions]);

  return { deals };
}
