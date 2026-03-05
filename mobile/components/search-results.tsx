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

/**
 * Determine if a store is currently open.
 *
 * Since we don't have opening-hours data, we use a simple heuristic:
 * stores are assumed open between 07:00 and 22:00 local time.
 */
function isStoreOpen(): boolean {
  const hour = new Date().getHours();
  return hour >= 7 && hour < 22;
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
  const storeOpen = isStoreOpen();

  return (
    <View>
      {/* Best price badge above the row */}
      {promotion.isBestPrice && (
        <View style={styles.bestPriceBadge}>
          <DiscountBadge label="Melhor preço" variant="highlight" />
        </View>
      )}

      <View style={[styles.row, { backgroundColor: tokens.surface }]}>
        {/* Left side: store info */}
        <View style={styles.leftSide}>
          <Text
            style={[styles.storeName, { color: tokens.textPrimary }]}
            numberOfLines={1}
          >
            {promotion.store.name}
          </Text>
          <Text style={[styles.distance, { color: tokens.textHint }]}>
            {promotion.distanceKm} km
          </Text>
          <View
            style={[
              styles.statusBadge,
              {
                backgroundColor: storeOpen
                  ? 'rgba(34,197,94,0.15)'
                  : 'rgba(156,163,175,0.2)',
              },
            ]}
          >
            <Text
              style={[
                styles.statusText,
                { color: storeOpen ? '#16a34a' : '#6b7280' },
              ]}
            >
              {storeOpen ? 'Aberto agora' : 'Fechado'}
            </Text>
          </View>
        </View>

        {/* Right side: pricing */}
        <View style={styles.rightSide}>
          <Text style={[styles.promoPrice, { color: tokens.primary }]}>
            {formatPrice(promotion.promo_price)}
          </Text>
          {promotion.original_price > promotion.promo_price && (
            <Text style={[styles.originalPrice, { color: tokens.discountRed }]}>
              {formatPrice(promotion.original_price)}
            </Text>
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

  const renderItem = ({ item }: { item: EnrichedPromotion }) => {
    if (item.isLocked) {
      return (
        <View style={styles.lockedWrapper}>
          <ResultRow promotion={item} tokens={tokens} />
          <Pressable
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
      <Pressable onPress={() => onPressItem(item)}>
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
  bestPriceBadge: {
    marginBottom: 4,
    alignSelf: 'flex-start',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  leftSide: {
    flex: 1,
    marginRight: 12,
  },
  storeName: {
    fontWeight: '700',
    fontSize: 15,
  },
  distance: {
    fontSize: 12,
    marginTop: 2,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginTop: 6,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  rightSide: {
    alignItems: 'flex-end',
    gap: 2,
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
