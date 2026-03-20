import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  Platform,
  Linking,
} from 'react-native';
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { forwardRef, useMemo, useCallback } from 'react';
import { useRouter } from 'expo-router';
import { Navigation2, MapPin } from 'lucide-react-native';
import type { StoreWithPromotions, EnrichedPromotion } from '@/types';
import type { PinRank } from '@/components/map-store-pin';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ShoppingListSummary {
  itemCount: number;
  availableCount: number;
  total: number;
  isCheapest: boolean;
}

interface MapStoreSheetProps {
  storeData: StoreWithPromotions | null;
  rank?: PinRank;
  position?: number;
  listSummary?: ShoppingListSummary | null;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

const MEDAL_EMOJIS = ['🥇', '🥈', '🥉'];

const RANK_LABELS: Record<PinRank, string> = {
  green: 'Mais barato',
  yellow: 'Preço médio',
  red: 'Mais caro',
};

const RANK_BADGE_COLORS: Record<PinRank, { bg: string; text: string }> = {
  green: { bg: '#DCFCE7', text: '#15803D' },
  yellow: { bg: '#FEF3C7', text: '#B45309' },
  red: { bg: '#FEE2E2', text: '#B91C1C' },
};

// ---------------------------------------------------------------------------
// DealMiniCard
// ---------------------------------------------------------------------------

function DealMiniCard({ deal }: { deal: EnrichedPromotion }) {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push(`/product/${deal.product.id}` as any)}
      style={({ pressed }) => [miniStyles.card, pressed && { opacity: 0.7 }]}
    >
      <Text style={miniStyles.productName} numberOfLines={2}>
        {deal.product.name}
      </Text>
      <Text style={miniStyles.price}>
        {formatBRL(deal.promo_price)}
      </Text>
      {deal.discountPercent > 0 && (
        <View style={miniStyles.badge}>
          <Text style={miniStyles.badgeText}>-{deal.discountPercent}%</Text>
        </View>
      )}
    </Pressable>
  );
}

const miniStyles = StyleSheet.create({
  card: {
    width: 110,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 10,
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
      },
      android: { elevation: 2 },
    }),
  },
  productName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1A1A2E',
    marginBottom: 6,
  },
  price: {
    fontSize: 15,
    fontWeight: '800',
    color: '#16A34A',
  },
  badge: {
    marginTop: 4,
    alignSelf: 'flex-start',
    backgroundColor: '#DCFCE7',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#15803D',
  },
});

// ---------------------------------------------------------------------------
// MapStoreSheet
// ---------------------------------------------------------------------------

export const MapStoreSheet = forwardRef<BottomSheet, MapStoreSheetProps>(
  function MapStoreSheet(
    { storeData, rank = 'yellow', position = 0, listSummary, onClose },
    ref,
  ) {
    const snapPoints = useMemo(() => ['45%', '85%'], []);

    const handleSheetChange = useCallback(
      (index: number) => {
        if (index === -1) onClose();
      },
      [onClose],
    );

    const handleNavigate = useCallback(() => {
      if (!storeData) return;
      const { latitude, longitude } = storeData.store;
      const url = Platform.select({
        ios: `maps://app?daddr=${latitude},${longitude}`,
        android: `geo:${latitude},${longitude}?q=${latitude},${longitude}`,
      }) ?? `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
      Linking.openURL(url);
    }, [storeData]);

    if (!storeData) return null;

    const { store, topDeals, distanceKm } = storeData;
    const medalEmoji =
      position >= 1 && position <= 3 ? MEDAL_EMOJIS[position - 1] : null;
    const badgeColors = RANK_BADGE_COLORS[rank];
    const rankLabel = medalEmoji
      ? `${medalEmoji} ${RANK_LABELS[rank]}`
      : RANK_LABELS[rank];

    return (
      <BottomSheet
        ref={ref}
        index={-1}
        snapPoints={snapPoints}
        onChange={handleSheetChange}
        enablePanDownToClose
        backgroundStyle={styles.sheetBg}
        handleIndicatorStyle={styles.handle}
      >
        <BottomSheetScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Store Header ── */}
          <View style={styles.header}>
            {/* Avatar */}
            <View
              style={[styles.avatar, { backgroundColor: store.logo_color }]}
            >
              <Text style={styles.avatarText}>
                {store.logo_initial}
              </Text>
            </View>

            {/* Name + meta */}
            <View style={styles.headerInfo}>
              <Text style={styles.storeName} numberOfLines={1}>
                {store.name}
              </Text>
              <View style={styles.metaRow}>
                <MapPin size={12} color="#0D9488" />
                <Text style={styles.metaText}>{distanceKm} km</Text>
                <View
                  style={[
                    styles.rankBadge,
                    { backgroundColor: badgeColors.bg },
                  ]}
                >
                  <Text style={[styles.rankBadgeText, { color: badgeColors.text }]}>
                    {rankLabel}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* ── Navigate Button ── */}
          <Pressable style={styles.navigateBtn} onPress={handleNavigate}>
            <Navigation2 size={15} color="#0D9488" />
            <Text style={styles.navigateBtnText}>Ir ao mapa</Text>
          </Pressable>

          {/* ── Shopping List Strip ── */}
          {listSummary && (
            <View style={styles.listStrip}>
              <View style={styles.listStripLeft}>
                <Text style={styles.listStripLabel}>Sua lista aqui</Text>
                <Text style={styles.listStripSub}>
                  {listSummary.availableCount}/{listSummary.itemCount}{' '}
                  {listSummary.itemCount === 1 ? 'item' : 'itens'} disponíveis
                </Text>
              </View>
              <View style={styles.listStripRight}>
                <Text style={styles.listStripTotal}>
                  {formatBRL(listSummary.total)}
                </Text>
                {listSummary.isCheapest && (
                  <Text style={styles.listStripNote}>Mais barato 🥇</Text>
                )}
              </View>
            </View>
          )}

          {/* ── Top Deals ── */}
          {topDeals.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Destaques nesta loja</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.dealsScroll}
              >
                {topDeals.map((deal) => (
                  <DealMiniCard key={deal.id} deal={deal} />
                ))}
              </ScrollView>
            </>
          )}
        </BottomSheetScrollView>
      </BottomSheet>
    );
  },
);

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  sheetBg: {
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
  },
  handle: {
    backgroundColor: '#D1D5DB',
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  headerInfo: {
    flex: 1,
  },
  storeName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#134E4A',
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexWrap: 'wrap',
  },
  metaText: {
    fontSize: 12,
    color: '#4A5568',
    marginRight: 4,
  },
  rankBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  rankBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },

  // Navigate button
  navigateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderColor: '#0D9488',
    borderRadius: 10,
    paddingVertical: 10,
    marginBottom: 16,
  },
  navigateBtnText: {
    color: '#0D9488',
    fontSize: 14,
    fontWeight: '700',
  },

  // Shopping list strip
  listStrip: {
    backgroundColor: '#F0FDFA',
    borderRadius: 10,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#99F6E4',
  },
  listStripLeft: {
    flex: 1,
  },
  listStripLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#134E4A',
  },
  listStripSub: {
    fontSize: 12,
    color: '#0D9488',
    marginTop: 2,
  },
  listStripRight: {
    alignItems: 'flex-end',
  },
  listStripTotal: {
    fontSize: 20,
    fontWeight: '800',
    color: '#134E4A',
  },
  listStripNote: {
    fontSize: 11,
    color: '#0D9488',
    fontWeight: '600',
    marginTop: 2,
  },

  // Top deals section
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A1A2E',
    marginBottom: 10,
  },
  dealsScroll: {
    paddingRight: 4,
  },
});
