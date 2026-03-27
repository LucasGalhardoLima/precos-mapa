import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  TextInput,
  Text,
  Pressable,
  FlatList,
  Alert,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Search, X } from 'lucide-react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

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
import { useAuthStore } from '@poup/shared';
import { SearchDiscovery } from '@/components/search-discovery';
import { SearchResultCard } from '@/components/search-result-card';
import { SearchSkeleton } from '@/components/skeleton/search-skeleton';
import { Paywall } from '@/components/paywall';

import type { SortMode, EnrichedPromotion } from '@/types';

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
  const { latitude, longitude } = useLocation();
  const { recentSearches, addSearch, clearSearches } = useRecentSearches();
  const { categories } = useCategories();
  const { trending, isLoading: isTrendingLoading } = useTrending();
  const { lists, addItem, createList } = useShoppingList();

  const { storeId, storeName } = useLocalSearchParams<{ storeId?: string; storeName?: string }>();

  // Local state
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [categoryId, setCategoryId] = useState<string | undefined>(undefined);
  const [sortMode, setSortMode] = useState<SortMode>('cheapest');
  const [paywallVisible, setPaywallVisible] = useState(false);
  const inputRef = useRef<TextInput>(null);

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

  // Fetch promotions only when we have a query, category, or store filter
  const { promotions, isLoading, isEmpty } = usePromotions({
    productQuery: debouncedQuery || undefined,
    categoryId,
    storeId: storeId || undefined,
    sortMode,
    userLatitude: latitude,
    userLongitude: longitude,
  });

  // Navigation / interaction handlers
  const handlePressItem = useCallback(
    (promotion: EnrichedPromotion) => {
      router.push(`/product/${promotion.product_id}`);
    },
    [router],
  );

  const handlePressLocked = useCallback(() => {
    setPaywallVisible(true);
  }, []);

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
      triggerNotification(NotificationFeedbackType.Success);
      Burnt.toast({
        title: 'Adicionado à lista',
        preset: 'done',
        haptic: 'success',
      });
    } catch {
      Alert.alert('Erro', 'Não foi possível adicionar à lista.');
    }
  }, [lists, addItem, createList, router]);

  // View state
  const hasFilter = debouncedQuery.length > 0 || !!categoryId || !!storeId;
  const showLoading = hasFilter && isLoading;
  const showEmpty = hasFilter && !isLoading && isEmpty;
  const showResults = hasFilter && !isLoading && !isEmpty;
  const showDiscovery = !hasFilter;

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

        {/* Sort tabs — shown only when viewing results */}
        {showResults && (
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
          />
        )}

        {/* Results list */}
        {showResults && (
          <>
            <Text style={[styles.resultCount, { color: COLORS.textSecondary }]}>
              {promotions.length} resultado{promotions.length !== 1 ? 's' : ''} perto de você
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

        {/* Empty state */}
        {showEmpty && (
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyTitle, { color: tokens.textPrimary }]}>
              Nenhum resultado encontrado
            </Text>
            <Text style={[styles.emptySubtitle, { color: tokens.textHint }]}>
              Tente outro produto ou categoria
            </Text>
          </View>
        )}

      </SafeAreaView>

      {/* Paywall modal */}
      <Paywall
        visible={paywallVisible}
        onClose={() => setPaywallVisible(false)}
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
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 6,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
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
