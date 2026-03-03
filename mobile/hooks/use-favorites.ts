import { useState, useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
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

      const snapshot = [...favorites];

      const tempFavorite = {
        id: 'temp-' + Date.now(),
        user_id: userId,
        product_id: productId,
        created_at: new Date().toISOString(),
        product: { promotions: [] } as unknown as FavoriteWithProduct['product'],
      } as FavoriteWithProduct;

      setFavorites((prev) => [...prev, tempFavorite]);

      const { error } = await supabase
        .from('user_favorites')
        .insert({ user_id: userId, product_id: productId });

      if (error) {
        setFavorites(snapshot);
        if (error.message.includes('limit')) {
          throw new Error(
            'Limite de favoritos atingido. Faca upgrade para adicionar mais.'
          );
        }
        Alert.alert('Erro', 'Não foi possível atualizar os favoritos.');
        return;
      }

      fetchFavorites();
    },
    [userId, favorites, fetchFavorites]
  );

  const removeFavorite = useCallback(
    async (productId: string) => {
      if (!userId) return;

      const snapshot = [...favorites];

      setFavorites((prev) => prev.filter((f) => f.product_id !== productId));

      const { error } = await supabase
        .from('user_favorites')
        .delete()
        .eq('user_id', userId)
        .eq('product_id', productId);

      if (error) {
        setFavorites(snapshot);
        Alert.alert('Erro', 'Não foi possível atualizar os favoritos.');
        return;
      }

      fetchFavorites();
    },
    [userId, favorites, fetchFavorites]
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
