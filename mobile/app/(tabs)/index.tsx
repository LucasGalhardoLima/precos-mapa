import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  FlatList,
  Pressable,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { useTheme } from '@/theme/use-theme';
import { useStoreRanking } from '@/hooks/use-store-ranking';
import { usePromotions } from '@/hooks/use-promotions';
import { useCategories } from '@/hooks/use-categories';
import { useLocation } from '@/hooks/use-location';
import { StoreRanking as StoreRankingComponent } from '@/components/store-ranking';
import { SearchBar } from '@/components/search-bar';
import { DealCard } from '@/components/themed/deal-card';
import { SectionDivider } from '@/components/themed/section-divider';
import { HomeSkeleton } from '@/components/skeleton/home-skeleton';
import { InlineError } from '@/components/inline-error';

import type { EnrichedPromotion } from '@/types';

const keyExtractor = (item: EnrichedPromotion) => item.id;

// ---------------------------------------------------------------------------
// Home Screen
// ---------------------------------------------------------------------------

export default function HomeScreen() {
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const { latitude, longitude } = useLocation();

  // ---------------------------------------------------------------------------
  // Category filter state
  // ---------------------------------------------------------------------------
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Data hooks
  // ---------------------------------------------------------------------------
  const {
    ranking,
  } = useStoreRanking({
    userLatitude: latitude,
    userLongitude: longitude,
  });

  const {
    promotions,
    isLoading: promotionsLoading,
  } = usePromotions({
    sortMode: 'nearest',
    userLatitude: latitude,
    userLongitude: longitude,
    categoryId: selectedCategory ?? undefined,
  });

  const {
    categories,
    isLoading: categoriesLoading,
  } = useCategories();

  // ---------------------------------------------------------------------------
  // Error state (simplified: track if any hook threw)
  // ---------------------------------------------------------------------------
  const [hasError, setHasError] = useState(false);

  const handleRetry = useCallback(() => {
    setHasError(false);
  }, []);

  // ---------------------------------------------------------------------------
  // Loading / Error
  // ---------------------------------------------------------------------------
  const renderDealCard = useCallback(
    ({ item }: { item: EnrichedPromotion }) => (
      <DealCard
        deal={item}
        compact
        onPress={() => router.push(`/product/${item.product_id}`)}
      />
    ),
    [],
  );

  const isLoading = promotionsLoading || categoriesLoading;

  if (hasError) {
    return (
      <SafeAreaView
        edges={['top']}
        style={[styles.safeArea, { backgroundColor: tokens.bg }]}
      >
        <View style={styles.errorContainer}>
          <InlineError onRetry={handleRetry} />
        </View>
      </SafeAreaView>
    );
  }

  if (isLoading) {
    return (
      <SafeAreaView
        edges={['top']}
        style={[styles.safeArea, { backgroundColor: tokens.bg }]}
      >
        <HomeSkeleton />
      </SafeAreaView>
    );
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <SafeAreaView
      edges={['top']}
      style={[styles.safeArea, { backgroundColor: tokens.bg }]}
    >
      <ScrollView
        contentContainerStyle={{
          paddingBottom: insets.bottom,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Search Bar */}
        <View style={styles.searchBarWrapper}>
          <SearchBar />
        </View>

        {/* Category Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipsScrollView}
          contentContainerStyle={styles.chipsContentContainer}
        >
          {/* "Todos" chip */}
          <Pressable
            onPress={() => setSelectedCategory(null)}
            style={[
              styles.chip,
              !selectedCategory
                ? { backgroundColor: tokens.primary }
                : {
                    backgroundColor: tokens.surface,
                    borderWidth: 1,
                    borderColor: tokens.border,
                  },
            ]}
          >
            <Text
              style={[
                styles.chipText,
                !selectedCategory
                  ? { color: '#FFFFFF', fontWeight: '600' }
                  : { color: tokens.textSecondary, fontWeight: '500' },
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
                  styles.chip,
                  isActive
                    ? { backgroundColor: tokens.primary }
                    : {
                        backgroundColor: tokens.surface,
                        borderWidth: 1,
                        borderColor: tokens.border,
                      },
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    isActive
                      ? { color: '#FFFFFF', fontWeight: '600' }
                      : { color: tokens.textSecondary, fontWeight: '500' },
                  ]}
                >
                  {cat.name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Deals Carousel */}
        <View style={styles.dealsSection}>
          <View style={styles.dealsSectionHeader}>
            <Text
              style={[styles.dealsSectionTitle, { color: tokens.textPrimary }]}
            >
              Ofertas perto de você
            </Text>
            <Pressable onPress={() => router.push('/search')}>
              <Text
                style={[styles.dealsSectionLink, { color: tokens.primary }]}
              >
                Ver todas
              </Text>
            </Pressable>
          </View>

          <FlatList
            horizontal
            data={promotions.slice(0, 10)}
            keyExtractor={keyExtractor}
            renderItem={renderDealCard}
            showsHorizontalScrollIndicator={false}
            style={styles.dealsList}
            contentContainerStyle={styles.dealsListContent}
          />
        </View>

        {/* Section Divider */}
        <SectionDivider
          style={{ marginVertical: 20, marginHorizontal: 16 }}
        />

        {/* Store Ranking */}
        {ranking && (
          <View style={styles.rankingWrapper}>
            <StoreRankingComponent ranking={ranking} />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    padding: 16,
  },
  searchBarWrapper: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  chipsScrollView: {
    marginTop: 12,
  },
  chipsContentContainer: {
    paddingLeft: 16,
    paddingRight: 8,
    gap: 8,
  },
  chip: {
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  chipText: {
    fontSize: 13,
  },
  dealsSection: {
    marginTop: 20,
  },
  dealsSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  dealsSectionTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  dealsSectionLink: {
    fontSize: 14,
    fontWeight: '600',
  },
  dealsList: {
    marginTop: 12,
  },
  dealsListContent: {
    paddingHorizontal: 16,
    gap: 12,
  },
  rankingWrapper: {
    paddingHorizontal: 16,
  },
});
