import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  Alert,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MotiView } from 'moti';
import { Heart, MapPin, Star, Crown } from 'lucide-react-native';
import { useFavorites } from '@/hooks/use-favorites';
import { useAuthStore } from '@precomapa/shared';
import { useTheme } from '@/theme/use-theme';
import { Paywall } from '@/components/paywall';
import type { FavoriteWithProduct } from '@/types';

const FREE_FAVORITE_LIMIT = 10;

export default function FavoritesScreen() {
  const { tokens } = useTheme();
  const { favorites, isLoading, remove, count, refresh } = useFavorites();
  const profile = useAuthStore((s) => s.profile);
  const isFree = profile?.b2c_plan === 'free';
  const [showPaywall, setShowPaywall] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const limitReached = isFree && count >= FREE_FAVORITE_LIMIT;

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

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
          style={[styles.card, { backgroundColor: tokens.surface, borderColor: tokens.border }]}
          onLongPress={() => handleRemove(item.product_id, item.product.name)}
          accessibilityLabel={`${item.product.name}${bestPromo ? `, R$ ${bestPromo.promo_price.toFixed(2)}` : ''}, segure para remover`}
          accessibilityRole="button"
        >
          <Heart size={20} color={tokens.danger} fill={tokens.danger} />

          <View style={styles.cardContent}>
            <Text style={[styles.productName, { color: tokens.textPrimary }]}>
              {item.product.name}
            </Text>
            {item.product.brand && (
              <Text style={[styles.brandText, { color: tokens.textHint }]}>
                {item.product.brand}
              </Text>
            )}
            {bestPromo?.store && (
              <View style={styles.storeRow}>
                <MapPin size={10} color={tokens.textHint} />
                <Text style={[styles.storeText, { color: tokens.textSecondary }]}>
                  {(bestPromo.store as any).name}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.priceCol}>
            {bestPromo ? (
              <>
                <Text style={[styles.promoPrice, { color: tokens.primary }]}>
                  R$ {bestPromo.promo_price.toFixed(2)}
                </Text>
                <Text style={[styles.bestPriceLabel, { color: tokens.textHint }]}>
                  melhor preço
                </Text>
              </>
            ) : (
              <Text style={[styles.noOfferText, { color: tokens.textHint }]}>
                Sem oferta
              </Text>
            )}
          </View>
        </Pressable>
      </MotiView>
    );
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: tokens.bg }]} edges={['top']}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: tokens.textPrimary }]}>
          Seus Favoritos
        </Text>
        <Text style={[styles.subtitle, { color: tokens.textSecondary }]}>
          Produtos que você está acompanhando
        </Text>
        {isFree && (
          <Pressable
            onPress={() => limitReached && setShowPaywall(true)}
            accessibilityLabel={`${count} de ${FREE_FAVORITE_LIMIT} favoritos usados`}
            accessibilityRole={limitReached ? 'button' : undefined}
            style={[styles.limitBadge, { backgroundColor: tokens.primaryMuted }]}
          >
            <Text style={[styles.limitText, { color: tokens.primary }]}>
              {count}/{FREE_FAVORITE_LIMIT} favoritos
            </Text>
            {limitReached && <Crown size={12} color={tokens.primary} />}
          </Pressable>
        )}
        {limitReached && (
          <Pressable
            onPress={() => setShowPaywall(true)}
            accessibilityLabel="Fazer upgrade para favoritos ilimitados"
            accessibilityRole="button"
            style={[styles.upgradeBanner, { backgroundColor: tokens.accentSoft }]}
          >
            <Crown size={16} color={tokens.accent} />
            <Text style={[styles.upgradeText, { color: tokens.textSecondary }]}>
              Limite de favoritos atingido.{' '}
              <Text style={{ color: tokens.primary, fontWeight: '600' }}>
                Faça upgrade
              </Text>{' '}
              para favoritos ilimitados.
            </Text>
          </Pressable>
        )}
      </View>

      {isLoading ? (
        <View style={styles.skeletonList}>
          {[0, 1, 2].map((i) => (
            <MotiView
              key={i}
              from={{ opacity: 0.4 }}
              animate={{ opacity: 1 }}
              transition={{ type: 'timing', duration: 800, loop: true }}
              style={[styles.card, { backgroundColor: tokens.surface, borderColor: tokens.border }]}
            >
              <View style={[styles.skeletonIcon, { backgroundColor: tokens.border }]} />
              <View style={styles.skeletonLines}>
                <View style={[styles.skeletonLine, styles.skeletonLineLong, { backgroundColor: tokens.border }]} />
                <View style={[styles.skeletonLine, styles.skeletonLineHalf, { backgroundColor: tokens.border }]} />
              </View>
              <View style={[styles.skeletonPrice, { backgroundColor: tokens.border }]} />
            </MotiView>
          ))}
        </View>
      ) : favorites.length === 0 ? (
        <View style={styles.emptyState}>
          <Star size={48} color={tokens.textHint} />
          <Text style={[styles.emptyTitle, { color: tokens.textPrimary }]}>
            Nenhum favorito ainda
          </Text>
          <Text style={[styles.emptySubtitle, { color: tokens.textSecondary }]}>
            Adicione produtos aos favoritos para acompanhar os melhores preços
          </Text>
        </View>
      ) : (
        <FlatList
          data={favorites}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={renderItem}
          keyboardDismissMode="on-drag"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={tokens.primary} />
          }
        />
      )}
      <Paywall visible={showPaywall} onClose={() => setShowPaywall(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { paddingHorizontal: 16, paddingTop: 24, paddingBottom: 12 },
  title: { fontSize: 24, fontWeight: '700' },
  subtitle: { fontSize: 14, marginTop: 4 },
  limitBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: 8,
  },
  limitText: { fontSize: 12, fontWeight: '600' },
  upgradeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: 8,
  },
  upgradeText: { fontSize: 12, flex: 1 },
  listContent: { gap: 12, paddingHorizontal: 16, paddingBottom: 16 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  cardContent: { flex: 1 },
  productName: { fontSize: 15, fontWeight: '600' },
  brandText: { fontSize: 12, marginTop: 2 },
  storeRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  storeText: { fontSize: 12 },
  priceCol: { alignItems: 'flex-end' },
  promoPrice: { fontSize: 18, fontWeight: '700' },
  bestPriceLabel: { fontSize: 10, marginTop: 2 },
  noOfferText: { fontSize: 14 },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: { fontSize: 18, fontWeight: '600', marginTop: 16 },
  emptySubtitle: { fontSize: 14, textAlign: 'center', marginTop: 8 },
  skeletonList: { gap: 12, paddingHorizontal: 16, marginTop: 8 },
  skeletonIcon: { width: 20, height: 20, borderRadius: 10 },
  skeletonLines: { flex: 1, gap: 6 },
  skeletonLine: { borderRadius: 8, height: 16 },
  skeletonLineLong: { width: '75%' },
  skeletonLineHalf: { width: '50%', height: 12 },
  skeletonPrice: { width: 64, height: 24, borderRadius: 8 },
});
