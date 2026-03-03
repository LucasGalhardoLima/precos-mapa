import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
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
 */
export function ListItem({ item, onToggle, onRemove, isLocked }: ListItemProps) {
  const { palette, tokens } = useTheme();

  const isEncarte = palette === 'encarte';
  const checkedOpacity = item.checked ? 0.45 : 1;

  const quantityLabel =
    item.quantity != null
      ? `${item.quantity}${item.unit ? ` ${item.unit}` : ''}`
      : null;

  return (
    <View style={[styles.container, isLocked && styles.locked]}>
      <View style={[styles.row, { opacity: checkedOpacity }]}>
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
          {item.checked ? (
            <Check size={20} color={tokens.primary} />
          ) : (
            <Circle size={20} color={tokens.textHint} />
          )}
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
      </View>

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
