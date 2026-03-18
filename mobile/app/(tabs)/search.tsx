import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  TextInput,
  Text,
  Pressable,
  FlatList,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Search, X } from 'lucide-react-native';
import { useRouter } from 'expo-router';

import { useTheme } from '@/theme/use-theme';
import { triggerHaptic } from '@/hooks/use-haptics';
import { usePromotions } from '@/hooks/use-promotions';
import { useLocation } from '@/hooks/use-location';
import { useRecentSearches } from '@/hooks/use-recent-searches';
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

  // Local state
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
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

  // Fetch promotions only when we have a query
  const { promotions, isLoading, isEmpty } = usePromotions({
    productQuery: debouncedQuery || undefined,
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
    triggerHaptic();
  }, []);

  const handleSelectCategory = useCallback((categoryName: string) => {
    setQuery(categoryName);
    setDebouncedQuery(categoryName);
    addSearch(categoryName);
    triggerHaptic();
  }, [addSearch]);

  const handleSelectTrending = useCallback((productName: string) => {
    setQuery(productName);
    setDebouncedQuery(productName);
    addSearch(productName);
    triggerHaptic();
  }, [addSearch]);

  // View state
  const hasQuery = debouncedQuery.length > 0;
  const showLoading = hasQuery && isLoading;
  const showEmpty = hasQuery && !isLoading && isEmpty;
  const showResults = hasQuery && !isLoading && !isEmpty;
  const showDiscovery = !hasQuery;

  // Search bar style: focused (teal) when query is active
  const searchBarStyle = hasQuery
    ? [styles.searchBar, { backgroundColor: tokens.surface, borderColor: tokens.primary, borderWidth: 1.5 }]
    : [styles.searchBar, { backgroundColor: tokens.surface, borderColor: COLORS.border, borderWidth: 1 }];

  const searchIconColor = hasQuery ? tokens.primary : COLORS.textMuted;

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
});
