import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

import { useTheme } from '../theme/use-theme';

import type { StoreRanking as StoreRankingType, StoreRankEntry } from '@/hooks/use-store-ranking';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface StoreRankingProps {
  ranking: StoreRankingType;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatBRL(value: number): string {
  return `R$ ${value.toFixed(2).replace('.', ',')}`;
}

/** Generate a consistent background color from a store name. */
function avatarColorForName(name: string): string {
  const colors = [
    '#0D9488',
    '#0891B2',
    '#7C3AED',
    '#DB2777',
    '#D97706',
    '#16A34A',
    '#DC2626',
    '#2563EB',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) & 0xffffffff;
  }
  return colors[Math.abs(hash) % colors.length];
}

const MEDAL: Record<1 | 2 | 3, string> = {
  1: '🥇',
  2: '🥈',
  3: '🥉',
};

// ---------------------------------------------------------------------------
// RankCard
// ---------------------------------------------------------------------------

function RankCard({ entry }: { entry: StoreRankEntry }) {
  const { tokens } = useTheme();
  const isFirst = entry.rank === 1;
  const initial = entry.name.charAt(0).toUpperCase();
  const avatarBg = avatarColorForName(entry.name);

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: tokens.surface },
        isFirst && styles.cardFirst,
      ]}
    >
      {/* Medal */}
      <Text style={styles.medal}>{MEDAL[entry.rank]}</Text>

      {/* Avatar */}
      <View style={[styles.avatar, { backgroundColor: avatarBg }]}>
        <Text style={styles.avatarText}>{initial}</Text>
      </View>

      {/* Store name */}
      <Text
        numberOfLines={2}
        style={[styles.storeName, { color: tokens.textDark }]}
      >
        {entry.name}
      </Text>

      {/* Price */}
      <Text style={[styles.price, { color: tokens.success }]}>
        {formatBRL(entry.totalPrice)}
      </Text>

      {/* "Mais barato" badge — 1st place only */}
      {isFirst && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>Mais barato</Text>
        </View>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * "Ranking em Destaque" section showing top 3 cheapest stores as side-by-side
 * cards.
 */
export function StoreRanking({ ranking }: StoreRankingProps) {
  return (
    <View style={styles.row}>
      {ranking.stores.map((entry) => (
        <RankCard key={entry.id} entry={entry} />
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  card: {
    flex: 1,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  cardFirst: {
    borderWidth: 2,
    borderColor: '#F59E0B',
  },
  medal: {
    fontSize: 20,
    marginBottom: 6,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  storeName: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 4,
  },
  price: {
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
  badge: {
    marginTop: 6,
    backgroundColor: '#FEF3C7',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#92400E',
  },
});
