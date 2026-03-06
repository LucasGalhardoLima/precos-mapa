import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MotiView } from 'moti';
import { Check, Circle, X } from 'lucide-react-native';

import { useTheme } from '../../theme/use-theme';
import { triggerHaptic } from '@/hooks/use-haptics';
import { ReceiptSeparator } from '../encarte/receipt-separator';
import { RuleDivider } from '../fintech/rule-divider';

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

interface ListItemData {
  id: string;
  product_name: string;
  quantity?: number;
  unit?: string;
  checked: boolean;
  store_name?: string;
  price?: number;
}

interface ListItemProps {
  item: ListItemData;
  onToggle: () => void;
  onRemove: () => void;
  /** When true, overlay is semi-transparent and interactions are disabled. */
  isLocked: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Themed shopping list item row.
 *
 * - Encarte: receipt-style with dotted separator, check/circle icon, product
 *   name left-aligned and price right-aligned. Dimmed when checked.
 * - Fintech: clean row with solid separator, same layout in a cleaner style.
 *
 * Locked state adds a semi-transparent overlay and disables interactions.
 *
 * Animations (Moti):
 * - Checkmark icon scales in with a spring bounce when checked.
 * - Row opacity fades to 0.45 when checked.
 * - Subtle green background tint fades in when checked.
 */
export function ListItem({ item, onToggle, onRemove, isLocked }: ListItemProps) {
  const { palette, tokens } = useTheme();

  const isEncarte = palette === 'encarte' || palette === 'encarte_digital';

  const quantityLabel =
    item.quantity != null
      ? `${item.quantity}${item.unit ? ` ${item.unit}` : ''}`
      : null;

  return (
    <View style={[styles.container, isLocked && styles.locked]}>
      {/* Checked background tint */}
      <MotiView
        animate={{
          opacity: item.checked ? 1 : 0,
        }}
        transition={{ type: 'timing', duration: 200 }}
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: tokens.primaryMuted, borderRadius: 6 },
        ]}
        pointerEvents="none"
      />

      {/* Row with animated opacity */}
      <MotiView
        animate={{ opacity: item.checked ? 0.45 : 1 }}
        transition={{ type: 'timing', duration: 200 }}
        style={styles.row}
      >
        {/* Toggle (check / circle) */}
        <Pressable
          onPress={() => {
            triggerHaptic();
            onToggle();
          }}
          disabled={isLocked}
          hitSlop={8}
          style={styles.toggleHit}
        >
          <View style={styles.iconContainer}>
            {/* Circle icon — fades out when checked */}
            <MotiView
              animate={{
                opacity: item.checked ? 0 : 1,
                scale: item.checked ? 0.6 : 1,
              }}
              transition={{ type: 'timing', duration: 150 }}
              style={styles.iconAbsolute}
            >
              <Circle size={20} color={tokens.textHint} />
            </MotiView>

            {/* Check icon — springs in when checked */}
            <MotiView
              animate={{
                scale: item.checked ? 1 : 0,
                opacity: item.checked ? 1 : 0,
              }}
              transition={{
                scale: { type: 'spring', damping: 12, stiffness: 200 },
                opacity: { type: 'timing', duration: 100 },
              }}
              style={styles.iconAbsolute}
            >
              <Check size={20} color={tokens.primary} />
            </MotiView>
          </View>
        </Pressable>

        {/* Product name + optional quantity */}
        <View style={styles.nameColumn}>
          <Text
            numberOfLines={1}
            style={[
              styles.productName,
              { color: tokens.textPrimary },
              item.checked && styles.checkedText,
            ]}
          >
            {item.product_name}
          </Text>
          {(quantityLabel || item.store_name) && (
            <Text
              numberOfLines={1}
              style={[styles.meta, { color: tokens.textHint }]}
            >
              {[quantityLabel, item.store_name].filter(Boolean).join(' · ')}
            </Text>
          )}
        </View>

        {/* Price (right-aligned) */}
        {item.price != null && (
          <Text
            style={[
              styles.price,
              { color: tokens.textPrimary },
              item.checked && styles.checkedText,
            ]}
          >
            {formatBRL(item.price)}
          </Text>
        )}

        {/* Remove button */}
        <Pressable
          onPress={onRemove}
          disabled={isLocked}
          hitSlop={8}
          style={styles.removeHit}
        >
          <X size={18} color={tokens.textHint} />
        </Pressable>
      </MotiView>

      {/* Separator — dotted (encarte) or solid (fintech) */}
      {isEncarte ? (
        <ReceiptSeparator style={styles.separator} />
      ) : (
        <RuleDivider spacing={0} />
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  locked: {
    opacity: 0.4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    gap: 10,
  },
  toggleHit: {
    padding: 2,
  },
  iconContainer: {
    width: 20,
    height: 20,
    position: 'relative',
  },
  iconAbsolute: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  nameColumn: {
    flex: 1,
    marginRight: 8,
  },
  productName: {
    fontSize: 15,
    fontWeight: '500',
  },
  checkedText: {
    textDecorationLine: 'line-through',
  },
  meta: {
    fontSize: 12,
    marginTop: 2,
  },
  price: {
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'right',
    minWidth: 70,
  },
  removeHit: {
    padding: 2,
  },
  separator: {
    marginTop: 2,
  },
});
