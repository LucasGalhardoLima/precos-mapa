import React from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
} from 'react-native';
import { Lock, Plus } from 'lucide-react-native';

import { useTheme } from '@/theme/use-theme';
import type { EnrichedPromotion } from '@/types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// Maps category names to emoji (fallback for unknown categories)
const CATEGORY_EMOJI_MAP: Record<string, string> = {
  laticinios: '🥛',
  carnes: '🥩',
  hortifruti: '🥬',
  padaria: '🍞',
  limpeza: '🧹',
  higiene: '🧴',
  bebidas: '🍺',
  pet: '🐶',
};

const CATEGORY_BG_MAP: Record<string, string> = {
  laticinios: '#FEF3C7',
  carnes: '#FEE2E2',
  hortifruti: '#DCFCE7',
  padaria: '#FEF9C3',
  limpeza: '#E0F2FE',
  higiene: '#F3E8FF',
  bebidas: '#DBEAFE',
  pet: '#FEE2E2',
};

function getCategoryEmoji(categoryName?: string): string {
  if (!categoryName) return '🛒';
  const key = categoryName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  return CATEGORY_EMOJI_MAP[key] ?? '🛒';
}

function getCategoryBg(categoryName?: string): string {
  if (!categoryName) return '#F0FDFA';
  const key = categoryName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  return CATEGORY_BG_MAP[key] ?? '#F0FDFA';
}

function formatPrice(price: number): string {
  return 'R$ ' + price.toFixed(2).replace('.', ',');
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SearchResultCardProps {
  promotion: EnrichedPromotion;
  onPress: (promotion: EnrichedPromotion) => void;
  onPressAdd?: (promotion: EnrichedPromotion) => void;
  onPressLocked: () => void;
  testID?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SearchResultCard({
  promotion,
  onPress,
  onPressAdd,
  onPressLocked,
  testID,
}: SearchResultCardProps) {
  const { tokens } = useTheme();

  const categoryName = (promotion.product as { category?: { name?: string } })?.category?.name;
  const emoji = getCategoryEmoji(categoryName);
  const iconBg = getCategoryBg(categoryName);
  const hasDiscount = promotion.original_price > promotion.promo_price;

  // Two independent tap targets live in this row: "open detail" and "add to
  // list". They must be siblings, not nested Pressables — a Pressable with
  // an accessibilityLabel collapses its whole subtree into one opaque
  // accessibility element on iOS, which silently swallows any Pressable
  // nested inside it. That's what broke Maestro (and VoiceOver) taps on the
  // add button here: it was only reachable by raw coordinates, not by its
  // own accessibility node, once the outer card became one combined-label
  // element.
  const detailInfo = (
    <>
      {/* Left: emoji icon */}
      <View style={[styles.iconContainer, { backgroundColor: iconBg }]}>
        <Text style={styles.iconEmoji}>{emoji}</Text>
      </View>

      {/* Center: product info */}
      <View style={styles.info}>
        <Text
          style={[styles.productName, { color: COLORS.textDark }]}
          numberOfLines={1}
        >
          {promotion.product.name}
        </Text>
        <View style={styles.priceRow}>
          <Text style={[styles.minPrice, { color: tokens.success }]}>
            {formatPrice(promotion.promo_price)}
          </Text>
          {hasDiscount && (
            <Text style={[styles.maxPrice, { color: COLORS.textSecondary }]}>
              {' – '}{formatPrice(promotion.original_price)}
            </Text>
          )}
        </View>
        <View style={styles.metaRow}>
          <Text style={[styles.storeMeta, { color: COLORS.textSecondary }]}>
            {promotion.store.name}
          </Text>
          {hasDiscount && promotion.discountPercent > 0 && (
            <View style={[styles.discountBadge, { backgroundColor: COLORS.successLight }]}>
              <Text style={[styles.discountBadgeText, { color: tokens.success }]}>
                -{promotion.discountPercent}%
              </Text>
            </View>
          )}
        </View>
      </View>
    </>
  );

  const cardContent = (
    <View style={[styles.card, { backgroundColor: tokens.surface }]}>
      {/* Locked cards have no "view detail" tap target at all — only the lock
          overlay below is interactive — so this renders as an inert View,
          never as a nested Pressable the overlay would otherwise hide from
          accessibility tools while still occupying the tree. */}
      {promotion.isLocked ? (
        <View style={styles.detailTapArea}>{detailInfo}</View>
      ) : (
        <Pressable
          testID={testID}
          accessibilityRole="button"
          accessibilityLabel={`${promotion.product.name}, ${formatPrice(promotion.promo_price)}, ${promotion.store.name}`}
          onPress={() => onPress(promotion)}
          style={styles.detailTapArea}
        >
          {detailInfo}
        </Pressable>
      )}

      {/* Right: add button — sibling of the detail Pressable, not nested inside it */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Adicionar ${promotion.product.name} à lista`}
        style={[styles.addButton, { borderColor: tokens.primary }]}
        onPress={() => (onPressAdd ?? onPress)(promotion)}
        hitSlop={8}
      >
        <Plus size={16} color={tokens.primary} strokeWidth={2.5} />
      </Pressable>

      {/* Locked overlay */}
      {promotion.isLocked && (
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
      )}
    </View>
  );

  return (
    <View testID={promotion.isLocked ? testID : undefined} style={styles.cardWrapper}>
      {cardContent}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Colors (matching spec)
// ---------------------------------------------------------------------------

const COLORS = {
  textDark: '#134E4A',
  textSecondary: '#6B7280',
  successLight: '#DCFCE7',
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  cardWrapper: {
    marginBottom: 10,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
    gap: 12,
  },
  detailTapArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  iconEmoji: {
    fontSize: 24,
  },
  info: {
    flex: 1,
    gap: 2,
  },
  productName: {
    fontSize: 15,
    fontWeight: '700',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  minPrice: {
    fontSize: 14,
    fontWeight: '700',
  },
  maxPrice: {
    fontSize: 14,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  storeMeta: {
    fontSize: 12,
  },
  discountBadge: {
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  discountBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  addButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#F0FDFA',
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  lockedOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: 12,
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
