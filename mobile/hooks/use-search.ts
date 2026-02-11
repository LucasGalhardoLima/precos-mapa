import { useState, useEffect, useMemo } from "react";
import { usePromotions } from "@/hooks/use-promotions";
import { DEMO_USER_LOCATION } from "@/constants/messages";
import { products } from "@/data/products";

export function useSearch(query: string) {
  const [isSearching, setIsSearching] = useState(false);

  const { promotions } = usePromotions({
    query,
    userLatitude: DEMO_USER_LOCATION.latitude,
    userLongitude: DEMO_USER_LOCATION.longitude,
  });

  const suggestions = useMemo(() => {
    if (!query || query.length < 2) return [];
    const q = query.toLowerCase().trim();
    const matches = products
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.brand?.toLowerCase().includes(q) ?? false)
      )
      .map((p) => p.name);
    return [...new Set(matches)].slice(0, 5);
  }, [query]);

  useEffect(() => {
    if (!query) {
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    const timer = setTimeout(() => setIsSearching(false), 200);
    return () => clearTimeout(timer);
  }, [query]);

  return {
    results: promotions,
    suggestions,
    isSearching,
  };
}
