import React from 'react';
import { View, Text } from 'react-native';

import { useTheme } from '../theme/use-theme';
import { DiscountBadge } from './themed/discount-badge';

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

// ---------------------------------------------------------------------------
// Row
// ---------------------------------------------------------------------------

function RankRow({
  entry,
  isLast,
}: {
  entry: StoreRankEntry;
  isLast: boolean;
}) {
  const { tokens } = useTheme();

  const positionColor =
    entry.rank === 1
      ? tokens.primary
      : entry.rank === 2
        ? tokens.textPrimary
        : tokens.textHint;

  return (
    <>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: 12,
        }}
      >
        {/* Position */}
        <Text
          style={{
            fontSize: 20,
            fontWeight: '700',
            color: positionColor,
            width: 40,
          }}
        >
          {entry.rank}º
        </Text>

        {/* Store info */}
        <View style={{ flex: 1 }}>
          <Text
            style={{
              color: tokens.textPrimary,
              fontWeight: '600',
              fontSize: 15,
            }}
            numberOfLines={1}
          >
            {entry.name}
          </Text>
          <Text
            style={{
              color: tokens.textHint,
              fontSize: 12,
              marginTop: 2,
            }}
          >
            total da lista base
          </Text>
        </View>

        {/* Price + badge */}
        <View style={{ alignItems: 'flex-end' }}>
          <Text
            style={{
              color: tokens.textPrimary,
              fontWeight: '700',
              fontSize: 15,
            }}
          >
            {formatBRL(entry.totalPrice)}
          </Text>
          {entry.rank === 1 && entry.savingsPercent > 0 && (
            <View style={{ marginTop: 4 }}>
              <DiscountBadge
                label={`-${entry.savingsPercent}%`}
                variant="highlight"
              />
            </View>
          )}
        </View>
      </View>

      {/* Separator between rows */}
      {!isLast && (
        <View
          style={{
            height: 1,
            backgroundColor: tokens.border,
          }}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * "Ranking da semana" section showing top 3 cheapest stores.
 */
export function StoreRanking({ ranking }: StoreRankingProps) {
  const { tokens } = useTheme();

  return (
    <View
      style={{
        backgroundColor: tokens.surface,
        borderRadius: 12,
        padding: 16,
      }}
    >
      {/* Header */}
      <Text
        style={{
          color: tokens.textPrimary,
          fontSize: 18,
          fontWeight: '700',
        }}
      >
        Ranking da semana
      </Text>

      {/* Subheader */}
      <Text
        style={{
          color: tokens.textHint,
          fontSize: 13,
          marginTop: 2,
        }}
      >
        mais baratos · {ranking.city}
      </Text>

      {/* Store rows */}
      <View style={{ marginTop: 12 }}>
        {ranking.stores.map((entry, index) => (
          <RankRow
            key={entry.id}
            entry={entry}
            isLast={index === ranking.stores.length - 1}
          />
        ))}
      </View>
    </View>
  );
}
