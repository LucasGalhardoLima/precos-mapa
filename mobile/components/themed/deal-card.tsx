import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { EnrichedPromotion } from '@/types';
import { useTheme } from '../../theme/use-theme';
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
  const { tokens } = useTheme();

  const discountLabel = `-${Math.round(deal.discountPercent)}%`;
  const distanceText = `${deal.distanceKm.toFixed(1)} km`;
  const savingsAmount = Math.max(0, deal.original_price - deal.promo_price);

  const CardComponent = CleanCard;

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
        <Text style={[styles.originalPrice, { color: tokens.accent }]}>
          {formatBRL(deal.original_price)}
        </Text>
      </View>
      <Text style={styles.savingsText}>Economize {formatBRL(savingsAmount)}</Text>

      {/* Badges row — always show both slots for consistent card height */}
      <View style={styles.badgeRow}>
        <PillBadge label={discountLabel} variant="discount" />
        {deal.isBestPrice ? (
          <PillBadge label="Melhor preço" variant="highlight" />
        ) : (
          <View style={styles.badgePlaceholder} />
        )}
        {deal.isHistoricLow ? (
          <PillBadge label="Menor em 30d" variant="historic" />
        ) : (
          <View style={styles.badgePlaceholder} />
        )}
      </View>
    </>
  );

  return (
    <Pressable onPress={onPress} style={compact ? styles.compactWrapper : undefined}>
      <CardComponent compact={compact}>
        {content}
      </CardComponent>
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
    marginBottom: 4,
  },
  promoPrice: {
    fontSize: 22,
    fontWeight: '800',
  },
  originalPrice: {
    fontSize: 13,
    textDecorationLine: 'line-through',
  },
  savingsText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#16A34A',
    marginBottom: 8,
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
