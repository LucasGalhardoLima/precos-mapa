import React from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { Clock, TrendingUp, ChevronRight } from 'lucide-react-native';

import { useTheme } from '@/theme/use-theme';
import type { Category } from '@/types';
import type { TrendingProduct } from '@/hooks/use-trending';

// ---------------------------------------------------------------------------
// Emoji mapping for categories (match by normalized name)
// ---------------------------------------------------------------------------

const CATEGORY_EMOJI: Record<string, string> = {
  laticinios: '🥛',
  carnes: '🥩',
  hortifruti: '🥬',
  padaria: '🍞',
  limpeza: '🧹',
  higiene: '🧴',
  bebidas: '🍺',
  pet: '🐶',
  alimentos: '🍚',
};

function normalize(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function getCategoryEmoji(name: string): string {
  return CATEGORY_EMOJI[normalize(name)] ?? '🛒';
}

function formatPrice(price: number): string {
  return 'R$ ' + price.toFixed(2).replace('.', ',');
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SearchDiscoveryProps {
  recentSearches: string[];
  onSelectRecent: (query: string) => void;
  onClearRecents: () => void;
  onSelectCategory: (categoryId: string, categoryName: string) => void;
  onSelectTrending: (productId: string, name: string) => void;
  categories: Category[];
  trendingProducts: TrendingProduct[];
  isTrendingLoading?: boolean;
  city?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SearchDiscovery({
  recentSearches,
  onSelectRecent,
  onClearRecents,
  onSelectCategory,
  onSelectTrending,
  categories,
  trendingProducts,
  isTrendingLoading,
  city,
}: SearchDiscoveryProps) {
  const { tokens } = useTheme();

  // Filter out "Todos" category
  const filteredCategories = categories.filter(
    (cat) => normalize(cat.name) !== 'todos',
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {/* Buscas recentes */}
      {recentSearches.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: tokens.textPrimary }]}>
              Buscas recentes
            </Text>
            <Pressable onPress={onClearRecents} hitSlop={8}>
              <Text style={[styles.clearLink, { color: tokens.primary }]}>
                Limpar
              </Text>
            </Pressable>
          </View>
          <View style={[styles.recentList, { backgroundColor: tokens.surface }]}>
            {recentSearches.map((query, idx) => (
              <React.Fragment key={query}>
                <Pressable
                  onPress={() => onSelectRecent(query)}
                  style={styles.recentRow}
                >
                  <Clock size={14} color={COLORS.textSecondary} />
                  <Text
                    style={[styles.recentRowText, { color: COLORS.textDark }]}
                    numberOfLines={1}
                  >
                    {query}
                  </Text>
                  <ChevronRight size={14} color={COLORS.textSecondary} />
                </Pressable>
                {idx < recentSearches.length - 1 && (
                  <View style={[styles.divider, { backgroundColor: COLORS.border }]} />
                )}
              </React.Fragment>
            ))}
          </View>
        </View>
      )}

      {/* Categorias */}
      {filteredCategories.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: tokens.textPrimary }]}>
              Categorias
            </Text>
          </View>
          <View style={styles.categoryGrid}>
            {filteredCategories.map((cat) => (
              <Pressable
                key={cat.id}
                onPress={() => onSelectCategory(cat.id, cat.name)}
                style={[styles.categoryCell, { backgroundColor: tokens.surface }]}
              >
                <Text style={styles.categoryEmoji}>{getCategoryEmoji(cat.name)}</Text>
                <Text
                  style={[styles.categoryName, { color: COLORS.textDark }]}
                  numberOfLines={1}
                >
                  {cat.name}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {/* Populares em [Cidade] */}
      {city && trendingProducts.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: tokens.textPrimary }]}>
              Populares em {city}
            </Text>
          </View>
          <View style={styles.popularChips}>
            {trendingProducts.slice(0, 8).map((item) => (
              <Pressable
                key={item.id}
                onPress={() => onSelectTrending(item.id, item.name)}
                style={[styles.popularChip, { backgroundColor: tokens.primaryMuted }]}
              >
                <Text style={[styles.popularChipText, { color: tokens.primary }]}>
                  {item.name}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {/* Em alta perto de você */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: tokens.textPrimary }]}>
            Em alta perto de você
          </Text>
          <TrendingUp size={16} color={tokens.primary} />
        </View>
        {isTrendingLoading ? (
          <View style={styles.trendingLoading}>
            <ActivityIndicator size="small" color={tokens.primary} />
          </View>
        ) : trendingProducts.length === 0 ? (
          <View style={[styles.trendingList, { backgroundColor: tokens.surface }]}>
            <View style={styles.trendingRow}>
              <Text style={[styles.trendingMeta, { color: COLORS.textSecondary }]}>
                Nenhum produto em alta no momento
              </Text>
            </View>
          </View>
        ) : (
          <View style={[styles.trendingList, { backgroundColor: tokens.surface }]}>
            {trendingProducts.map((item, index) => {
              const badgeColor = item.discountPercent >= 15 ? '#16A34A' : item.discountPercent >= 10 ? '#D97706' : undefined;
              return (
                <React.Fragment key={item.id}>
                  <Pressable
                    onPress={() => onSelectTrending(item.id, item.name)}
                    style={styles.trendingRow}
                  >
                    <Text style={[styles.trendingRank, { color: tokens.primary }]}>
                      {index + 1}
                    </Text>
                    <View style={styles.trendingInfo}>
                      <Text
                        style={[styles.trendingName, { color: COLORS.textDark }]}
                        numberOfLines={1}
                      >
                        {item.name}
                      </Text>
                      <Text style={[styles.trendingMeta, { color: COLORS.textSecondary }]}>
                        {formatPrice(item.minPrice)} – {formatPrice(item.maxPrice)} · {item.storeCount} {item.storeCount === 1 ? 'loja' : 'lojas'}
                      </Text>
                    </View>
                    {badgeColor && (
                      <View
                        style={[
                          styles.trendingBadge,
                          { backgroundColor: badgeColor + '20' },
                        ]}
                      >
                        <Text
                          style={[styles.trendingBadgeText, { color: badgeColor }]}
                        >
                          -{item.discountPercent}%
                        </Text>
                      </View>
                    )}
                  </Pressable>
                  {index < trendingProducts.length - 1 && (
                    <View style={[styles.divider, { backgroundColor: COLORS.border }]} />
                  )}
                </React.Fragment>
              );
            })}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Colors (matching spec)
// ---------------------------------------------------------------------------

const COLORS = {
  textDark: '#134E4A',
  textSecondary: '#6B7280',
  border: '#E5E7EB',
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  section: {
    marginTop: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  clearLink: {
    fontSize: 13,
    fontWeight: '600',
  },
  // Recent searches (vertical list)
  recentList: {
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
    overflow: 'hidden',
  },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  recentRowText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
  },
  // Populares chips
  popularChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  popularChip: {
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  popularChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  // Category grid: 4 columns
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  categoryCell: {
    // 4 columns with gap 10: (100% - 3*10) / 4 — use flexBasis trick
    flexBasis: '22%',
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
    gap: 6,
  },
  categoryEmoji: {
    fontSize: 24,
  },
  categoryName: {
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
  // Trending
  trendingList: {
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
    overflow: 'hidden',
  },
  trendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  trendingRank: {
    fontSize: 14,
    fontWeight: '700',
    width: 20,
    textAlign: 'center',
  },
  trendingInfo: {
    flex: 1,
    gap: 2,
  },
  trendingName: {
    fontSize: 14,
    fontWeight: '700',
  },
  trendingMeta: {
    fontSize: 12,
  },
  trendingBadge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  trendingBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 16,
  },
  trendingLoading: {
    alignItems: 'center',
    paddingVertical: 24,
  },
});
