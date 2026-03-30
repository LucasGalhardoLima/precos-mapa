import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  FlatList,
  Pressable,
  StatusBar,
  StyleSheet,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ChevronDown, MapPin } from 'lucide-react-native';

import { GradientHeader } from '@/components/gradient-header';
import { useTheme } from '@/theme/use-theme';
import { useStoreRanking } from '@/hooks/use-store-ranking';
import { usePromotions } from '@/hooks/use-promotions';
import { useCategories } from '@/hooks/use-categories';
import { useLocation } from '@/hooks/use-location';
import { useStores } from '@/hooks/use-stores';
import { StoreRanking as StoreRankingComponent } from '@/components/store-ranking';
import { StoreCard } from '@/components/store-card';
import { DealCard } from '@/components/themed/deal-card';
import { HomeSkeleton } from '@/components/skeleton/home-skeleton';
import { InlineError } from '@/components/inline-error';

import type { EnrichedPromotion } from '@/types';

const keyExtractor = (item: EnrichedPromotion) => item.id;
const CITY_OPTIONS = [
  { city: 'Matao', state: 'SP' },
  { city: 'Araraquara', state: 'SP' },
  { city: 'Ribeirao Preto', state: 'SP' },
  { city: 'Sao Carlos', state: 'SP' },
];

// ---------------------------------------------------------------------------
// Home Screen
// ---------------------------------------------------------------------------

export default function HomeScreen() {
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const { latitude, longitude, city, state, locationLabel, setPreferredCity } = useLocation();

  // ---------------------------------------------------------------------------
  // Category filter state
  // ---------------------------------------------------------------------------
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [cityPickerVisible, setCityPickerVisible] = useState(false);

  // ---------------------------------------------------------------------------
  // Data hooks
  // ---------------------------------------------------------------------------
  const { ranking } = useStoreRanking({
    userLatitude: latitude,
    userLongitude: longitude,
  });

  const {
    promotions,
    isLoading: promotionsLoading,
    error: promotionsError,
    retry: retryPromotions,
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

  const {
    stores,
    isLoading: storesLoading,
    error: storesError,
    retry: retryStores,
  } = useStores({
    userLatitude: latitude,
    userLongitude: longitude,
  });

  // ---------------------------------------------------------------------------
  // Error state
  // ---------------------------------------------------------------------------
  const hasError = !!(promotionsError || storesError);

  const handleRetry = useCallback(() => {
    if (promotionsError) retryPromotions();
    if (storesError) retryStores();
  }, [promotionsError, storesError, retryPromotions, retryStores]);

  // ---------------------------------------------------------------------------
  // Render helpers
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
  const handleSelectCity = useCallback(
    async (nextCity: string, nextState: string) => {
      await setPreferredCity(nextCity, nextState);
      setCityPickerVisible(false);
    },
    [setPreferredCity],
  );

  const isLoading = promotionsLoading || categoriesLoading || storesLoading;

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
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 16 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.locationSection}>
          <Pressable
            onPress={() => setCityPickerVisible(true)}
            accessibilityRole="button"
            accessibilityLabel="Selecionar cidade"
            style={styles.locationPill}
          >
            <MapPin size={14} color="#E2E8F0" />
            <Text style={styles.locationLabel}>{locationLabel}</Text>
            <ChevronDown size={14} color="#E2E8F0" />
          </Pressable>
        </View>

        {/* ------------------------------------------------------------------ */}
        {/* 1. Ranking em Destaque                                              */}
        {/* ------------------------------------------------------------------ */}
        {ranking && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: tokens.textDark }]}>
                🏆 Ranking em Destaque
              </Text>
              <Pressable
                onPress={() => router.push('/search')}
                accessibilityLabel="Ver todos os rankings"
                accessibilityRole="link"
              >
                <Text style={[styles.sectionLink, { color: tokens.primary }]}>
                  Ver todos →
                </Text>
              </Pressable>
            </View>
            <StoreRankingComponent ranking={ranking} />
          </View>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* 2. Category pills                                                   */}
        {/* ------------------------------------------------------------------ */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipsScrollView}
          contentContainerStyle={styles.chipsContentContainer}
        >
          {/* "Todos" pill */}
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

        {/* ------------------------------------------------------------------ */}
        {/* 3. Ofertas perto de você                                            */}
        {/* ------------------------------------------------------------------ */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: tokens.textDark }]}>
              Ofertas perto de você
            </Text>
            <Pressable
              onPress={() => router.push('/search')}
              accessibilityLabel="Ver todas as ofertas"
              accessibilityRole="link"
            >
              <Text style={[styles.sectionLink, { color: tokens.primary }]}>
                Ver todas →
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

        {/* ------------------------------------------------------------------ */}
        {/* 4. Mercados perto de você                                           */}
        {/* ------------------------------------------------------------------ */}
        {stores.length > 0 && (
          <View style={[styles.section, styles.sectionLast]}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: tokens.textDark }]}>
                Mercados perto de você
              </Text>
              <Pressable
                onPress={() => router.push('/(tabs)/map')}
                accessibilityLabel="Abrir mapa"
                accessibilityRole="link"
              >
                <Text style={[styles.sectionLink, { color: tokens.primary }]}>
                  Mapa
                </Text>
              </Pressable>
            </View>

            {stores.slice(0, 6).map((sw) => (
              <StoreCard
                key={sw.store.id}
                name={sw.store.name}
                address={sw.store.address}
                logoInitial={sw.store.logo_initial}
                logoColor={sw.store.logo_color}
                distanceKm={sw.distanceKm}
                dealCount={sw.activePromotionCount}
                isOpen
                onPress={() => router.push({ pathname: '/(tabs)/map', params: { storeId: sw.store.id } } as any)}
              />
            ))}
          </View>
        )}
      </ScrollView>

      <Modal
        visible={cityPickerVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setCityPickerVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setCityPickerVisible(false)} />
          <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 12 }]}>
            <Text style={styles.modalTitle}>Selecionar cidade</Text>
            {CITY_OPTIONS.map((option) => {
              const isActive = option.city === city && option.state === state;
              return (
                <Pressable
                  key={`${option.city}-${option.state}`}
                  onPress={() => handleSelectCity(option.city, option.state)}
                  style={[
                    styles.cityOption,
                    isActive
                      ? { backgroundColor: tokens.primaryMuted, borderColor: tokens.primary }
                      : { backgroundColor: tokens.surface, borderColor: tokens.border },
                  ]}
                >
                  <Text style={[styles.cityOptionText, { color: tokens.textPrimary }]}>
                    {option.city}, {option.state}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </Modal>
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
  scrollContent: {
    paddingTop: 12,
  },
  locationSection: {
    paddingHorizontal: 16,
    marginBottom: 14,
  },
  locationPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#115E59',
    borderWidth: 1,
    borderColor: '#0F766E',
  },
  locationLabel: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '500',
  },
  section: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  sectionLast: {
    marginBottom: 0,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    fontFamily: 'Poppins_700Bold',
  },
  sectionLink: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Inter_500Medium',
  },
  // Category pills
  chipsScrollView: {
    marginBottom: 24,
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
  // Deals
  dealsList: {
    // no extra margin needed; section already has paddingHorizontal
  },
  dealsListContent: {
    gap: 12,
    // the section has horizontal padding but the FlatList needs to break out for full bleed
    paddingHorizontal: 0,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(2, 6, 23, 0.4)',
  },
  modalSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 16,
    backgroundColor: '#FFFFFF',
    gap: 10,
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  cityOption: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  cityOptionText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
