import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MotiView } from 'moti';
import { Check } from 'lucide-react-native';

import { useTheme } from '../../theme/use-theme';
import { triggerHaptic } from '@/hooks/use-haptics';

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
  store_color?: string;
  price?: number;
  isCheapest?: boolean;
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
 * Redesigned shopping list item row.
 *
 * Checkbox design:
 *  - Unchecked: 22×22 rounded (6px) box, 2px border #D1D5DB
 *  - Checked: teal (#0D9488) filled box with white checkmark
 *
 * Checked state:
 *  - Product name gets strikethrough
 *  - Row fades to 0.5 opacity
 */
export function ListItem({ item, onToggle, onRemove, isLocked }: ListItemProps) {
  const { tokens } = useTheme();

  const quantityLabel =
    item.quantity != null
      ? `${item.quantity}${item.unit ? ` ${item.unit}` : 'un'}`
      : null;

  let metaText = '';
  if (item.checked) {
    metaText = item.store_name ? `${item.store_name} · Comprado` : 'Comprado';
  } else if (item.price != null) {
    metaText = `a partir de ${formatBRL(item.price)}`;
    if (item.store_name) metaText += ` · ${item.store_name}`;
  } else if (quantityLabel) {
    metaText = quantityLabel;
  }

  return (
    <MotiView
      animate={{ opacity: item.checked ? 0.5 : 1 }}
      transition={{ type: 'timing', duration: 200 }}
      style={[styles.container, isLocked && styles.locked]}
    >
      <View style={styles.row}>
        {/* ── Checkbox ── */}
        <Pressable
          onPress={() => {
            triggerHaptic();
            onToggle();
          }}
          disabled={isLocked}
          hitSlop={8}
          style={styles.checkboxHit}
        >
          <MotiView
            animate={{
              backgroundColor: item.checked ? '#16A34A' : '#FFFFFF',
              borderColor: item.checked ? '#16A34A' : '#D1D5DB',
            }}
            transition={{ type: 'timing', duration: 150 }}
            style={styles.checkbox}
          >
            <MotiView
              animate={{
                scale: item.checked ? 1 : 0,
                opacity: item.checked ? 1 : 0,
              }}
              transition={{
                scale: { type: 'spring', damping: 12, stiffness: 220 },
                opacity: { type: 'timing', duration: 100 },
              }}
            >
              <Check size={14} color="#FFFFFF" strokeWidth={3} />
            </MotiView>
          </MotiView>
        </Pressable>

        {/* ── Product name + meta ── */}
        <View style={styles.nameColumn}>
          <Text
            numberOfLines={1}
            style={[
              styles.productName,
              { color: tokens.textPrimary },
              item.checked && styles.strikethrough,
            ]}
          >
            {item.product_name}
            {item.isCheapest && !item.checked && (
              <Text style={styles.cheapestBadge}>  Menor preço</Text>
            )}
          </Text>

          {metaText !== '' && (
            <Text
              numberOfLines={1}
              style={[styles.meta, { color: tokens.textHint }]}
            >
              {metaText}
            </Text>
          )}
        </View>

        {/* ── Price right-aligned ── */}
        {item.price != null && (
          <Text
            style={[
              styles.price,
              { color: '#0D9488' },
            ]}
          >
            {formatBRL(item.price)}
          </Text>
        )}
      </View>
    </MotiView>
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
    paddingVertical: 13,
    gap: 12,
  },

  // Checkbox
  checkboxHit: {
    padding: 2,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Name
  nameColumn: {
    flex: 1,
  },
  productName: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: 'Inter_500Medium',
  },
  strikethrough: {
    textDecorationLine: 'line-through',
  },
  cheapestBadge: {
    fontSize: 8,
    fontWeight: '700',
    backgroundColor: '#dcfce7',
    color: '#166534',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  meta: {
    fontSize: 12,
    marginTop: 2,
  },

  // Price
  price: {
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'right',
  },
});
