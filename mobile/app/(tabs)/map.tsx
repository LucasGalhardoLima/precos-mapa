import { useRef, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  Linking,
  Platform,
} from 'react-native';
import MapView, { type Region } from 'react-native-maps';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import { useFocusEffect } from 'expo-router';
import {
  MapPin,
  ListChecks,
  Navigation2,
  ShoppingCart,
  Filter,
} from 'lucide-react-native';
import { MapLegend } from '@/components/map-legend';
import { MapStorePin, type PinRank } from '@/components/map-store-pin';
import {
  MapStoreSheet,
  type ShoppingListSummary,
} from '@/components/map-store-sheet';

import { useStores } from '@/hooks/use-stores';
import { useLocation } from '@/hooks/use-location';
import { useShoppingList } from '@/hooks/use-shopping-list';
import { useTheme } from '@/theme/use-theme';
import { Colors } from '@/constants/colors';
import type { StoreWithPromotions } from '@/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StoreListMatch {
  storeData: StoreWithPromotions;
  matchedItems: { productName: string; price: number; quantity: number }[];
  subtotal: number;
  isCheapest: boolean;
}

interface RankedStore {
  storeData: StoreWithPromotions;
  rank: PinRank;
  /** 1-based position among all stores (sorted by score). */
  position: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

/**
 * Assign color-coded rankings to stores.
 *
 * Scoring heuristic: average promo_price of top deals. Lower average = cheaper.
 * Stores with no deals are ranked last.
 *
 * Top third → green (#16A34A)
 * Middle third → yellow (#F59E0B)
 * Bottom third → red (#EF4444)
 */
function rankStores(stores: StoreWithPromotions[]): RankedStore[] {
  if (stores.length === 0) return [];

  // Compute a score per store (lower = cheaper)
  const scored = stores.map((s) => {
    const deals = s.topDeals;
    if (deals.length === 0) {
      return { storeData: s, score: Infinity };
    }
    const avgPrice =
      deals.reduce((sum, d) => sum + d.promo_price, 0) / deals.length;
    return { storeData: s, score: avgPrice };
  });

  // Sort ascending by score (cheapest first)
  scored.sort((a, b) => a.score - b.score);

  const total = scored.length;
  const third = Math.ceil(total / 3);

  return scored.map((item, idx) => {
    const position = idx + 1;
    let rank: PinRank;
    if (position <= third) {
      rank = 'green';
    } else if (position <= third * 2) {
      rank = 'yellow';
    } else {
      rank = 'red';
    }
    return { storeData: item.storeData, rank, position };
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function MapScreen() {
  const { latitude, longitude, permissionGranted } = useLocation();
  const { stores } = useStores({
    userLatitude: latitude,
    userLongitude: longitude,
  });
  const { lists } = useShoppingList();
  const { tokens } = useTheme();

  const mapRef = useRef<MapView>(null);
  const storeSheetRef = useRef<BottomSheet>(null);
  const listBottomSheetRef = useRef<BottomSheet>(null);

  const defaultRegion: Region = useMemo(
    () => ({
      latitude,
      longitude,
      latitudeDelta: 1.2,
      longitudeDelta: 1.2,
    }),
    [latitude, longitude],
  );

  // Reset map to default zoom when tab gains focus
  useFocusEffect(
    useCallback(() => {
      mapRef.current?.animateToRegion(defaultRegion, 300);
    }, [defaultRegion]),
  );

  const [selectedStore, setSelectedStore] =
    useState<StoreWithPromotions | null>(null);

  // When true, pin colors reflect shopping list prices instead of global ranking
  const [listFilterActive, setListFilterActive] = useState(false);

  // -------------------------------------------------------------------------
  // Derive the active shopping list items (first non-empty list)
  // -------------------------------------------------------------------------

  const listItems = useMemo(() => {
    if (!lists || lists.length === 0) return [];
    const activeList = lists.find((l) => l.items.length > 0);
    return activeList?.items ?? [];
  }, [lists]);

  const hasListItems = listItems.length > 0;

  // -------------------------------------------------------------------------
  // Compute store-to-list mapping
  // -------------------------------------------------------------------------

  const storeListMatches = useMemo((): StoreListMatch[] => {
    if (!hasListItems) return [];

    const storeById = new Map<string, StoreWithPromotions>();
    for (const s of stores) {
      storeById.set(s.store.id, s);
    }

    const storeItemsMap = new Map<string, StoreListMatch['matchedItems']>();
    const storeSubtotals = new Map<string, number>();
    const legacyItems: typeof listItems = [];

    for (const item of listItems) {
      if (item.store_id && storeById.has(item.store_id)) {
        const existing = storeItemsMap.get(item.store_id) ?? [];
        existing.push({
          productName: item.product?.name ?? 'Produto',
          price: 0,
          quantity: item.quantity,
        });
        storeItemsMap.set(item.store_id, existing);
      } else {
        legacyItems.push(item);
      }
    }

    for (const [storeId, items] of storeItemsMap) {
      const storeData = storeById.get(storeId)!;
      let subtotal = 0;

      for (const matchedItem of items) {
        const listItem = listItems.find(
          (li) =>
            li.store_id === storeId &&
            li.product?.name === matchedItem.productName,
        );
        if (listItem) {
          const deal = storeData.topDeals.find(
            (d) => d.product_id === listItem.product_id,
          );
          if (deal) {
            matchedItem.price = deal.promo_price;
          }
        }
        subtotal += matchedItem.price * matchedItem.quantity;
      }

      storeSubtotals.set(storeId, subtotal);
    }

    const matches: StoreListMatch[] = [];
    for (const [storeId, matchedItems] of storeItemsMap) {
      const storeData = storeById.get(storeId)!;
      matches.push({
        storeData,
        matchedItems,
        subtotal: storeSubtotals.get(storeId) ?? 0,
        isCheapest: false,
      });
    }

    if (legacyItems.length > 0) {
      const legacyProductIds = new Set(legacyItems.map((item) => item.product_id));
      const quantityMap = new Map<string, number>();
      const nameMap = new Map<string, string>();

      for (const item of legacyItems) {
        quantityMap.set(item.product_id, item.quantity);
        nameMap.set(item.product_id, item.product?.name ?? 'Produto');
      }

      for (const storeData of stores) {
        if (storeItemsMap.has(storeData.store.id)) continue;

        const legacyMatched: StoreListMatch['matchedItems'] = [];
        let subtotal = 0;

        for (const deal of storeData.topDeals) {
          if (legacyProductIds.has(deal.product_id)) {
            const qty = quantityMap.get(deal.product_id) ?? 1;
            const price = deal.promo_price;
            legacyMatched.push({
              productName: nameMap.get(deal.product_id) ?? deal.product.name,
              price,
              quantity: qty,
            });
            subtotal += price * qty;
          }
        }

        if (legacyMatched.length > 0) {
          matches.push({
            storeData,
            matchedItems: legacyMatched,
            subtotal,
            isCheapest: false,
          });
        }
      }
    }

    matches.sort((a, b) => a.subtotal - b.subtotal);
    if (matches.length > 0) {
      matches[0].isCheapest = true;
    }

    return matches;
  }, [stores, listItems, hasListItems]);

  const storeMatchMap = useMemo(() => {
    const map = new Map<string, StoreListMatch>();
    for (const m of storeListMatches) {
      map.set(m.storeData.store.id, m);
    }
    return map;
  }, [storeListMatches]);

  // -------------------------------------------------------------------------
  // Ranking logic
  // Global ranking: based on average deal prices.
  // List-filter ranking: based on list subtotals when filter is active.
  // -------------------------------------------------------------------------

  const globalRanked = useMemo(() => rankStores(stores), [stores]);

  /** Ranking using list subtotals when filter pill is active */
  const listRanked = useMemo((): RankedStore[] => {
    if (storeListMatches.length === 0) return globalRanked;

    const total = storeListMatches.length;
    const third = Math.ceil(total / 3);

    return storeListMatches.map((match, idx) => {
      const position = idx + 1;
      let rank: PinRank;
      if (position <= third) {
        rank = 'green';
      } else if (position <= third * 2) {
        rank = 'yellow';
      } else {
        rank = 'red';
      }
      return { storeData: match.storeData, rank, position };
    });
  }, [storeListMatches, globalRanked]);

  const activeRanked = listFilterActive && hasListItems ? listRanked : globalRanked;

  const rankByStoreId = useMemo(() => {
    const map = new Map<string, { rank: PinRank; position: number }>();
    for (const r of activeRanked) {
      map.set(r.storeData.store.id, { rank: r.rank, position: r.position });
    }
    return map;
  }, [activeRanked]);

  // -------------------------------------------------------------------------
  // Selected store rank info (for sheet)
  // -------------------------------------------------------------------------

  const selectedRank = selectedStore
    ? rankByStoreId.get(selectedStore.store.id)
    : null;

  const selectedListSummary: ShoppingListSummary | null = useMemo(() => {
    if (!selectedStore) return null;
    const match = storeMatchMap.get(selectedStore.store.id);
    if (!match) return null;
    return {
      itemCount: listItems.length,
      availableCount: match.matchedItems.length,
      total: match.subtotal,
      isCheapest: match.isCheapest,
    };
  }, [selectedStore, storeMatchMap, listItems]);

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------

  const handleMarkerPress = useCallback((storeData: StoreWithPromotions) => {
    setSelectedStore(storeData);
    storeSheetRef.current?.snapToIndex(0);
  }, []);

  const handleCloseStoreSheet = useCallback(() => {
    setSelectedStore(null);
  }, []);

  const handleShowListPanel = useCallback(() => {
    listBottomSheetRef.current?.snapToIndex(0);
  }, []);

  const handleToggleListFilter = useCallback(() => {
    setListFilterActive((prev) => !prev);
  }, []);

  // -------------------------------------------------------------------------
  // List panel snap points
  // -------------------------------------------------------------------------

  const listSnapPoints = useMemo(() => ['40%', '75%'], []);

  // -------------------------------------------------------------------------
  // Render helpers
  // -------------------------------------------------------------------------

  const renderListStoreRow = useCallback(
    ({ item }: { item: StoreListMatch }) => {
      const { storeData, matchedItems, subtotal, isCheapest } = item;
      const { store } = storeData;

      return (
        <View
          style={[
            styles.listRow,
            {
              backgroundColor: isCheapest
                ? tokens.primaryMuted
                : tokens.surface,
              borderColor: isCheapest ? tokens.primary : tokens.border,
            },
          ]}
        >
          <View style={styles.listRowHeader}>
            <View
              style={[
                styles.storeAvatar,
                { backgroundColor: isCheapest ? tokens.primary : store.logo_color },
              ]}
            >
              <Text style={styles.storeAvatarText}>{store.logo_initial}</Text>
            </View>

            <View style={styles.listRowInfo}>
              <View style={styles.listRowTitleRow}>
                <Text
                  style={[styles.storeName, { color: tokens.textPrimary }]}
                  numberOfLines={1}
                >
                  {store.name}
                </Text>
                {isCheapest && (
                  <View
                    style={[
                      styles.cheapestBadge,
                      { backgroundColor: tokens.primary },
                    ]}
                  >
                    <Text style={styles.cheapestBadgeText}>Mais barato</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.itemCount, { color: tokens.textSecondary }]}>
                {matchedItems.length}{' '}
                {matchedItems.length === 1 ? 'item' : 'itens'} da lista
              </Text>
            </View>
          </View>

          <View style={styles.listRowFooter}>
            <Text
              style={[
                styles.subtotalText,
                { color: isCheapest ? tokens.primary : tokens.textPrimary },
              ]}
            >
              {formatBRL(subtotal)}
            </Text>

            <Pressable
              style={[styles.routeButton, { backgroundColor: tokens.primary }]}
              onPress={() => {
                const url = `https://www.google.com/maps/dir/?api=1&destination=${store.latitude},${store.longitude}`;
                Linking.openURL(url);
              }}
            >
              <Navigation2 size={14} color="#FFFFFF" />
              <Text style={styles.routeButtonText}>Rota</Text>
            </Pressable>
          </View>
        </View>
      );
    },
    [tokens],
  );

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <View style={styles.container}>
      {/* Location denied banner */}
      {permissionGranted === false && (
        <View
          style={[
            styles.locationBanner,
            { backgroundColor: tokens.surface, borderColor: tokens.border },
          ]}
        >
          <View style={styles.locationBannerRow}>
            <MapPin size={18} color={Colors.semantic.warning} />
            <Text
              style={[
                styles.locationBannerText,
                { color: tokens.textSecondary },
              ]}
            >
              Permita acesso à localização para ver lojas perto de você
            </Text>
          </View>
        </View>
      )}

      {/* Map */}
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={defaultRegion}
        showsUserLocation={permissionGranted === true}
        showsMyLocationButton={permissionGranted === true}
      >
        {stores.map((storeData) => {
          const info = rankByStoreId.get(storeData.store.id);
          const rank: PinRank = info?.rank ?? 'yellow';
          const position = info?.position ?? 0;

          return (
            <MapStorePin
              key={storeData.store.id}
              storeData={storeData}
              rank={rank}
              position={position}
              onPress={() => handleMarkerPress(storeData)}
            />
          );
        })}
      </MapView>

      {/* ── Floating overlays ── */}

      {/* Legend — top-left */}
      <View style={styles.legendContainer}>
        <MapLegend />
      </View>

      {/* Filter pill — top-right */}
      {hasListItems && (
        <Pressable
          style={[
            styles.filterPill,
            listFilterActive && styles.filterPillActive,
          ]}
          onPress={handleToggleListFilter}
        >
          <Filter size={14} color={listFilterActive ? '#FFFFFF' : '#0D9488'} />
          <Text
            style={[
              styles.filterPillText,
              listFilterActive && styles.filterPillTextActive,
            ]}
          >
            Minha lista
          </Text>
        </Pressable>
      )}

      {/* "Ver minha lista" pill — only when user has list items */}
      {hasListItems && (
        <Pressable
          style={[styles.listPill, { backgroundColor: tokens.primary }]}
          onPress={handleShowListPanel}
        >
          <ListChecks size={16} color="#FFFFFF" />
          <Text style={styles.listPillText}>Ver minha lista</Text>
        </Pressable>
      )}

      {/* Individual store bottom sheet (redesigned) */}
      <MapStoreSheet
        ref={storeSheetRef}
        storeData={selectedStore}
        rank={selectedRank?.rank ?? 'yellow'}
        position={selectedRank?.position ?? 0}
        listSummary={selectedListSummary}
        onClose={handleCloseStoreSheet}
      />

      {/* List panel bottom sheet */}
      {hasListItems && (
        <BottomSheet
          ref={listBottomSheetRef}
          index={-1}
          snapPoints={listSnapPoints}
          enablePanDownToClose
          backgroundStyle={[
            styles.listSheetBg,
            { backgroundColor: tokens.bg },
          ]}
          handleIndicatorStyle={{ backgroundColor: tokens.textHint }}
        >
          <BottomSheetView style={styles.listSheetContent}>
            <View style={styles.listSheetHeader}>
              <ListChecks size={20} color={tokens.primary} />
              <Text
                style={[styles.listSheetTitle, { color: tokens.textPrimary }]}
              >
                Itens da lista por mercado
              </Text>
            </View>

            <Text
              style={[
                styles.listSheetSubtitle,
                { color: tokens.textSecondary },
              ]}
            >
              {listItems.length}{' '}
              {listItems.length === 1 ? 'item' : 'itens'} na sua lista
              {' \u2022 '}
              {storeListMatches.length}{' '}
              {storeListMatches.length === 1 ? 'mercado' : 'mercados'} com
              ofertas
            </Text>

            {storeListMatches.length > 0 ? (
              <FlatList
                data={storeListMatches}
                keyExtractor={(item) => item.storeData.store.id}
                renderItem={renderListStoreRow}
                contentContainerStyle={{ paddingBottom: 16, gap: 12 }}
                showsVerticalScrollIndicator={false}
              />
            ) : (
              <View style={styles.emptyListPanel}>
                <ShoppingCart size={32} color={tokens.textHint} />
                <Text
                  style={[
                    styles.emptyListText,
                    { color: tokens.textSecondary },
                  ]}
                >
                  Nenhum mercado com ofertas para itens da sua lista
                </Text>
              </View>
            )}
          </BottomSheetView>
        </BottomSheet>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },

  // Location banner
  locationBanner: {
    position: 'absolute',
    top: 48,
    left: 16,
    right: 16,
    zIndex: 10,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
      },
      android: { elevation: 3 },
    }),
  },
  locationBannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  locationBannerText: {
    fontSize: 13,
    flex: 1,
  },

  // Legend overlay (top-left)
  legendContainer: {
    position: 'absolute',
    top: 56,
    left: 16,
    zIndex: 20,
  },

  // Filter pill (top-right)
  filterPill: {
    position: 'absolute',
    top: 56,
    right: 16,
    zIndex: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#0D9488',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.12,
        shadowRadius: 6,
      },
      android: { elevation: 4 },
    }),
  },
  filterPillActive: {
    backgroundColor: '#0D9488',
    borderColor: '#0D9488',
  },
  filterPillText: {
    color: '#0D9488',
    fontSize: 13,
    fontWeight: '700',
  },
  filterPillTextActive: {
    color: '#FFFFFF',
  },

  // "Ver minha lista" floating pill (bottom-right area, above sheet)
  listPill: {
    position: 'absolute',
    bottom: 100,
    right: 16,
    zIndex: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 24,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 6,
      },
      android: { elevation: 4 },
    }),
  },
  listPillText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },

  // List bottom sheet
  listSheetBg: {
    borderRadius: 24,
  },
  listSheetContent: {
    flex: 1,
    paddingHorizontal: 20,
  },
  listSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  listSheetTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  listSheetSubtitle: {
    fontSize: 13,
    marginBottom: 16,
  },

  // Store rows inside list panel
  listRow: {
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
  },
  listRowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  storeAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  storeAvatarText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  listRowInfo: {
    flex: 1,
  },
  listRowTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  storeName: {
    fontSize: 15,
    fontWeight: '700',
    flexShrink: 1,
  },
  cheapestBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  cheapestBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  itemCount: {
    fontSize: 12,
    marginTop: 1,
  },
  listRowFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  subtotalText: {
    fontSize: 18,
    fontWeight: '800',
  },
  routeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  routeButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },

  // Empty state inside list panel
  emptyListPanel: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  emptyListText: {
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
});
