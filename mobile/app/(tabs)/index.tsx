import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  FlatList,
  Pressable,
  StatusBar,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { GradientHeader } from '@/components/gradient-header';

import { useTheme } from '@/theme/use-theme';
import { useStoreRanking } from '@/hooks/use-store-ranking';
import { usePromotions } from '@/hooks/use-promotions';
import { useCategories } from '@/hooks/use-categories';
import { useLocation } from '@/hooks/use-location';
import { StoreRanking as StoreRankingComponent } from '@/components/store-ranking';
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
      <View style={[styles.safeArea, { backgroundColor: tokens.bg }]}>
        <StatusBar barStyle="light-content" />
        <GradientHeader />
        <View style={styles.errorContainer}>
          <InlineError onRetry={handleRetry} />
        </View>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={[styles.safeArea, { backgroundColor: tokens.bg }]}>
        <StatusBar barStyle="light-content" />
        <GradientHeader />
        <HomeSkeleton />
      </View>
    );
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <View style={[styles.safeArea, { backgroundColor: tokens.bg }]}>
      <StatusBar barStyle="light-content" />
      <GradientHeader />
      <ScrollView
        contentContainerStyle={{
          paddingBottom: insets.bottom,
        }}
        showsVerticalScrollIndicator={false}
      >
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
            accessibilityLabel="Todos"
            accessibilityRole="button"
            accessibilityState={{ selected: !selectedCategory }}
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
                accessibilityLabel={cat.name}
                accessibilityRole="button"
                accessibilityState={{ selected: isActive }}
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
            <Pressable
              onPress={() => router.push('/search')}
              accessibilityLabel="Ver todas as ofertas"
              accessibilityRole="link"
            >
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
    </View>
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
