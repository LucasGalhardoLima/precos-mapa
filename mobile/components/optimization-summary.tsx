import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatBRL(value: number): string {
  return `R$ ${value.toFixed(2).replace('.', ',')}`;
}

/** Returns a deterministic background color for a store based on its name initial. */
function storeColor(initial: string): string {
  const colors = [
    '#0D9488',
    '#7C3AED',
    '#DC2626',
    '#D97706',
    '#0284C7',
    '#059669',
  ];
  const idx = (initial.toUpperCase().charCodeAt(0) - 65) % colors.length;
  return colors[Math.max(0, idx)];
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OptimizedStore {
  storeId: string;
  storeName: string;
  items: { productName: string; price: number; quantity: number }[];
  subtotal: number;
}

interface OptimizationSummaryProps {
  stores: OptimizedStore[];
  totalCost: number;
  estimatedSavings: number;
  itemCount: number;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Avatar circle with the store's first initial. */
function StoreAvatar({
  name,
  size,
  borderWidth,
}: {
  name: string;
  size: number;
  borderWidth?: number;
}) {
  const initial = name.charAt(0).toUpperCase();
  const bg = storeColor(initial);

  return (
    <View
      style={[
        styles.avatar,
        {
          width: size,
          height: size,
          borderRadius: 8,
          backgroundColor: bg,
          borderWidth: borderWidth ?? 0,
          borderColor: '#FFFFFF',
        },
      ]}
    >
      <Text style={[styles.avatarText, { fontSize: size * 0.45 }]}>
        {initial}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

/**
 * Displays a two-option optimization comparison:
 *  - Single best store card (standard border)
 *  - Split across multiple stores card (green border + "Melhor opção" badge)
 *
 * If there is only one store in the result, only the single-store card is shown.
 */
export function OptimizationSummary({
  stores,
  totalCost,
  estimatedSavings,
  itemCount,
}: OptimizationSummaryProps) {
  if (stores.length === 0) return null;

  const bestSingle = stores[0];
  const hasSplit = stores.length > 1;

  // Single-store total: sum only of that store's subtotal
  const singleTotal = bestSingle.subtotal;
  const splitTotal = totalCost;

  return (
    <View style={styles.container}>
      <Text style={styles.sectionLabel}>Onde comprar</Text>

      <View style={styles.cardsRow}>
        {/* ── Single store card ── */}
        <View style={[styles.card, styles.cardSingle]}>
          <View style={styles.cardHeader}>
            <StoreAvatar name={bestSingle.storeName} size={36} />
            <View style={styles.cardHeaderText}>
              <Text style={styles.cardTitle} numberOfLines={1}>
                Tudo no {bestSingle.storeName}
              </Text>
              <Text style={styles.cardMeta} numberOfLines={1}>
                {bestSingle.items.length}{' '}
                {bestSingle.items.length === 1 ? 'item' : 'itens'} disponíveis
              </Text>
            </View>
          </View>
          <Text style={styles.cardPrice}>{formatBRL(singleTotal)}</Text>
        </View>

        {/* ── Split stores card (only when >1 store) ── */}
        {hasSplit && (
          <View style={[styles.card, styles.cardSplit]}>
            {/* "Melhor opção" badge */}
            <View style={styles.bestBadge}>
              <Text style={styles.bestBadgeText}>Melhor opção</Text>
            </View>

            <View style={styles.cardHeader}>
              {/* Overlapping avatars */}
              <View style={styles.avatarStack}>
                {stores.slice(0, 3).map((store, index) => (
                  <View
                    key={store.storeId}
                    style={[
                      styles.avatarStackItem,
                      index > 0 && { marginLeft: -8 },
                    ]}
                  >
                    <StoreAvatar name={store.storeName} size={30} borderWidth={2} />
                  </View>
                ))}
              </View>

              <View style={styles.cardHeaderText}>
                <Text style={styles.cardTitle} numberOfLines={1}>
                  Dividir em {stores.length} lojas
                </Text>
                <Text style={styles.cardMetaSplit} numberOfLines={1}>
                  {stores.map((s) => s.storeName).join(', ')}
                </Text>
              </View>
            </View>

            <Text style={styles.cardPriceSplit}>{formatBRL(splitTotal)}</Text>

            {estimatedSavings > 0 && (
              <Text style={styles.savingsLabel}>
                Economize {formatBRL(estimatedSavings)}
              </Text>
            )}
          </View>
        )}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cardsRow: {
    gap: 10,
  },

  // Cards
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    gap: 10,
  },
  cardSingle: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  cardSplit: {
    borderWidth: 2,
    borderColor: '#16A34A',
    position: 'relative',
    paddingTop: 24,
  },

  // Best badge
  bestBadge: {
    position: 'absolute',
    top: 0,
    left: 0,
    backgroundColor: '#16A34A',
    borderTopLeftRadius: 10,
    borderBottomRightRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  bestBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },

  // Card header
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cardHeaderText: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#134E4A',
  },
  cardMeta: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 1,
  },
  cardMetaSplit: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 1,
  },

  // Prices
  cardPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: '#134E4A',
    textAlign: 'right',
  },
  cardPriceSplit: {
    fontSize: 16,
    fontWeight: '700',
    color: '#16A34A',
    textAlign: 'right',
  },
  savingsLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#16A34A',
    textAlign: 'right',
    marginTop: -4,
  },

  // Avatar
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },

  // Avatar stack
  avatarStack: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarStackItem: {
    zIndex: 1,
  },
});
