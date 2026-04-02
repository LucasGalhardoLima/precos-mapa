import { useRef, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  FlatList,
  Linking,
  Platform,
} from 'react-native';
import MapView, { type Region } from 'react-native-maps';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import {
  MapPin,
  ListChecks,
  Navigation2,
  ShoppingCart,
  Eye,
  Settings,
  MapPinOff,
} from 'lucide-react-native';
import { MapStorePin, type PinRank } from '@/components/map-store-pin';

import { useAnalytics } from '@/hooks/use-analytics';
import { useStores } from '@/hooks/use-stores';
import { useLocation } from '@/hooks/use-location';
import { useShoppingList } from '@/hooks/use-shopping-list';
import { useCategories } from '@/hooks/use-categories';
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
  const { stores, isLoading } = useStores({
    userLatitude: latitude,
    userLongitude: longitude,
    pageSize: 200,
  });
  const { lists } = useShoppingList();
  const { categories } = useCategories();
  const { tokens } = useTheme();
  const router = useRouter();
  const { trackMapPinTap } = useAnalytics();

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const mapRef = useRef<MapView>(null);
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

  // Read storeId param (passed from Home when tapping a store card)
  const { storeId } = useLocalSearchParams<{ storeId?: string }>();

  // On focus: if storeId param is present, select that store and zoom to it;
  // otherwise reset to default zoom.
  useFocusEffect(
    useCallback(() => {
      if (storeId && stores.length > 0) {
        const match = stores.find((s) => s.store.id === storeId);
        if (match) {
          setSelectedStore(match);
          mapRef.current?.animateToRegion(
            {
              latitude: match.store.latitude,
              longitude: match.store.longitude,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            },
            400,
          );
          return;
        }
      }
      mapRef.current?.animateToRegion(defaultRegion, 300);
    }, [defaultRegion, storeId, stores]),
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

  const categoryCountByStore = useMemo(() => {
    if (!selectedCategory) return null;
    const map = new Map<string, number>();
    for (const s of stores) {
      map.set(s.store.id, s.promotionCountByCategory?.[selectedCategory] ?? 0);
    }
    return map;
  }, [stores, selectedCategory]);

  // (Selected store info is rendered inline in the floating card)

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------

  const handleMarkerPress = useCallback((storeData: StoreWithPromotions) => {
    setSelectedStore(storeData);
    trackMapPinTap(storeData.store.id);
  }, [trackMapPinTap]);

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
            <View style={styles.locationBannerContent}>
              <Text
                style={[
                  styles.locationBannerText,
                  { color: tokens.textSecondary },
                ]}
              >
                Permita acesso à localização para ver lojas perto de você
              </Text>
              <Pressable
                onPress={() => Linking.openSettings()}
                style={[styles.locationSettingsBtn, { backgroundColor: tokens.primaryMuted }]}
                accessibilityLabel="Abrir configurações de localização"
                accessibilityRole="button"
              >
                <Settings size={12} color={tokens.primary} />
                <Text style={[styles.locationSettingsText, { color: tokens.primary }]}>
                  Abrir Configurações
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}

      {/* No stores found */}
      {!isLoading && stores.length === 0 && permissionGranted !== false && (
        <View style={styles.noStoresOverlay}>
          <View style={[styles.noStoresCard, { backgroundColor: tokens.surface }]}>
            <MapPinOff size={28} color={tokens.textHint} />
            <Text style={[styles.noStoresTitle, { color: tokens.textPrimary }]}>
              Nenhum mercado encontrado
            </Text>
            <Text style={[styles.noStoresSubtitle, { color: tokens.textHint }]}>
              Não há mercados com ofertas ativas perto de você no momento
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
          const isSelected = selectedStore?.store.id === storeData.store.id;
          const isDimmed = selectedStore != null && !isSelected;
          const categoryOfferCount = categoryCountByStore
            ? categoryCountByStore.get(storeData.store.id)
            : undefined;

          return (
            <MapStorePin
              key={storeData.store.id}
              storeData={storeData}
              rank={rank}
              position={position}
              selected={isSelected}
              dimmed={isDimmed}
              categoryOfferCount={categoryOfferCount}
              onPress={() => handleMarkerPress(storeData)}
            />
          );
        })}
      </MapView>

      {/* ── Category filter pills (floating over map) ── */}
      <View style={styles.categoryBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryBarContent}
        >
          <Pressable
            onPress={() => setSelectedCategory(null)}
            style={[
              styles.categoryChip,
              !selectedCategory && styles.categoryChipActive,
            ]}
          >
            <Text
              style={[
                styles.categoryChipText,
                !selectedCategory && styles.categoryChipTextActive,
              ]}
            >
              Todos
            </Text>
          </Pressable>
          {categories.map((cat) => {
            const isActive = selectedCategory === cat.id;
            return (
              <Pressable
                key={cat.id}
                onPress={() => setSelectedCategory(cat.id)}
                style={[
                  styles.categoryChip,
                  isActive && styles.categoryChipActive,
                ]}
              >
                <Text
                  style={[
                    styles.categoryChipText,
                    isActive && styles.categoryChipTextActive,
                  ]}
                >
                  {cat.name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

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

      {/* Category filter info pill */}
      {selectedCategory && !selectedStore && (() => {
        const catName = categories.find((c) => c.id === selectedCategory)?.name ?? '';
        const storesWithOffers = categoryCountByStore
          ? [...categoryCountByStore.values()].filter((c) => c > 0).length
          : stores.filter((s) => s.activePromotionCount > 0).length;
        return (
          <View style={styles.filterInfoPill}>
            <Text style={styles.filterInfoCount}>{storesWithOffers}</Text>
            <Text style={styles.filterInfoText}> mercados com ofertas em {catName}</Text>
          </View>
        );
      })()}

      {/* Floating store card (matches mockup) */}
      {selectedStore && (
        <View style={styles.floatingCard}>
          <Pressable style={styles.floatingCardDismiss} onPress={handleCloseStoreSheet} />
          <View style={styles.floatingCardTop}>
            <View style={[styles.floatingCardAvatar, { backgroundColor: selectedStore.store.logo_color }]}>
              <Text style={styles.floatingCardAvatarText}>{selectedStore.store.logo_initial}</Text>
            </View>
            <View style={styles.floatingCardInfo}>
              <Text style={styles.floatingCardName} numberOfLines={1}>{selectedStore.store.name}</Text>
              <Text style={styles.floatingCardAddr} numberOfLines={1}>{selectedStore.store.address} — {selectedStore.store.city}</Text>
            </View>
          </View>
          <View style={styles.floatingCardTags}>
            <View style={styles.fcTagDist}><Text style={styles.fcTagDistText}>{selectedStore.distanceKm.toFixed(1)} km</Text></View>
            <View style={styles.fcTagDeals}><Text style={styles.fcTagDealsText}>{selectedCategory && selectedStore.promotionCountByCategory?.[selectedCategory] != null ? selectedStore.promotionCountByCategory[selectedCategory] : selectedStore.activePromotionCount} ofertas</Text></View>
            <View style={styles.fcTagOpen}><Text style={styles.fcTagOpenText}>Aberto</Text></View>
          </View>
          <View style={styles.floatingCardActions}>
            <Pressable style={styles.fcBtnSecondary} onPress={() => {
              router.push({
                pathname: '/(tabs)/search',
                params: { storeId: selectedStore.store.id, storeName: selectedStore.store.name },
              });
            }}>
              <Eye size={14} color="#64748B" />
              <Text style={styles.fcBtnSecondaryText}>Ver ofertas</Text>
            </Pressable>
            <Pressable style={styles.fcBtnPrimary} onPress={() => {
              const { latitude, longitude } = selectedStore.store;
              const url = Platform.select({
                ios: `maps://app?daddr=${latitude},${longitude}`,
                android: `geo:${latitude},${longitude}?q=${latitude},${longitude}`,
              }) ?? `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
              Linking.openURL(url);
            }}>
              <Navigation2 size={14} color="#FFFFFF" />
              <Text style={styles.fcBtnPrimaryText}>Como chegar</Text>
            </Pressable>
          </View>
        </View>
      )}

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
  locationBannerContent: {
    flex: 1,
    gap: 8,
  },
  locationBannerText: {
    fontSize: 13,
  },
  locationSettingsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  locationSettingsText: {
    fontSize: 12,
    fontWeight: '600',
  },

  // Category filter bar (floating over map)
  categoryBar: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    zIndex: 15,
  },
  categoryBarContent: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1.5,
    borderColor: '#d1d5db',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: { elevation: 2 },
    }),
  },
  categoryChipActive: {
    backgroundColor: '#0D9488',
    borderColor: '#0D9488',
  },
  categoryChipText: {
    fontSize: 11,
    fontWeight: '600',
    fontFamily: 'Inter_500Medium',
    color: '#64748B',
  },
  categoryChipTextActive: {
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
    fontFamily: 'Poppins_700Bold',
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
    fontFamily: 'Inter_500Medium',
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
    fontFamily: 'Poppins_700Bold',
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

  // Category filter info pill
  filterInfoPill: {
    position: 'absolute',
    bottom: 82,
    alignSelf: 'center',
    zIndex: 15,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  filterInfoCount: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0D9488',
  },
  filterInfoText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },

  // Floating store card (replaces BottomSheet)
  floatingCard: {
    position: 'absolute',
    bottom: 78,
    left: 12,
    right: 12,
    zIndex: 15,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 8,
  },
  floatingCardDismiss: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    zIndex: 1,
  },
  floatingCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  floatingCardAvatar: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  floatingCardAvatarText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  floatingCardInfo: {
    flex: 1,
    minWidth: 0,
  },
  floatingCardName: {
    fontSize: 15,
    fontWeight: '700',
    fontFamily: 'Poppins_700Bold',
    color: '#1A1A2E',
  },
  floatingCardAddr: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 1,
  },
  floatingCardTags: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 10,
  },
  fcTagDist: {
    backgroundColor: '#e0f2fe',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  fcTagDistText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#0369a1',
  },
  fcTagDeals: {
    backgroundColor: '#fef3c7',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  fcTagDealsText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#92400e',
  },
  fcTagOpen: {
    backgroundColor: '#dcfce7',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  fcTagOpenText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#166534',
  },
  floatingCardActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  fcBtnSecondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
  },
  fcBtnSecondaryText: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: 'Inter_500Medium',
    color: '#64748B',
  },
  fcBtnPrimary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: '#0D9488',
  },
  fcBtnPrimaryText: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: 'Inter_500Medium',
    color: '#FFFFFF',
  },

  // No stores overlay
  noStoresOverlay: {
    position: 'absolute',
    top: '35%',
    left: 24,
    right: 24,
    zIndex: 15,
    alignItems: 'center',
  },
  noStoresCard: {
    alignItems: 'center',
    borderRadius: 16,
    padding: 24,
    gap: 8,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: { elevation: 4 },
    }),
  },
  noStoresTitle: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'Poppins_700Bold',
    textAlign: 'center',
  },
  noStoresSubtitle: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
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
