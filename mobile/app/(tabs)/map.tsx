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
import MapView, { Marker, type Region } from 'react-native-maps';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import { useFocusEffect } from 'expo-router';
import {
  MapPin,
  ListChecks,
  Navigation2,
  ShoppingCart,
} from 'lucide-react-native';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { StoreMarker } from '@/components/store-marker';
import { StoreBottomSheet } from '@/components/store-bottom-sheet';

import { useStores } from '@/hooks/use-stores';
import { useLocation } from '@/hooks/use-location';
import { useShoppingList } from '@/hooks/use-shopping-list';
import { useTheme } from '@/theme/use-theme';
import { Colors } from '@/constants/colors';
import type { StoreWithPromotions } from '@/types';

const HAS_GLASS = isLiquidGlassAvailable();

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StoreListMatch {
  storeData: StoreWithPromotions;
  matchedItems: { productName: string; price: number; quantity: number }[];
  subtotal: number;
  isCheapest: boolean;
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
  const storeBottomSheetRef = useRef<BottomSheet>(null);
  const listBottomSheetRef = useRef<BottomSheet>(null);

  const defaultRegion: Region = useMemo(() => ({
    latitude,
    longitude,
    latitudeDelta: 1.2,
    longitudeDelta: 1.2,
  }), [latitude, longitude]);

  // Reset map to default zoom when tab gains focus
  useFocusEffect(
    useCallback(() => {
      mapRef.current?.animateToRegion(defaultRegion, 300);
    }, [defaultRegion]),
  );

  const [selectedStore, setSelectedStore] =
    useState<StoreWithPromotions | null>(null);

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
  // Group list items by their origin store_id. Items without a store_id
  // fall back to matching against topDeals (legacy behavior).
  // -------------------------------------------------------------------------

  const storeListMatches = useMemo((): StoreListMatch[] => {
    if (!hasListItems) return [];

    // Build a lookup from store id to StoreWithPromotions
    const storeById = new Map<string, StoreWithPromotions>();
    for (const s of stores) {
      storeById.set(s.store.id, s);
    }

    // Group items by origin store_id
    const storeItemsMap = new Map<string, StoreListMatch['matchedItems']>();
    const storeSubtotals = new Map<string, number>();
    const legacyItems: typeof listItems = [];

    for (const item of listItems) {
      if (item.store_id && storeById.has(item.store_id)) {
        const existing = storeItemsMap.get(item.store_id) ?? [];
        const price = 0; // We'll look up the price from promotions
        existing.push({
          productName: item.product?.name ?? 'Produto',
          price,
          quantity: item.quantity,
        });
        storeItemsMap.set(item.store_id, existing);
      } else {
        legacyItems.push(item);
      }
    }

    // For items with store_id, try to find their promo price from the store's promotions
    for (const [storeId, items] of storeItemsMap) {
      const storeData = storeById.get(storeId)!;
      let subtotal = 0;

      for (const matchedItem of items) {
        // Find the matching list item to get product_id
        const listItem = listItems.find(
          (li) => li.store_id === storeId && li.product?.name === matchedItem.productName,
        );
        if (listItem) {
          // Look for promo price in topDeals
          const deal = storeData.topDeals.find((d) => d.product_id === listItem.product_id);
          if (deal) {
            matchedItem.price = deal.promo_price;
          }
        }
        subtotal += matchedItem.price * matchedItem.quantity;
      }

      storeSubtotals.set(storeId, subtotal);
    }

    // Build matches from origin-store grouped items
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

    // Legacy fallback: match items without store_id against topDeals
    if (legacyItems.length > 0) {
      const legacyProductIds = new Set(legacyItems.map((item) => item.product_id));
      const quantityMap = new Map<string, number>();
      const nameMap = new Map<string, string>();

      for (const item of legacyItems) {
        quantityMap.set(item.product_id, item.quantity);
        nameMap.set(item.product_id, item.product?.name ?? 'Produto');
      }

      for (const storeData of stores) {
        // Skip stores already matched via origin
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
          matches.push({ storeData, matchedItems: legacyMatched, subtotal, isCheapest: false });
        }
      }
    }

    // Sort by subtotal ascending, mark cheapest
    matches.sort((a, b) => a.subtotal - b.subtotal);
    if (matches.length > 0) {
      matches[0].isCheapest = true;
    }

    return matches;
  }, [stores, listItems, hasListItems]);

  // Build a quick lookup: storeId -> StoreListMatch
  const storeMatchMap = useMemo(() => {
    const map = new Map<string, StoreListMatch>();
    for (const m of storeListMatches) {
      map.set(m.storeData.store.id, m);
    }
    return map;
  }, [storeListMatches]);

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------

  const handleMarkerPress = useCallback(
    (storeData: StoreWithPromotions) => {
      setSelectedStore(storeData);
      storeBottomSheetRef.current?.snapToIndex(0);
    },
    [],
  );

  const handleCloseStoreSheet = useCallback(() => {
    setSelectedStore(null);
  }, []);

  const handleShowListPanel = useCallback(() => {
    listBottomSheetRef.current?.snapToIndex(0);
  }, []);

  const handleRoute = useCallback((lat: number, lng: number) => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    Linking.openURL(url);
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
          {/* Store header */}
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

          {/* Subtotal + Route */}
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
              onPress={() => handleRoute(store.latitude, store.longitude)}
            >
              <Navigation2 size={14} color="#FFFFFF" />
              <Text style={styles.routeButtonText}>Rota</Text>
            </Pressable>
          </View>
        </View>
      );
    },
    [tokens, handleRoute],
  );

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <View style={styles.container}>
      {/* Location denied banner */}
      {permissionGranted === false && (
        HAS_GLASS ? (
          <GlassView glassEffectStyle="regular" style={[styles.locationBanner, styles.locationBannerGlass]}>
            <View style={styles.locationBannerRow}>
              <MapPin size={18} color={Colors.semantic.warning} />
              <Text
                style={[styles.locationBannerText, { color: tokens.textSecondary }]}
              >
                Permita acesso à localização para ver lojas perto de você
              </Text>
            </View>
          </GlassView>
        ) : (
          <View
            style={[
              styles.locationBanner,
              { backgroundColor: tokens.surface, borderColor: tokens.border },
            ]}
          >
            <View style={styles.locationBannerRow}>
              <MapPin size={18} color={Colors.semantic.warning} />
              <Text
                style={[styles.locationBannerText, { color: tokens.textSecondary }]}
              >
                Permita acesso à localização para ver lojas perto de você
              </Text>
            </View>
          </View>
        )
      )}

      {/* "Ver minha lista" floating pill button — only when user has list items */}
      {hasListItems && (
        <Pressable
          style={[styles.listPill, !HAS_GLASS && { backgroundColor: tokens.primary }]}
          onPress={handleShowListPanel}
        >
          {HAS_GLASS ? (
            <GlassView glassEffectStyle="regular" tintColor={tokens.primary} style={styles.listPillGlass}>
              <ListChecks size={16} color="#FFFFFF" />
              <Text style={styles.listPillText}>Ver minha lista</Text>
            </GlassView>
          ) : (
            <>
              <ListChecks size={16} color="#FFFFFF" />
              <Text style={styles.listPillText}>Ver minha lista</Text>
            </>
          )}
        </Pressable>
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
          const match = storeMatchMap.get(storeData.store.id);

          // When user has list items AND this store has matching deals,
          // render an enhanced marker with subtotal / cheapest badge.
          if (hasListItems && match) {
            const { store } = storeData;
            return (
              <Marker
                key={store.id}
                coordinate={{
                  latitude: store.latitude,
                  longitude: store.longitude,
                }}
                onPress={() => handleMarkerPress(storeData)}
              >
                <View style={styles.markerContainer}>
                  {/* "Mais barato" label above the cheapest store */}
                  {match.isCheapest && (
                    <View
                      style={[
                        styles.cheapestMarkerLabel,
                        { backgroundColor: tokens.primary },
                      ]}
                    >
                      <Text style={styles.cheapestMarkerLabelText}>
                        Mais barato
                      </Text>
                    </View>
                  )}

                  {/* Circle avatar */}
                  <View
                    style={[
                      styles.markerCircle,
                      {
                        backgroundColor: match.isCheapest
                          ? tokens.primary
                          : store.logo_color,
                        borderColor: match.isCheapest
                          ? tokens.primaryMuted
                          : '#FFFFFF',
                      },
                    ]}
                  >
                    <Text style={styles.markerInitial}>
                      {store.logo_initial}
                    </Text>
                  </View>

                  {/* Subtotal badge below */}
                  <View
                    style={[
                      styles.markerSubtotalBadge,
                      {
                        backgroundColor: match.isCheapest
                          ? tokens.primary
                          : tokens.surface,
                        borderColor: match.isCheapest
                          ? tokens.primary
                          : tokens.border,
                      },
                    ]}
                  >
                    <ShoppingCart
                      size={8}
                      color={match.isCheapest ? '#FFFFFF' : tokens.textSecondary}
                    />
                    <Text
                      style={[
                        styles.markerSubtotalText,
                        {
                          color: match.isCheapest
                            ? '#FFFFFF'
                            : tokens.textPrimary,
                        },
                      ]}
                      numberOfLines={1}
                    >
                      {formatBRL(match.subtotal)}
                    </Text>
                  </View>
                </View>
              </Marker>
            );
          }

          // Default marker: store name + deal count (existing behavior)
          return (
            <StoreMarker
              key={storeData.store.id}
              storeData={storeData}
              onPress={() => handleMarkerPress(storeData)}
            />
          );
        })}
      </MapView>

      {/* Individual store bottom sheet (existing) */}
      <StoreBottomSheet
        ref={storeBottomSheetRef}
        storeData={selectedStore}
        onClose={handleCloseStoreSheet}
      />

      {/* List panel bottom sheet — "Itens da lista por mercado" */}
      {hasListItems && (
        <BottomSheet
          ref={listBottomSheetRef}
          index={-1}
          snapPoints={listSnapPoints}
          enablePanDownToClose
          backgroundStyle={[
            styles.listSheetBg,
            { backgroundColor: HAS_GLASS ? 'transparent' : tokens.bg },
          ]}
          handleIndicatorStyle={{ backgroundColor: tokens.textHint }}
        >
          {(() => {
            const listSheetContent = (
              <BottomSheetView style={styles.listSheetContent}>
                {/* Header */}
                <View style={styles.listSheetHeader}>
                  <ListChecks size={20} color={tokens.primary} />
                  <Text
                    style={[
                      styles.listSheetTitle,
                      { color: tokens.textPrimary },
                    ]}
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

                {/* Store list */}
                {storeListMatches.length > 0 ? (
                  <FlatList
                    data={storeListMatches}
                    keyExtractor={(item) => item.storeData.store.id}
                    renderItem={renderListStoreRow}
                    contentContainerStyle={{
                      paddingBottom: 16,
                      gap: 12,
                    }}
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
            );

            return HAS_GLASS ? (
              <GlassView glassEffectStyle="regular" style={{ flex: 1, borderRadius: 24 }}>
                {listSheetContent}
              </GlassView>
            ) : (
              listSheetContent
            );
          })()}
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
  locationBannerGlass: {
    overflow: 'hidden',
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

  // Floating "Ver minha lista" pill
  listPill: {
    position: 'absolute',
    top: 56,
    right: 16,
    zIndex: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 24,
    overflow: 'hidden',
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
  listPillGlass: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 24,
  },
  listPillText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },

  // Enhanced marker styles
  markerContainer: {
    alignItems: 'center',
  },
  cheapestMarkerLabel: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginBottom: 2,
  },
  cheapestMarkerLabelText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  markerCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  markerInitial: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },
  markerSubtotalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 2,
    borderWidth: 0.5,
  },
  markerSubtotalText: {
    fontSize: 10,
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
