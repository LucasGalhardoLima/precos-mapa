import React from 'react';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '../../theme/use-theme';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Static skeleton placeholder for the home screen.
 *
 * Renders lightweight shapes that approximate the home layout while data is
 * loading: economy card, category chips, deal cards row, and ranking rows.
 */
export function HomeSkeleton() {
  const { tokens } = useTheme();

  const shape = (
    height: number,
    width: number | string = '100%',
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
      {/* Economy card */}
      <View style={[shape(120), { backgroundColor: tokens.dark }]} />

      {/* Category chips row */}
      <View style={styles.chipsRow}>
        {[80, 64, 72, 56].map((w, i) => (
          <View key={i} style={shape(32, w, { borderRadius: 16 })} />
        ))}
      </View>

      {/* Deal cards row */}
      <View style={styles.dealsRow}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={shape(200, 160)} />
        ))}
      </View>

      {/* Ranking rows */}
      <View style={styles.rankingSection}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={shape(56)} />
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
  chipsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  dealsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  rankingSection: {
    gap: 8,
  },
});
