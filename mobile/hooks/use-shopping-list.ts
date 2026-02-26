import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@precomapa/shared';

interface ShoppingList {
  id: string;
  name: string;
  is_template: boolean;
  created_at: string;
  items: ShoppingListItem[];
}

interface ShoppingListItem {
  id: string;
  product_id: string;
  quantity: number;
  is_checked: boolean;
  product?: { name: string; brand: string | null };
}

interface OptimizedStore {
  storeId: string;
  storeName: string;
  items: { productName: string; price: number; quantity: number }[];
  subtotal: number;
}

interface OptimizationResult {
  stores: OptimizedStore[];
  totalCost: number;
  estimatedSavings: number;
  mapsUrl: string;
}

export function useShoppingList() {
  const session = useAuthStore((s) => s.session);
  const [lists, setLists] = useState<ShoppingList[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchLists = useCallback(async () => {
    if (!session?.user) return;

    const { data } = await supabase
      .from('shopping_lists')
      .select('id, name, is_template, created_at, items:shopping_list_items(id, product_id, quantity, is_checked, product:products(name, brand))')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false });

    if (data) setLists(data as unknown as ShoppingList[]);
    setIsLoading(false);
  }, [session]);

  useEffect(() => {
    fetchLists();
  }, [fetchLists]);

  const createList = useCallback(
    async (name: string): Promise<string | null> => {
      if (!session?.user) return null;

      const { data, error } = await supabase
        .from('shopping_lists')
        .insert({ user_id: session.user.id, name })
        .select('id')
        .single();

      if (error || !data) return null;
      await fetchLists();
      return data.id;
    },
    [session, fetchLists],
  );

  const addItem = useCallback(
    async (listId: string, productId: string, quantity: number = 1) => {
      await supabase
        .from('shopping_list_items')
        .insert({ list_id: listId, product_id: productId, quantity });
      await fetchLists();
    },
    [fetchLists],
  );

  const toggleItem = useCallback(
    async (itemId: string, isChecked: boolean) => {
      await supabase
        .from('shopping_list_items')
        .update({ is_checked: isChecked })
        .eq('id', itemId);
      await fetchLists();
    },
    [fetchLists],
  );

  const removeItem = useCallback(
    async (itemId: string) => {
      await supabase.from('shopping_list_items').delete().eq('id', itemId);
      await fetchLists();
    },
    [fetchLists],
  );

  const deleteList = useCallback(
    async (listId: string) => {
      await supabase.from('shopping_lists').delete().eq('id', listId);
      await fetchLists();
    },
    [fetchLists],
  );

  const optimizeList = useCallback(
    async (
      listId: string,
      userLat: number,
      userLng: number,
    ): Promise<OptimizationResult | null> => {
      const list = lists.find((l) => l.id === listId);
      if (!list || list.items.length === 0) return null;

      const productIds = list.items.map((i) => i.product_id);

      // Fetch all active promotions for the products
      const { data: promotions } = await supabase
        .from('promotions')
        .select('product_id, promo_price, store_id, store:stores(id, name, latitude, longitude)')
        .in('product_id', productIds)
        .eq('status', 'active')
        .gt('end_date', new Date().toISOString());

      if (!promotions?.length) return null;

      // Greedy: for each product, pick the cheapest store
      const storeMap = new Map<string, OptimizedStore>();
      let totalCost = 0;

      for (const item of list.items) {
        const productPromos = promotions.filter(
          (p: any) => p.product_id === item.product_id,
        );

        if (productPromos.length === 0) continue;

        // Find cheapest
        const cheapest = productPromos.reduce((a: any, b: any) =>
          a.promo_price < b.promo_price ? a : b,
        );

        const store = cheapest.store as any;
        const storeId = store?.id ?? cheapest.store_id;
        const storeName = store?.name ?? 'Loja';

        const entry = storeMap.get(storeId) ?? {
          storeId,
          storeName,
          items: [],
          subtotal: 0,
        };

        const itemCost = cheapest.promo_price * item.quantity;
        entry.items.push({
          productName: item.product?.name ?? 'Produto',
          price: cheapest.promo_price,
          quantity: item.quantity,
        });
        entry.subtotal += itemCost;
        totalCost += itemCost;

        storeMap.set(storeId, entry);
      }

      // Estimate savings (vs buying everything at nearest store)
      const estimatedSavings = Math.max(0, totalCost * 0.15); // Rough estimate

      // Build Google Maps URL with waypoints
      const stores = [...storeMap.values()];
      const waypoints = stores
        .map((s) => {
          const promo = promotions.find(
            (p: any) => (p.store as any)?.id === s.storeId,
          );
          const lat = (promo?.store as any)?.latitude;
          const lng = (promo?.store as any)?.longitude;
          return lat && lng ? `${lat},${lng}` : null;
        })
        .filter(Boolean);

      const mapsUrl =
        waypoints.length > 0
          ? `https://www.google.com/maps/dir/${userLat},${userLng}/${waypoints.join('/')}?optimize=true`
          : '';

      return { stores, totalCost, estimatedSavings, mapsUrl };
    },
    [lists],
  );

  return {
    lists,
    isLoading,
    createList,
    addItem,
    toggleItem,
    removeItem,
    deleteList,
    optimizeList,
    refresh: fetchLists,
  };
}
