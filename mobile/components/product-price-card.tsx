import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Lock } from 'lucide-react-native';

import { useTheme } from '@/theme/use-theme';
import type { ProductWithPrices } from '@/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatPrice(price: number): string {
  return 'R$ ' + price.toFixed(2).replace('.', ',');
}

/** Build a description line from category + brand (e.g. "Cerveja Pilsen · Lata · 350ml") */
function buildDescription(product: ProductWithPrices): string | null {
  const parts: string[] = [];
  if (product.category) parts.push(product.category);
  if (product.brand) parts.push(product.brand);
  return parts.length > 0 ? parts.join(' · ') : null;
}

/** Determine the badge to show based on product data */
function getBadge(
  product: ProductWithPrices,
  index: number,
): { text: string; bg: string; color: string } | null {
  if (product.prices.length === 0) return null;

  const activeCount = product.prices.filter((p) => p.price_type === 'active').length;

  // Check if this is a 30-day low: active price < any last_price entry for the same product
  const activePrices = product.prices.filter((p) => p.price_type === 'active');
  const lastPrices = product.prices.filter((p) => p.price_type === 'last_price');
  if (activePrices.length > 0 && lastPrices.length > 0) {
    const cheapestActive = Math.min(...activePrices.map((p) => p.price));
    const anyLastHigher = lastPrices.some((p) => p.price > cheapestActive);
    if (anyLastHigher) {
      return { text: 'Menor em 30d', bg: '#ede9fe', color: '#5b21b6' };
    }
  }

  // First result = best price badge
  if (index === 0 && activeCount > 0) {
    return { text: 'Menor preço', bg: '#DCFCE7', color: '#166534' };
  }

  return null;
}

/** Get the discount info for the cheapest active price */
function getDiscountInfo(product: ProductWithPrices): {
  originalPrice: number;
  discountPercent: number;
} | null {
  const activePrice = product.prices.find(
    (p) => p.price_type === 'active' && p.original_price != null && p.original_price > p.price,
  );
  if (!activePrice || activePrice.original_price == null) return null;
  const discountPercent = Math.round(
    (1 - activePrice.price / activePrice.original_price) * 100,
  );
  if (discountPercent <= 0) return null;
  return { originalPrice: activePrice.original_price, discountPercent };
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ProductPriceCardProps {
  product: ProductWithPrices;
  index?: number;
  onPressProduct: (productId: string) => void;
  onPressStore: (storeId: string) => void;
  onPressLocked: () => void;
  testID?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ProductPriceCard({
  product,
  index = 0,
  onPressProduct,
  onPressStore,
  onPressLocked,
  testID,
}: ProductPriceCardProps) {
  const { tokens } = useTheme();
  const description = buildDescription(product);
  const badge = getBadge(product, index);
  const discountInfo = getDiscountInfo(product);
  const activePrices = product.prices.filter((p) => p.price_type === 'active');
  const pricePool = activePrices.length > 0 ? activePrices : product.prices;
  const cheapestPrice = pricePool.length > 0
    ? Math.min(...pricePool.map((p) => p.price))
    : undefined;
  const storeCount = product.prices.length;

  const cardContent = (
    <View style={[styles.card, { backgroundColor: tokens.surface, borderColor: COLORS.cardBorder }]}>
      {/* Top row: name + badge */}
      <View style={styles.topRow}>
        <Text
          style={[styles.productName, { color: tokens.textPrimary }]}
          numberOfLines={2}
        >
          {product.product_name}
        </Text>
        {badge && (
          <View style={[styles.badge, { backgroundColor: badge.bg }]}>
            <Text style={[styles.badgeText, { color: badge.color }]}>{badge.text}</Text>
          </View>
        )}
      </View>

      {/* Description */}
      {description && (
        <Text style={[styles.description, { color: COLORS.textMuted }]}>
          {description}
        </Text>
      )}

      {/* Bottom row: price + store count */}
      <View style={[styles.bottomRow, { borderTopColor: COLORS.divider }]}>
        {product.has_active_price ? (
          // State 1a: live active offer
          <View style={styles.priceGroup}>
            <Text style={[styles.priceFrom, { color: COLORS.textMuted }]}>a partir de</Text>
            <Text style={[styles.priceValue, { color: tokens.primary }]}>
              {cheapestPrice != null ? formatPrice(cheapestPrice) : '—'}
            </Text>
            {discountInfo && (
              <View style={styles.discountGroup}>
                <Text style={styles.originalPrice}>
                  {formatPrice(discountInfo.originalPrice)}
                </Text>
                <Text style={styles.discountPercent}>-{discountInfo.discountPercent}%</Text>
              </View>
            )}
          </View>
        ) : product.prices.length > 0 ? (
          // State 1b: historical last_price only — no active deal
          <View style={styles.priceGroup}>
            <Text style={[styles.priceFrom, { color: COLORS.textMuted }]}>último preço</Text>
            <Text style={[styles.priceValue, { color: COLORS.textSecondary }]}>
              {cheapestPrice != null ? formatPrice(cheapestPrice) : '—'}
            </Text>
          </View>
        ) : (
          // State 2: catalog-only, no price history
          <View style={styles.priceGroup}>
            <Text style={[styles.priceFrom, { color: COLORS.textMuted }]}>ref.</Text>
            <Text style={[styles.priceValue, { color: COLORS.textSecondary }]}>
              {product.reference_price != null && product.reference_price > 0
                ? formatPrice(product.reference_price)
                : '—'}
            </Text>
          </View>
        )}
        <Pressable
          onPress={() => onPressProduct(product.product_id)}
          style={[styles.storeCountButton, { backgroundColor: 'rgba(13,148,136,0.08)' }]}
          hitSlop={4}
        >
          <Text style={[styles.storeCountText, { color: product.has_active_price ? tokens.primary : COLORS.textSecondary }]}>
            {product.has_active_price
              ? `${storeCount} mercado${storeCount !== 1 ? 's' : ''} ›`
              : product.prices.length > 0
              ? `${storeCount} mercado${storeCount !== 1 ? 's' : ''}`
              : 'Ver produto ›'}
          </Text>
        </Pressable>
      </View>
    </View>
  );

  if (product.isLocked) {
    return (
      <View testID={testID} style={styles.cardWrapper}>
        {cardContent}
        <Pressable
          style={styles.lockedOverlay}
          onPress={onPressLocked}
          accessibilityRole="button"
          accessibilityLabel="Bloqueado. Assine Plus para ver"
        >
          <Lock size={20} color={COLORS.textSecondary} />
          <Text style={[styles.lockedText, { color: COLORS.textSecondary }]}>
            Assine Plus para ver
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={`${product.product_name}, ${storeCount} mercados`}
      onPress={() => onPressProduct(product.product_id)}
      style={styles.cardWrapper}
    >
      {cardContent}
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Colors
// ---------------------------------------------------------------------------

const COLORS = {
  textSecondary: '#6B7280',
  textMuted: '#94A3B8',
  cardBorder: '#E8EDF2',
  divider: '#F5F7FA',
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  cardWrapper: {
    marginBottom: 10,
  },
  card: {
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 14,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  productName: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 18,
    flex: 1,
  },
  badge: {
    flexShrink: 0,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '700',
  },
  description: {
    fontSize: 11,
    marginTop: 2,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  priceGroup: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  priceFrom: {
    fontSize: 10,
    fontWeight: '500',
  },
  priceValue: {
    fontSize: 17,
    fontWeight: '800',
  },
  discountGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 6,
  },
  originalPrice: {
    fontSize: 11,
    fontWeight: '500',
    color: '#9CA3AF',
    textDecorationLine: 'line-through',
  },
  discountPercent: {
    fontSize: 10,
    fontWeight: '700',
    color: '#DC2626',
  },
  storeCountButton: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  storeCountText: {
    fontSize: 11,
    fontWeight: '600',
  },
  lockedOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  lockedText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
