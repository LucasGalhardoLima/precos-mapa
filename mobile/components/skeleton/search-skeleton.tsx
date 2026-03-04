import React from 'react';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '../../theme/use-theme';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Static skeleton placeholder for the search results screen.
 *
 * Renders lightweight shapes that approximate the search layout while data is
 * loading: search bar, sort tabs, and result rows.
 */
export function SearchSkeleton() {
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
      {/* Search bar */}
      <View style={shape(48, '100%', { borderRadius: 12 })} />

      {/* Sort tabs row */}
      <View style={styles.tabsRow}>
        {[72, 64, 80].map((w, i) => (
          <View key={i} style={shape(32, w, { borderRadius: 16 })} />
        ))}
      </View>

      {/* Result rows */}
      {[0, 1, 2, 3].map((i) => (
        <View key={i} style={shape(80, '100%', { borderRadius: 12 })} />
      ))}
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
    gap: 12,
  },
  tabsRow: {
    flexDirection: 'row',
    gap: 8,
  },
});
