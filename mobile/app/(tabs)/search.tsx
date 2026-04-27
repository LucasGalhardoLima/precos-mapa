import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  TextInput,
  Text,
  Pressable,
  FlatList,
  SectionList,
  Alert,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Search, X, SearchX, SlidersHorizontal } from 'lucide-react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import BottomSheet from '@gorhom/bottom-sheet';

import { useTheme } from '@/theme/use-theme';
import { triggerHaptic } from '@/hooks/use-haptics';
import { triggerNotification } from '@/hooks/use-haptics';
import { NotificationFeedbackType } from 'expo-haptics';
import * as Burnt from 'burnt';
import { usePromotions } from '@/hooks/use-promotions';
import { useLocation } from '@/hooks/use-location';
import { useRecentSearches } from '@/hooks/use-recent-searches';
import { useCategories } from '@/hooks/use-categories';
import { useTrending } from '@/hooks/use-trending';
import { useShoppingList } from '@/hooks/use-shopping-list';
import { useStores } from '@/hooks/use-stores';
import { useAnalytics } from '@/hooks/use-analytics';
import { useAuthStore } from '@poup/shared';
import { SearchDiscovery } from '@/components/search-discovery';
import { SearchResultCard } from '@/components/search-result-card';
import { ProductPriceCard } from '@/components/product-price-card';
import { SearchFilterSheet, DEFAULT_FILTERS } from '@/components/search-filter-sheet';
import type { SearchFilters } from '@/components/search-filter-sheet';
import { MarketDetectionCard } from '@/components/market-detection-card';
import { SearchSkeleton } from '@/components/skeleton/search-skeleton';
import { Paywall } from '@/components/paywall';
import { InlineError } from '@/components/inline-error';
import { EmptyState } from '@/components/empty-state';

import type { SortMode, EnrichedPromotion, ProductWithPrices } from '@/types';

// ---------------------------------------------------------------------------
// Sort tab config
// ---------------------------------------------------------------------------

const SORT_TABS: { label: string; mode: SortMode }[] = [
  { label: 'Menor preço', mode: 'cheapest' },
  { label: 'Distância', mode: 'nearest' },
  { label: 'Desconto', mode: 'discount' },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SearchScreen() {
  const { tokens } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { latitude, longitude, city } = useLocation();
  const { recentSearches, addSearch, clearSearches } = useRecentSearches();
  const { categories } = useCategories();
  const { trending, isLoading: isTrendingLoading } = useTrending();
  const { lists, addItem, createList } = useShoppingList();
  const { stores: storeData } = useStores({ userLatitude: latitude, userLongitude: longitude });

  const { trackSearch, trackListAdd } = useAnalytics();
  const { storeId, storeName } = useLocalSearchParams<{ storeId?: string; storeName?: string }>();

  // Local state
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [categoryId, setCategoryId] = useState<string | undefined>(undefined);
  const [sortMode, setSortMode] = useState<SortMode>('cheapest');
  const [paywallVisible, setPaywallVisible] = useState(false);
  const [filters, setFilters] = useState<SearchFilters>(DEFAULT_FILTERS);
  const inputRef = useRef<TextInput>(null);
  const filterSheetRef = useRef<BottomSheet>(null);

  // Simple store list for the filter sheet
  const storeList = useMemo(
    () => storeData.map((s) => s.store),
    [storeData],
  );

  // Smart market detection: check if query matches a store name
  const matchedStore = useMemo(() => {
    if (!debouncedQuery || debouncedQuery.length < 3) return null;
    const q = debouncedQuery.toLowerCase();
    return storeData.find(
      (s) =>
        s.store.name.toLowerCase().includes(q) ||
        (s.store.chain && s.store.chain.toLowerCase().includes(q)),
    ) ?? null;
  }, [debouncedQuery, storeData]);

  // Use product-grouped mode when searching by product query (no store filter)
  const useProductMode = !!debouncedQuery && !storeId;

  // Debounce query input (300ms)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 300);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [query]);

  // Fetch promotions (with filter state)
  const { promotions, productResults, isLoading, isEmpty, error, retry } = usePromotions({
    productQuery: debouncedQuery || undefined,
    categoryId,
    storeId: filters.storeId || storeId || undefined,
    sortMode,
    userLatitude: latitude,
    userLongitude: longitude,
    groupBy: useProductMode ? 'product' : 'store',
    maxDistanceKm: filters.maxDistanceKm ?? undefined,
    maxPrice: filters.maxPrice ?? undefined,
  });

  // Navigation / interaction handlers
  const handlePressItem = useCallback(
    (promotion: EnrichedPromotion) => {
      router.push(`/product/${promotion.product_id}`);
    },
    [router],
  );

  const handlePressProduct = useCallback(
    (productId: string) => {
      router.push(`/product/${productId}`);
    },
    [router],
  );

  const handlePressStore = useCallback(
    (pressedStoreId: string) => {
      const match = storeData.find((s) => s.store.id === pressedStoreId);
      router.setParams({ storeId: pressedStoreId, storeName: match?.store.name ?? '' });
    },
    [router, storeData],
  );

  const handlePressLocked = useCallback(() => {
    setPaywallVisible(true);
  }, []);

  const handleApplyFilters = useCallback((newFilters: SearchFilters) => {
    setFilters(newFilters);
    triggerHaptic();
  }, []);

  const hasActiveFilters = filters.maxDistanceKm !== null || filters.maxPrice !== null || filters.storeId !== null;

  const clearQuery = useCallback(() => {
    setQuery('');
    setDebouncedQuery('');
    setCategoryId(undefined);
  }, []);

  const submitSearch = useCallback((text: string) => {
    const trimmed = text.trim();
    if (trimmed) {
      addSearch(trimmed);
    }
  }, [addSearch]);

  const handleSelectRecent = useCallback((recent: string) => {
    setQuery(recent);
    setDebouncedQuery(recent);
    setCategoryId(undefined);
    triggerHaptic();
  }, []);

  const handleSelectCategory = useCallback((catId: string, catName: string) => {
    setQuery(catName);
    setDebouncedQuery(catName);
    setCategoryId(catId);
    addSearch(catName);
    triggerHaptic();
  }, [addSearch]);

  const handleSelectTrending = useCallback((productId: string, productName: string) => {
    setQuery(productName);
    setDebouncedQuery(productName);
    setCategoryId(undefined);
    addSearch(productName);
    triggerHaptic();
  }, [addSearch]);

  const handleAddToList = useCallback(async (promotion: EnrichedPromotion) => {
    const session = useAuthStore.getState().session;
    if (!session?.user) {
      Alert.alert(
        'Login necessário',
        'Faça login para adicionar produtos à sua lista.',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Entrar', onPress: () => router.push('/(tabs)/account') },
        ],
      );
      return;
    }

    try {
      let listId: string | null = null;
      if (lists.length > 0) {
        listId = lists[0].id;
      } else {
        listId = await createList('Minha lista');
      }

      if (!listId) {
        Alert.alert('Erro', 'Não foi possível criar a lista.');
        return;
      }

      await addItem(listId, promotion.product_id, 1, promotion.store_id);
      trackListAdd(promotion.product_id, promotion.store_id);
      triggerNotification(NotificationFeedbackType.Success);
      Burnt.toast({
        title: 'Adicionado à lista',
        preset: 'done',
        haptic: 'success',
      });
    } catch {
      Alert.alert('Erro', 'Não foi possível adicionar à lista.');
    }
  }, [lists, addItem, createList, router, trackListAdd]);

  // Analytics: track search results when they arrive
  useEffect(() => {
    if (!debouncedQuery || isLoading) return;
    const storeIds = useProductMode
      ? [...new Set(productResults.flatMap((p) => p.prices.map((pr) => pr.store_id)))]
      : [...new Set(promotions.map((p) => p.store_id))];
    if (storeIds.length > 0) {
      trackSearch(debouncedQuery, useProductMode ? productResults.length : promotions.length, storeIds);
    }
  }, [debouncedQuery, isLoading, useProductMode, productResults, promotions, trackSearch]);

  // View state
  const hasFilter = debouncedQuery.length > 0 || !!categoryId || !!storeId;
  const showError = hasFilter && !isLoading && error != null;
  const showLoading = hasFilter && isLoading;
  const showEmpty = hasFilter && !isLoading && !error && isEmpty;
  const showResults = hasFilter && !isLoading && !error && !isEmpty;
  const showDiscovery = !hasFilter;

  const resultCount = useProductMode ? productResults.length : promotions.length;

  const productSections = useMemo(() => {
    if (!showResults || !useProductMode) return [];
    const priced  = productResults.filter((p) => p.has_active_price);
    const noPrice = productResults.filter((p) => !p.has_active_price);
    const sections: { title: string | null; data: typeof productResults }[] = [];
    if (priced.length > 0)   sections.push({ title: null,                    data: priced });
    if (noPrice.length > 0)  sections.push({ title: 'Sem oferta no momento', data: noPrice });
    return sections;
  }, [productResults, showResults, useProductMode]);

  // Search bar style: focused (teal) when query is active
  const searchBarStyle = hasFilter
    ? [styles.searchBar, { backgroundColor: tokens.surface, borderColor: tokens.primary, borderWidth: 1.5 }]
    : [styles.searchBar, { backgroundColor: tokens.surface, borderColor: COLORS.border, borderWidth: 1 }];

  const searchIconColor = hasFilter ? tokens.primary : COLORS.textMuted;

  return (
    <View style={[styles.screen, { backgroundColor: tokens.bg }]}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>

        {/* Search bar */}
        <View style={searchBarStyle}>
          <Search size={18} color={searchIconColor} />
          <TextInput
            ref={inputRef}
            style={[styles.searchInput, { color: tokens.textPrimary }]}
            placeholder="Buscar produto ou marca..."
            placeholderTextColor={COLORS.textMuted}
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={() => submitSearch(query)}
            returnKeyType="search"
            autoCorrect={false}
            autoFocus={false}
          />
          {query.length > 0 && (
            <Pressable
              onPress={clearQuery}
              hitSlop={8}
              style={styles.clearButton}
            >
              <X size={14} color={COLORS.textSecondary} />
            </Pressable>
          )}
          <Pressable
            onPress={() => {
              triggerHaptic();
              filterSheetRef.current?.expand();
            }}
            hitSlop={8}
            style={styles.filterButton}
          >
            <SlidersHorizontal size={18} color={hasActiveFilters ? tokens.primary : COLORS.textMuted} />
            {hasActiveFilters && <View style={[styles.filterDot, { backgroundColor: tokens.primary }]} />}
          </Pressable>
        </View>

        {/* Store filter banner */}
        {storeId && (
          <View style={styles.storeFilterBanner}>
            <Text style={styles.storeFilterText}>
              Ofertas em <Text style={styles.storeFilterName}>{storeName}</Text>
            </Text>
            <Pressable onPress={() => router.setParams({ storeId: '', storeName: '' })} hitSlop={8}>
              <X size={16} color="#64748B" />
            </Pressable>
          </View>
        )}

        {/* Sort tabs — shown only when viewing store-grouped results */}
        {showResults && !useProductMode && (
          <View style={styles.sortRow}>
            {SORT_TABS.map((tab) => {
              const active = sortMode === tab.mode;
              return (
                <Pressable
                  key={tab.mode}
                  onPress={() => {
                    triggerHaptic();
                    setSortMode(tab.mode);
                  }}
                  style={[
                    styles.sortPill,
                    active
                      ? { backgroundColor: tokens.primary }
                      : {
                          backgroundColor: tokens.surface,
                          borderWidth: 1,
                          borderColor: COLORS.border,
                        },
                  ]}
                >
                  <Text
                    style={[
                      styles.sortPillText,
                      { color: active ? '#FFFFFF' : COLORS.textSecondary },
                    ]}
                  >
                    {tab.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}

        {/* Loading */}
        {showLoading && <SearchSkeleton />}

        {/* Discovery view */}
        {showDiscovery && (
          <SearchDiscovery
            recentSearches={recentSearches}
            onSelectRecent={handleSelectRecent}
            onClearRecents={clearSearches}
            onSelectCategory={handleSelectCategory}
            onSelectTrending={handleSelectTrending}
            categories={categories}
            trendingProducts={trending}
            isTrendingLoading={isTrendingLoading}
            city={city}
          />
        )}

        {/* Smart market detection card */}
        {showResults && matchedStore && (
          <View style={styles.marketDetectionContainer}>
            <MarketDetectionCard
              storeData={matchedStore}
              onPress={handlePressStore}
            />
          </View>
        )}

        {/* Results — product-grouped mode */}
        {showResults && useProductMode && (
          <>
            <Text style={[styles.resultCount, { color: COLORS.textSecondary }]}>
              {resultCount} produto{resultCount !== 1 ? 's' : ''} encontrado{resultCount !== 1 ? 's' : ''} perto de você
            </Text>
            <SectionList
              sections={productSections}
              keyExtractor={(item) => item.product_id}
              renderItem={({ item, index }) => (
                <ProductPriceCard
                  product={item}
                  index={index}
                  onPressProduct={handlePressProduct}
                  onPressStore={handlePressStore}
                  onPressLocked={handlePressLocked}
                  testID={`product-card-${index}`}
                />
              )}
              renderSectionHeader={({ section: { title } }) =>
                title ? (
                  <Text style={[styles.sectionHeader, { color: COLORS.textSecondary, backgroundColor: tokens.bg }]}>
                    {title}
                  </Text>
                ) : null
              }
              contentContainerStyle={[
                styles.resultsList,
                { paddingBottom: insets.bottom + 16 },
              ]}
              showsVerticalScrollIndicator={false}
              keyboardDismissMode="on-drag"
            />
          </>
        )}

        {/* Results — store-grouped mode (original) */}
        {showResults && !useProductMode && (
          <>
            <Text style={[styles.resultCount, { color: COLORS.textSecondary }]}>
              {resultCount} resultado{resultCount !== 1 ? 's' : ''} perto de você
            </Text>
            <FlatList
              data={promotions}
              keyExtractor={(item) => item.id}
              renderItem={({ item, index }) => (
                <SearchResultCard
                  promotion={item}
                  onPress={handlePressItem}
                  onPressAdd={handleAddToList}
                  onPressLocked={handlePressLocked}
                  testID={`result-card-${index}`}
                />
              )}
              contentContainerStyle={[
                styles.resultsList,
                { paddingBottom: insets.bottom + 16 },
              ]}
              showsVerticalScrollIndicator={false}
              keyboardDismissMode="on-drag"
            />
          </>
        )}

        {/* Error state */}
        {showError && (
          <View style={styles.errorContainer}>
            <InlineError
              onRetry={retry}
              message="Não foi possível buscar produtos. Tentar novamente?"
            />
          </View>
        )}

        {/* Empty state */}
        {showEmpty && (
          <EmptyState
            icon={<SearchX size={36} color={tokens.primary} />}
            title="Nenhum resultado encontrado"
            subtitle={`Não encontramos "${debouncedQuery}" perto de você. Tente outro termo ou categoria.`}
          >
            {categories.length > 0 && (
              <View style={styles.emptySuggestions}>
                <Text style={[styles.emptySuggestLabel, { color: tokens.textHint }]}>
                  Categorias populares
                </Text>
                <View style={styles.emptySuggestRow}>
                  {categories.slice(0, 4).map((cat) => (
                    <Pressable
                      key={cat.id}
                      onPress={() => handleSelectCategory(cat.id, cat.name)}
                      style={[styles.suggestChip, { backgroundColor: tokens.primaryMuted }]}
                    >
                      <Text style={[styles.suggestChipText, { color: tokens.primary }]}>
                        {cat.name}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}
          </EmptyState>
        )}

      </SafeAreaView>

      {/* Paywall modal */}
      <Paywall
        visible={paywallVisible}
        onClose={() => setPaywallVisible(false)}
      />

      {/* Filter bottom sheet */}
      <SearchFilterSheet
        ref={filterSheetRef}
        filters={filters}
        onApply={handleApplyFilters}
        stores={storeList}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Colors (matching spec)
// ---------------------------------------------------------------------------

const COLORS = {
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',
  border: '#E5E7EB',
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginHorizontal: 16,
    marginTop: 8,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    padding: 0,
  },
  clearButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  filterDot: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  marketDetectionContainer: {
    paddingHorizontal: 16,
    marginTop: 8,
  },
  sortRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    gap: 8,
  },
  sortPill: {
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  sortPillText: {
    fontSize: 13,
    fontWeight: '600',
  },
  resultCount: {
    fontSize: 13,
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 8,
  },
  resultsList: {
    paddingHorizontal: 16,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingVertical: 8,
    paddingHorizontal: 2,
  },
  errorContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  emptySuggestions: {
    marginTop: 20,
    alignItems: 'center',
  },
  emptySuggestLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 10,
  },
  emptySuggestRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  suggestChip: {
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  suggestChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  storeFilterBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F0FDFA',
    marginHorizontal: 16,
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#99F6E4',
  },
  storeFilterText: {
    fontSize: 13,
    color: '#0D9488',
  },
  storeFilterName: {
    fontWeight: '700',
  },
});
