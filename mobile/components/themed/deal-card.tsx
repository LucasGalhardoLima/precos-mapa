import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';

import type { EnrichedPromotion } from '@/types';
import { useTheme } from '../../theme/use-theme';
import { PriceTagCard } from '../encarte/price-tag-card';
import { CleanCard } from '../fintech/clean-card';
import { PillBadge } from '../fintech/pill-badge';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format a number as Brazilian currency (R$ X,XX). */
function formatBRL(value: number): string {
  return `R$ ${value.toFixed(2).replace('.', ',')}`;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface DealCardProps {
  deal: EnrichedPromotion;
  onPress: () => void;
  /** Smaller sizing for horizontal carousel usage. */
  compact?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Themed deal card that renders a `PriceTagCard` (encarte) or `CleanCard`
 * (fintech) depending on the active palette.
 */
export const DealCard = React.memo(function DealCard({ deal, onPress, compact = false }: DealCardProps) {
  const { palette, tokens } = useTheme();

  const discountLabel = `-${Math.round(deal.discountPercent)}%`;
  const distanceText = `${deal.distanceKm.toFixed(1)} km`;

  const CardComponent = palette === 'encarte' ? PriceTagCard : CleanCard;

  const content = (
    <>
      {/* Product name */}
      <Text
        numberOfLines={compact ? 1 : 2}
        style={[
          styles.productName,
          compact && styles.productNameCompact,
          { color: tokens.textPrimary },
        ]}
      >
        {deal.product.name}
      </Text>

      {/* Store + distance */}
      <Text
        numberOfLines={1}
        style={[styles.storeLine, { color: tokens.textSecondary }]}
      >
        {deal.store.name} · {distanceText}
      </Text>

      {/* Prices row */}
      <View style={styles.priceRow}>
        <Text style={[styles.promoPrice, { color: tokens.primary }]}>
          {formatBRL(deal.promo_price)}
        </Text>
        <Text style={[styles.originalPrice, { color: tokens.discountRed }]}>
          {formatBRL(deal.original_price)}
        </Text>
      </View>

      {/* Badges row — always show both slots for consistent card height */}
      <View style={styles.badgeRow}>
        <PillBadge label={discountLabel} variant="discount" />
        {deal.isBestPrice ? (
          <PillBadge label="Melhor preço" variant="highlight" />
        ) : (
          <View style={styles.badgePlaceholder} />
        )}
      </View>
    </>
  );

  return (
    <Pressable onPress={onPress} style={compact ? styles.compactWrapper : undefined}>
      <Animated.View sharedTransitionTag={`product-card-${deal.product_id}`}>
        <CardComponent compact={compact}>
          {content}
        </CardComponent>
      </Animated.View>
    </Pressable>
  );
});

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  productName: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  productNameCompact: {
    fontSize: 14,
  },
  storeLine: {
    fontSize: 13,
    marginBottom: 8,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginBottom: 8,
  },
  promoPrice: {
    fontSize: 22,
    fontWeight: '800',
  },
  originalPrice: {
    fontSize: 13,
    textDecorationLine: 'line-through',
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'nowrap',
  },
  badgePlaceholder: {
    height: 28,
  },
  compactWrapper: {
    width: 236,
    overflow: 'hidden',
  },
});
