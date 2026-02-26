import { View, Text, FlatList, Pressable, Alert } from 'react-native';
import { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MotiView } from 'moti';
import { Heart, MapPin, Star, Crown } from 'lucide-react-native';
import { useFavorites } from '@/hooks/use-favorites';
import { useAuthStore } from '@precomapa/shared';
import { Paywall } from '@/components/paywall';
import { Colors } from '@/constants/colors';
import type { FavoriteWithProduct } from '@/types';

const FREE_FAVORITE_LIMIT = 10;

export default function FavoritesScreen() {
  const { favorites, isLoading, remove, count } = useFavorites();
  const profile = useAuthStore((s) => s.profile);
  const isFree = profile?.b2c_plan === 'free';
  const [showPaywall, setShowPaywall] = useState(false);
  const limitReached = isFree && count >= FREE_FAVORITE_LIMIT;

  const handleRemove = (productId: string, productName: string) => {
    Alert.alert(
      'Remover favorito',
      `Deseja remover "${productName}" dos favoritos?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover',
          style: 'destructive',
          onPress: () => remove(productId),
        },
      ]
    );
  };

  const renderItem = ({ item, index }: { item: FavoriteWithProduct; index: number }) => {
    const activePromos = (item.product.promotions || []).filter(
      (p: any) => p.status === 'active'
    );
    const bestPromo = activePromos.sort(
      (a: any, b: any) => a.promo_price - b.promo_price
    )[0];

    return (
      <MotiView
        from={{ opacity: 0, translateY: 12 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: 'timing', duration: 300, delay: index * 50 }}
      >
        <Pressable
          className="bg-white rounded-2xl border border-border p-4 flex-row items-center active:opacity-80"
          onLongPress={() => handleRemove(item.product_id, item.product.name)}
        >
          <Heart
            size={20}
            color={Colors.semantic.error}
            fill={Colors.semantic.error}
          />

          <View className="flex-1 ml-3">
            <Text className="text-base font-semibold text-text-primary">
              {item.product.name}
            </Text>
            {item.product.brand && (
              <Text className="text-xs text-text-tertiary">
                {item.product.brand}
              </Text>
            )}
            {bestPromo?.store && (
              <View className="flex-row items-center gap-1 mt-1">
                <MapPin size={10} color={Colors.text.tertiary} />
                <Text className="text-xs text-text-secondary">
                  {(bestPromo.store as any).name}
                </Text>
              </View>
            )}
          </View>

          <View className="items-end">
            {bestPromo ? (
              <>
                <Text className="text-lg font-bold text-brand-green">
                  R$ {bestPromo.promo_price.toFixed(2)}
                </Text>
                <Text className="text-[10px] text-text-tertiary">
                  melhor preco
                </Text>
              </>
            ) : (
              <Text className="text-sm text-text-tertiary">Sem oferta</Text>
            )}
          </View>
        </Pressable>
      </MotiView>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-surface-secondary" edges={['top']}>
      <View className="px-4 pt-6 pb-3">
        <Text className="text-2xl font-bold text-text-primary">
          Seus Favoritos
        </Text>
        <Text className="text-sm text-text-secondary mt-1">
          Produtos que voce esta acompanhando
        </Text>
        {isFree && (
          <Pressable
            onPress={() => limitReached && setShowPaywall(true)}
            className="bg-brand-green/10 rounded-lg px-3 py-1.5 mt-2 flex-row items-center gap-1.5 self-start"
          >
            <Text className="text-xs font-semibold text-brand-green">
              {count}/{FREE_FAVORITE_LIMIT} favoritos
            </Text>
            {limitReached && (
              <Crown size={12} color={Colors.brand.green} />
            )}
          </Pressable>
        )}
        {limitReached && (
          <Pressable
            onPress={() => setShowPaywall(true)}
            className="bg-semantic-warning/10 rounded-xl px-4 py-3 mt-2 flex-row items-center gap-2"
          >
            <Crown size={16} color={Colors.brand.orange} />
            <Text className="text-xs text-text-secondary flex-1">
              Limite de favoritos atingido.{' '}
              <Text className="text-brand-green font-semibold">
                Faca upgrade
              </Text>{' '}
              para favoritos ilimitados.
            </Text>
          </Pressable>
        )}
      </View>

      {isLoading ? (
        <View className="gap-3 px-4 mt-2">
          {[0, 1, 2].map((i) => (
            <MotiView
              key={i}
              from={{ opacity: 0.4 }}
              animate={{ opacity: 1 }}
              transition={{ type: 'timing', duration: 800, loop: true }}
              className="bg-white rounded-2xl border border-border p-4 flex-row items-center gap-3"
            >
              <View className="w-5 h-5 bg-border rounded-full" />
              <View className="flex-1 gap-1.5">
                <View className="bg-border rounded-lg h-4 w-3/4" />
                <View className="bg-border rounded-lg h-3 w-1/2" />
              </View>
              <View className="bg-border rounded-lg h-6 w-16" />
            </MotiView>
          ))}
        </View>
      ) : !isLoading && favorites.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <Star size={48} color={Colors.text.tertiary} />
          <Text className="text-lg font-semibold text-text-primary mt-4">
            Nenhum favorito ainda
          </Text>
          <Text className="text-sm text-text-secondary text-center mt-2">
            Adicione produtos aos favoritos para acompanhar os melhores precos
          </Text>
        </View>
      ) : (
        <FlatList
          data={favorites}
          keyExtractor={(item) => item.id}
          contentContainerClassName="gap-3 px-4 pb-4"
          renderItem={renderItem}
        />
      )}
      <Paywall visible={showPaywall} onClose={() => setShowPaywall(false)} />
    </SafeAreaView>
  );
}
