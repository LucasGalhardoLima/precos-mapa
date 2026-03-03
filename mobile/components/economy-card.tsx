import React from 'react';
import { View, Text, Pressable } from 'react-native';

import { useTheme } from '../theme/use-theme';
import { SectionDivider } from './themed/section-divider';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface EconomyCardProps {
  totalSavings: number;
  cheapestStore: { id: string; name: string } | null;
  mode: 'list' | 'deals';
  itemCount: number;
  onComparePress?: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatBRL(value: number): string {
  return `R$ ${value.toFixed(2).replace('.', ',')}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Dark background card showing the user's potential savings.
 *
 * Uses `tokens.dark` for the card background so it adapts to the active
 * palette (encarte = #1E2820, fintech = #0C1829).
 */
export function EconomyCard({
  totalSavings,
  cheapestStore,
  mode,
  itemCount,
  onComparePress,
}: EconomyCardProps) {
  const { tokens } = useTheme();

  const modeLabel =
    mode === 'list'
      ? `${itemCount} itens na lista`
      : `${itemCount} ofertas ativas`;

  return (
    <View
      style={{
        backgroundColor: tokens.dark,
        borderRadius: 16,
        padding: 20,
      }}
    >
      {/* Savings amount */}
      <Text
        style={{
          color: tokens.headerText,
          fontSize: 32,
          fontWeight: '700',
        }}
      >
        {formatBRL(totalSavings)}
      </Text>

      {/* Subtitle */}
      <Text
        style={{
          color: tokens.headerText,
          opacity: 0.7,
          fontSize: 14,
          marginTop: 4,
        }}
      >
        de economia potencial
      </Text>

      {/* Mode item count */}
      <Text
        style={{
          color: tokens.headerText,
          opacity: 0.7,
          fontSize: 13,
          marginTop: 8,
        }}
      >
        {modeLabel}
      </Text>

      {/* Cheapest store */}
      {cheapestStore && (
        <View style={{ marginTop: 12 }}>
          <Text
            style={{
              color: tokens.headerText,
              opacity: 0.7,
              fontSize: 12,
            }}
          >
            Mercado mais barato:
          </Text>
          <Text
            style={{
              color: tokens.headerText,
              fontSize: 15,
              fontWeight: '600',
              marginTop: 2,
            }}
          >
            {cheapestStore.name}
          </Text>
        </View>
      )}

      {/* Divider */}
      <SectionDivider style={{ marginVertical: 16 }} />

      {/* Compare button */}
      {onComparePress && (
        <Pressable
          onPress={onComparePress}
          style={{
            borderWidth: 1,
            borderColor: 'rgba(255, 255, 255, 0.3)',
            borderRadius: 12,
            paddingVertical: 12,
            alignItems: 'center',
          }}
        >
          <Text
            style={{
              color: tokens.headerText,
              fontSize: 14,
              fontWeight: '600',
            }}
          >
            Comparar lista
          </Text>
        </Pressable>
      )}
    </View>
  );
}
