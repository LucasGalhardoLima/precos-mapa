import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StoreRankEntry {
  id: string;
  name: string;
  totalPrice: number;
  savingsPercent: number;
  rank: 1 | 2 | 3;
}

export interface StoreRanking {
  stores: StoreRankEntry[];
  city: string;
  basketLabel: string;
}

interface UseStoreRankingParams {
  userLatitude: number;
  userLongitude: number;
  radiusKm?: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Reference basket of common Brazilian grocery staples */
export const REFERENCE_BASKET = [
  'Arroz',
  'Feijão',
  'Óleo',
  'Açúcar',
  'Leite',
  'Café',
  'Farinha',
  'Sal',
] as const;

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useStoreRanking(params: UseStoreRankingParams) {
  const { userLatitude, userLongitude, radiusKm: _radiusKm = 15 } = params;
  const [ranking, setRanking] = useState<StoreRanking | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Simple timestamp-based cache
  const cacheRef = useRef<{ data: StoreRanking; timestamp: number } | null>(null);

  const fetchRanking = useCallback(async () => {
    // Return cached data if still fresh
    if (cacheRef.current && Date.now() - cacheRef.current.timestamp < CACHE_TTL_MS) {
      setRanking(cacheRef.current.data);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    try {
      // Fetch active promotions with product and store data
      const { data: promoRows } = await supabase
        .from('promotions')
        .select('product_id, promo_price, store_id, product:products(name), store:stores(id, name)')
        .eq('status', 'active')
        .gt('end_date', new Date().toISOString());

      if (!promoRows || promoRows.length === 0) {
        setRanking(null);
        setIsLoading(false);
        return;
      }

      // Filter for promotions whose product name matches any basket item (case-insensitive)
      const basketPromos = promoRows.filter((row) => {
        const productName: string = (row.product as any)?.name ?? '';
        return REFERENCE_BASKET.some((item) =>
          productName.toLowerCase().includes(item.toLowerCase()),
        );
      });

      if (basketPromos.length === 0) {
        setRanking(null);
        setIsLoading(false);
        return;
      }

      // Group by store, then find cheapest price per basket item per store
      // storeMap: storeId -> { name, basketPrices: Map<basketItem, cheapestPrice> }
      const storeMap = new Map<
        string,
        { name: string; basketPrices: Map<string, number> }
      >();

      for (const promo of basketPromos) {
        const store = promo.store as any;
        const storeId: string = store?.id ?? promo.store_id;
        const storeName: string = store?.name ?? 'Loja';
        const productName: string = (promo.product as any)?.name ?? '';

        // Determine which basket item this product matches
        const matchedItem = REFERENCE_BASKET.find((item) =>
          productName.toLowerCase().includes(item.toLowerCase()),
        );
        if (!matchedItem) continue;

        if (!storeMap.has(storeId)) {
          storeMap.set(storeId, { name: storeName, basketPrices: new Map() });
        }

        const entry = storeMap.get(storeId)!;
        const current = entry.basketPrices.get(matchedItem);
        if (current === undefined || promo.promo_price < current) {
          entry.basketPrices.set(matchedItem, promo.promo_price);
        }
      }

      // Only include stores that have at least 3 of the 8 basket items
      const MIN_ITEMS = 3;
      const storeEntries: { id: string; name: string; totalPrice: number }[] = [];

      for (const [storeId, { name, basketPrices }] of storeMap) {
        if (basketPrices.size < MIN_ITEMS) continue;

        let totalPrice = 0;
        for (const [, price] of basketPrices) {
          totalPrice += price;
        }

        storeEntries.push({ id: storeId, name, totalPrice });
      }

      if (storeEntries.length === 0) {
        setRanking(null);
        setIsLoading(false);
        return;
      }

      // Sort by total ascending, take top 3
      storeEntries.sort((a, b) => a.totalPrice - b.totalPrice);
      const top3 = storeEntries.slice(0, 3);

      // Calculate savingsPercent relative to the most expensive of the top 3
      const highestPrice = top3[top3.length - 1].totalPrice;

      const stores: StoreRankEntry[] = top3.map((entry, index) => ({
        id: entry.id,
        name: entry.name,
        totalPrice: Math.round(entry.totalPrice * 100) / 100,
        savingsPercent:
          highestPrice > 0
            ? Math.round((1 - entry.totalPrice / highestPrice) * 100)
            : 0,
        rank: (index + 1) as 1 | 2 | 3,
      }));

      const result: StoreRanking = {
        stores,
        city: 'sua região',
        basketLabel: 'lista base',
      };

      // Update cache
      cacheRef.current = { data: result, timestamp: Date.now() };

      setRanking(result);
    } catch {
      setRanking(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRanking();
  }, [fetchRanking]);

  return { ranking, isLoading };
}
