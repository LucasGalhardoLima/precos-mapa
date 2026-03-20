import React from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { Clock, TrendingUp } from 'lucide-react-native';

import { useTheme } from '@/theme/use-theme';

// ---------------------------------------------------------------------------
// Static data
// ---------------------------------------------------------------------------

const CATEGORY_GRID = [
  { emoji: '🥛', name: 'Laticínios' },
  { emoji: '🥩', name: 'Carnes' },
  { emoji: '🥬', name: 'Hortifrúti' },
  { emoji: '🍞', name: 'Padaria' },
  { emoji: '🧹', name: 'Limpeza' },
  { emoji: '🧴', name: 'Higiene' },
  { emoji: '🍺', name: 'Bebidas' },
  { emoji: '🐶', name: 'Pet' },
];

const TRENDING = [
  {
    rank: 1,
    name: 'Óleo de Soja 900ml',
    priceRange: 'R$ 5,49 – R$ 8,99',
    stores: 6,
    badge: '-15%',
    badgeColor: '#16A34A',
  },
  {
    rank: 2,
    name: 'Sabão em Pó Omo 1,6kg',
    priceRange: 'R$ 16,90 – R$ 24,99',
    stores: 5,
    badge: '-10%',
    badgeColor: '#D97706',
  },
  {
    rank: 3,
    name: 'Frango Inteiro Resfriado',
    priceRange: 'R$ 8,99/kg – R$ 14,90/kg',
    stores: 4,
    badge: undefined,
    badgeColor: undefined,
  },
];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SearchDiscoveryProps {
  recentSearches: string[];
  onSelectRecent: (query: string) => void;
  onClearRecents: () => void;
  onSelectCategory: (categoryName: string) => void;
  onSelectTrending: (name: string) => void;
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
}: SearchDiscoveryProps) {
  const { tokens } = useTheme();

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
          <View style={styles.recentPills}>
            {recentSearches.map((query) => (
              <Pressable
                key={query}
                onPress={() => onSelectRecent(query)}
                style={[styles.recentPill, { borderColor: COLORS.border }]}
              >
                <Clock size={13} color={COLORS.textSecondary} />
                <Text style={[styles.recentPillText, { color: COLORS.textSecondary }]}>
                  {query}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {/* Categorias */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: tokens.textPrimary }]}>
            Categorias
          </Text>
        </View>
        <View style={styles.categoryGrid}>
          {CATEGORY_GRID.map((cat) => (
            <Pressable
              key={cat.name}
              onPress={() => onSelectCategory(cat.name)}
              style={[styles.categoryCell, { backgroundColor: tokens.surface }]}
            >
              <Text style={styles.categoryEmoji}>{cat.emoji}</Text>
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

      {/* Em alta perto de você */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: tokens.textPrimary }]}>
            Em alta perto de você
          </Text>
          <TrendingUp size={16} color={tokens.primary} />
        </View>
        <View style={[styles.trendingList, { backgroundColor: tokens.surface }]}>
          {TRENDING.map((item, index) => (
            <React.Fragment key={item.name}>
              <Pressable
                onPress={() => onSelectTrending(item.name)}
                style={styles.trendingRow}
              >
                <Text style={[styles.trendingRank, { color: tokens.primary }]}>
                  {item.rank}
                </Text>
                <View style={styles.trendingInfo}>
                  <Text
                    style={[styles.trendingName, { color: COLORS.textDark }]}
                    numberOfLines={1}
                  >
                    {item.name}
                  </Text>
                  <Text style={[styles.trendingMeta, { color: COLORS.textSecondary }]}>
                    {item.priceRange} · {item.stores} lojas
                  </Text>
                </View>
                {item.badge && item.badgeColor && (
                  <View
                    style={[
                      styles.trendingBadge,
                      { backgroundColor: item.badgeColor + '20' },
                    ]}
                  >
                    <Text
                      style={[styles.trendingBadgeText, { color: item.badgeColor }]}
                    >
                      {item.badge}
                    </Text>
                  </View>
                )}
              </Pressable>
              {index < TRENDING.length - 1 && (
                <View style={[styles.divider, { backgroundColor: COLORS.border }]} />
              )}
            </React.Fragment>
          ))}
        </View>
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
  // Recent searches
  recentPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  recentPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  recentPillText: {
    fontSize: 13,
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
});
