import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useShoppingList } from '@/hooks/use-shopping-list';
import { useRealtime } from '@/hooks/use-realtime';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EconomySummary {
  totalSavings: number;
  cheapestStore: { id: string; name: string } | null;
  mode: 'list' | 'deals';
  itemCount: number;
}

interface UseEconomySummaryParams {
  userLatitude: number;
  userLongitude: number;
  radiusKm?: number;
}

const EMPTY_SUMMARY: EconomySummary = {
  totalSavings: 0,
  cheapestStore: null,
  mode: 'deals',
  itemCount: 0,
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useEconomySummary(params: UseEconomySummaryParams) {
  const { radiusKm: _radiusKm = 10 } = params;
  const { lists, isLoading: listsLoading } = useShoppingList();
  const [summary, setSummary] = useState<EconomySummary>(EMPTY_SUMMARY);
  const [isLoading, setIsLoading] = useState(true);

  // Flatten all list items to get every product_id the user cares about
  const allItems = lists.flatMap((l) => l.items);
  const hasItems = allItems.length > 0;

  // -------------------------------------------------------------------
  // List mode: savings = sum(reference_price - cheapest promo) per item
  // -------------------------------------------------------------------
  const calculateListMode = useCallback(async () => {
    const productIds = [...new Set(allItems.map((i) => i.product_id))];

    if (productIds.length === 0) return EMPTY_SUMMARY;

    // Fetch cheapest active promo per product
    const { data: promoRows } = await supabase
      .from('promotions')
      .select('product_id, promo_price, store_id, store:stores(id, name)')
      .in('product_id', productIds)
      .eq('status', 'active')
      .gt('end_date', new Date().toISOString());

    if (!promoRows || promoRows.length === 0) {
      return { ...EMPTY_SUMMARY, mode: 'list' as const, itemCount: allItems.length };
    }

    // Build cheapest promo per product
    const cheapestPromo = new Map<string, number>();
    // Track which store is cheapest for each product (for cheapestStore calc)
    const cheapestStorePerProduct = new Map<string, { id: string; name: string }>();

    for (const row of promoRows) {
      const current = cheapestPromo.get(row.product_id);
      if (current === undefined || row.promo_price < current) {
        cheapestPromo.set(row.product_id, row.promo_price);
        const store = row.store as any;
        cheapestStorePerProduct.set(row.product_id, {
          id: store?.id ?? row.store_id,
          name: store?.name ?? 'Loja',
        });
      }
    }

    // Fetch reference prices for the products
    const { data: products } = await supabase
      .from('products')
      .select('id, reference_price')
      .in('id', productIds);

    const refPriceMap = new Map<string, number>();
    if (products) {
      for (const p of products) {
        refPriceMap.set(p.id, p.reference_price);
      }
    }

    // Calculate total savings
    let totalSavings = 0;
    for (const productId of productIds) {
      const refPrice = refPriceMap.get(productId);
      const promoPrice = cheapestPromo.get(productId);
      if (refPrice !== undefined && promoPrice !== undefined && promoPrice < refPrice) {
        totalSavings += refPrice - promoPrice;
      }
    }

    // Cheapest store = store that appears most often as cheapest across items
    const storeFrequency = new Map<string, { count: number; store: { id: string; name: string } }>();
    for (const [, store] of cheapestStorePerProduct) {
      const entry = storeFrequency.get(store.id);
      if (entry) {
        entry.count += 1;
      } else {
        storeFrequency.set(store.id, { count: 1, store });
      }
    }

    let cheapestStore: { id: string; name: string } | null = null;
    let maxCount = 0;
    for (const [, { count, store }] of storeFrequency) {
      if (count > maxCount) {
        maxCount = count;
        cheapestStore = store;
      }
    }

    return {
      totalSavings,
      cheapestStore,
      mode: 'list' as const,
      itemCount: allItems.length,
    };
  }, [allItems]);

  // -------------------------------------------------------------------
  // Deals mode: total nearby discount; cheapest store = highest discount
  // -------------------------------------------------------------------
  const calculateDealsMode = useCallback(async () => {
    const { data: promoRows } = await supabase
      .from('promotions')
      .select('original_price, promo_price, store_id, store:stores(id, name)')
      .eq('status', 'active')
      .gt('end_date', new Date().toISOString());

    if (!promoRows || promoRows.length === 0) return EMPTY_SUMMARY;

    // Aggregate total discount per store
    const storeDiscountMap = new Map<
      string,
      { totalDiscount: number; store: { id: string; name: string }; dealCount: number }
    >();

    for (const row of promoRows) {
      const discount = row.original_price - row.promo_price;
      if (discount <= 0) continue;

      const store = row.store as any;
      const storeId: string = store?.id ?? row.store_id;
      const storeName: string = store?.name ?? 'Loja';

      const entry = storeDiscountMap.get(storeId);
      if (entry) {
        entry.totalDiscount += discount;
        entry.dealCount += 1;
      } else {
        storeDiscountMap.set(storeId, {
          totalDiscount: discount,
          store: { id: storeId, name: storeName },
          dealCount: 1,
        });
      }
    }

    // Find store with highest total discount
    let cheapestStore: { id: string; name: string } | null = null;
    let maxDiscount = 0;
    let totalSavings = 0;
    let itemCount = 0;

    for (const [, { totalDiscount, store, dealCount }] of storeDiscountMap) {
      totalSavings += totalDiscount;
      itemCount += dealCount;
      if (totalDiscount > maxDiscount) {
        maxDiscount = totalDiscount;
        cheapestStore = store;
      }
    }

    return {
      totalSavings,
      cheapestStore,
      mode: 'deals' as const,
      itemCount,
    };
  }, []);

  // -------------------------------------------------------------------
  // Main fetch
  // -------------------------------------------------------------------
  const calculate = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = hasItems
        ? await calculateListMode()
        : await calculateDealsMode();
      setSummary(result);
    } catch {
      setSummary(EMPTY_SUMMARY);
    } finally {
      setIsLoading(false);
    }
  }, [hasItems, calculateListMode, calculateDealsMode]);

  useEffect(() => {
    if (!listsLoading) {
      calculate();
    }
  }, [listsLoading, calculate]);

  // Re-calculate when promotions change in realtime
  useRealtime({
    table: 'promotions',
    onInsert: calculate,
    onUpdate: calculate,
    onDelete: calculate,
  });

  return { summary, isLoading: isLoading || listsLoading };
}
