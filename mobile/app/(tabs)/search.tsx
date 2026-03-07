import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  TextInput,
  Text,
  Pressable,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Search, X } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';

import { useTheme } from '@/theme/use-theme';
import { triggerHaptic } from '@/hooks/use-haptics';
import { usePromotions } from '@/hooks/use-promotions';
import { useLocation } from '@/hooks/use-location';
import { SearchResults } from '@/components/search-results';
import { SearchSkeleton } from '@/components/skeleton/search-skeleton';
import { Paywall } from '@/components/paywall';

import type { SortMode, EnrichedPromotion } from '@/types';

const HAS_GLASS = isLiquidGlassAvailable();

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

  // Local state
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('cheapest');
  const [paywallVisible, setPaywallVisible] = useState(false);

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

  // Navigation handlers
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

  // Determine view state
  const hasQuery = debouncedQuery.length > 0;
  const showLoading = hasQuery && isLoading;
  const showEmpty = hasQuery && isEmpty;
  const showResults = hasQuery && !isLoading && !isEmpty;
  const showInitial = !hasQuery;

  return (
    <View style={[styles.screen, { backgroundColor: tokens.bg }]}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        {/* Search input */}
        {(() => {
          const searchInputContent = (
            <>
              <Search size={18} color={tokens.textHint} />
              <TextInput
                style={[styles.searchInput, { color: tokens.textPrimary }]}
                placeholder="Buscar produto..."
                placeholderTextColor={tokens.textHint}
                value={query}
                onChangeText={setQuery}
                returnKeyType="search"
                autoCorrect={false}
              />
              {query.length > 0 && (
                <Pressable onPress={clearQuery} hitSlop={8}>
                  <X size={18} color={tokens.textHint} />
                </Pressable>
              )}
            </>
          );

          return HAS_GLASS ? (
            <GlassView glassEffectStyle="regular" style={styles.searchBar}>
              {searchInputContent}
            </GlassView>
          ) : (
            <View
              style={[
                styles.searchBar,
                { backgroundColor: tokens.surface, borderWidth: 1, borderColor: tokens.border },
              ]}
            >
              {searchInputContent}
            </View>
          );
        })()}

        {/* Sort tabs */}
        <View style={styles.sortRow}>
          {SORT_TABS.map((tab) => {
            const active = sortMode === tab.mode;

            if (active) {
              return (
                <Pressable
                  key={tab.mode}
                  onPress={() => {
                    triggerHaptic();
                    setSortMode(tab.mode);
                  }}
                  style={[styles.sortPill, { backgroundColor: tokens.primary }]}
                >
                  <Text style={[styles.sortPillText, { color: '#FFFFFF' }]}>
                    {tab.label}
                  </Text>
                </Pressable>
              );
            }

            if (HAS_GLASS) {
              return (
                <Pressable
                  key={tab.mode}
                  onPress={() => {
                    triggerHaptic();
                    setSortMode(tab.mode);
                  }}
                  style={[styles.sortPill, { padding: 0, overflow: 'hidden' }]}
                >
                  <GlassView glassEffectStyle="clear" style={styles.sortPillGlass}>
                    <Text style={[styles.sortPillText, { color: tokens.textSecondary }]}>
                      {tab.label}
                    </Text>
                  </GlassView>
                </Pressable>
              );
            }

            return (
              <Pressable
                key={tab.mode}
                onPress={() => {
                  triggerHaptic();
                  setSortMode(tab.mode);
                }}
                style={[
                  styles.sortPill,
                  {
                    backgroundColor: tokens.surface,
                    borderWidth: 1,
                    borderColor: tokens.border,
                  },
                ]}
              >
                <Text style={[styles.sortPillText, { color: tokens.textSecondary }]}>
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Content area */}
        {showLoading && <SearchSkeleton />}

        {showResults && (
          <SearchResults
            promotions={promotions}
            onPressItem={handlePressItem}
            onPressLocked={handlePressLocked}
            contentContainerStyle={{
              paddingHorizontal: 16,
              paddingBottom: insets.bottom,
            }}
          />
        )}

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

        {showInitial && (
          <View style={styles.emptyContainer}>
            <Search size={48} color={tokens.textHint} />
            <Text
              style={[
                styles.initialText,
                { color: tokens.textSecondary, marginTop: 16 },
              ]}
            >
              Pesquise um produto para comparar preços
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
  sortRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginTop: 12,
    marginBottom: 12,
    gap: 8,
  },
  sortPill: {
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  sortPillGlass: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  sortPillText: {
    fontSize: 13,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 6,
  },
  initialText: {
    fontSize: 15,
    textAlign: 'center',
  },
});
