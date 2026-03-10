import React from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Lock } from 'lucide-react-native';

import { useTheme } from '../theme/use-theme';
import { DiscountBadge } from './themed/discount-badge';
import type { EnrichedPromotion } from '@/types';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SearchResultsProps {
  promotions: EnrichedPromotion[];
  onPressItem: (promotion: EnrichedPromotion) => void;
  onPressLocked: () => void;
  contentContainerStyle?: object;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatPrice(price: number): string {
  return 'R$ ' + price.toFixed(2).replace('.', ',');
}

// ---------------------------------------------------------------------------
// Row component
// ---------------------------------------------------------------------------

function ResultRow({
  promotion,
  tokens,
}: {
  promotion: EnrichedPromotion;
  tokens: ReturnType<typeof useTheme>['tokens'];
}) {
  const hasDiscount = promotion.original_price > promotion.promo_price;

  return (
    <View style={[styles.row, { backgroundColor: tokens.surface }]}>
      {/* Row 1: Product name + price */}
      <View style={styles.rowLine}>
        <Text
          style={[styles.productName, { color: tokens.textPrimary }]}
          numberOfLines={1}
        >
          {promotion.product.name}
        </Text>
        <View style={styles.priceGroup}>
          {hasDiscount && (
            <Text style={[styles.originalPrice, { color: tokens.textHint }]}>
              {formatPrice(promotion.original_price)}
            </Text>
          )}
          <Text style={[styles.promoPrice, { color: tokens.primary }]}>
            {formatPrice(promotion.promo_price)}
          </Text>
        </View>
      </View>

      {/* Row 2: Store info + badges */}
      <View style={styles.rowLine}>
        <Text
          style={[styles.storeSubtitle, { color: tokens.textHint }]}
          numberOfLines={1}
        >
          {promotion.store.name} · {promotion.distanceKm} km
        </Text>
        <View style={styles.badgeGroup}>
          {promotion.isBestPrice && (
            <DiscountBadge label="Melhor preço" variant="highlight" />
          )}
          {promotion.discountPercent > 0 && (
            <DiscountBadge
              label={`-${promotion.discountPercent}%`}
              variant="discount"
            />
          )}
        </View>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SearchResults({
  promotions,
  onPressItem,
  onPressLocked,
  contentContainerStyle,
}: SearchResultsProps) {
  const { tokens } = useTheme();

  const renderItem = ({ item, index }: { item: EnrichedPromotion; index: number }) => {
    if (item.isLocked) {
      return (
        <View style={styles.lockedWrapper}>
          <ResultRow promotion={item} tokens={tokens} />
          <Pressable
            testID={`result-card-${index}`}
            onPress={onPressLocked}
            style={styles.lockedOverlay}
          >
            <Lock size={20} color={tokens.textSecondary} />
            <Text style={[styles.lockedText, { color: tokens.textSecondary }]}>
              Assine Plus para ver
            </Text>
          </Pressable>
        </View>
      );
    }

    return (
      <Pressable testID={`result-card-${index}`} onPress={() => onPressItem(item)}>
        <ResultRow promotion={item} tokens={tokens} />
      </Pressable>
    );
  };

  return (
    <FlatList
      data={promotions}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      contentContainerStyle={contentContainerStyle}
      showsVerticalScrollIndicator={false}
    />
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  row: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    gap: 6,
  },
  rowLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  productName: {
    fontWeight: '700',
    fontSize: 15,
    flex: 1,
    marginRight: 8,
  },
  priceGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  storeSubtitle: {
    fontSize: 12,
    flex: 1,
    marginRight: 8,
  },
  badgeGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 22,
  },
  promoPrice: {
    fontWeight: '700',
    fontSize: 16,
  },
  originalPrice: {
    fontSize: 12,
    textDecorationLine: 'line-through',
  },
  lockedWrapper: {
    position: 'relative',
    marginBottom: 12,
  },
  lockedOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  lockedText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
