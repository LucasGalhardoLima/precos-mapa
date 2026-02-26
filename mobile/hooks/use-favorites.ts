import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@precomapa/shared';
import type { FavoriteWithProduct } from '@/types';

export function useFavorites() {
  const [favorites, setFavorites] = useState<FavoriteWithProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const session = useAuthStore((s) => s.session);
  const userId = session?.user?.id;

  const fetchFavorites = useCallback(async () => {
    if (!userId) {
      setFavorites([]);
      setIsLoading(false);
      return;
    }

    const { data } = await supabase
      .from('user_favorites')
      .select('*, product:products(*, promotions(*, store:stores(*)))')
      .eq('user_id', userId);

    if (data) setFavorites(data as FavoriteWithProduct[]);
    setIsLoading(false);
  }, [userId]);

  useEffect(() => {
    fetchFavorites();
  }, [fetchFavorites]);

  const addFavorite = useCallback(
    async (productId: string) => {
      if (!userId) return;

      const { error } = await supabase
        .from('user_favorites')
        .insert({ user_id: userId, product_id: productId });

      if (error) {
        // RLS check_favorite_limit will throw if over limit
        throw new Error(
          error.message.includes('limit')
            ? 'Limite de favoritos atingido. Faca upgrade para adicionar mais.'
            : error.message
        );
      }

      await fetchFavorites();
    },
    [userId, fetchFavorites]
  );

  const removeFavorite = useCallback(
    async (productId: string) => {
      if (!userId) return;

      await supabase
        .from('user_favorites')
        .delete()
        .eq('user_id', userId)
        .eq('product_id', productId);

      await fetchFavorites();
    },
    [userId, fetchFavorites]
  );

  const isFavorited = useCallback(
    (productId: string) => {
      return favorites.some((f) => f.product_id === productId);
    },
    [favorites]
  );

  return {
    favorites,
    isLoading,
    add: addFavorite,
    remove: removeFavorite,
    isFavorited,
    count: favorites.length,
  };
}
