import React from 'react';
import { StyleSheet, View, type DimensionValue } from 'react-native';

import { useTheme } from '../../theme/use-theme';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Static skeleton placeholder for the home screen.
 *
 * Matches the new layout order:
 *   1. Ranking em Destaque  — 3 side-by-side cards
 *   2. Category pills       — horizontal row
 *   3. Ofertas perto de você — horizontal deal cards
 *   4. Mercados perto de você — vertical store list
 */
export function HomeSkeleton() {
  const { tokens } = useTheme();

  const shape = (
    height: number,
    width: DimensionValue = '100%',
    extra?: object,
  ) => ({
    backgroundColor: tokens.surface,
    borderRadius: 8,
    height,
    width,
    ...extra,
  });

  return (
    <View style={[styles.container, { backgroundColor: tokens.bg }]}>
      {/* Ranking em Destaque — 3 equal-width cards side by side */}
      <View style={styles.rankingRow}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={[shape(100, undefined, { flex: 1, borderRadius: 12 }), styles.rankingCard]} />
        ))}
      </View>

      {/* Category chips row */}
      <View style={styles.chipsRow}>
        {[80, 64, 72, 56].map((w, i) => (
          <View key={i} style={shape(32, w, { borderRadius: 16 })} />
        ))}
      </View>

      {/* Deal cards — horizontal row */}
      <View style={styles.dealsRow}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={shape(180, 160, { borderRadius: 12 })} />
        ))}
      </View>

      {/* Store cards — vertical list */}
      <View style={styles.storesSection}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={shape(60, undefined, { borderRadius: 12, marginBottom: 8 })} />
        ))}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    gap: 16,
  },
  rankingRow: {
    flexDirection: 'row',
    gap: 8,
  },
  rankingCard: {
    // flex: 1 is applied inline via shape() extra
  },
  chipsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  dealsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  storesSection: {
    // vertical list with marginBottom per item
  },
});
