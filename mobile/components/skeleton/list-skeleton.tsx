import React from 'react';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '../../theme/use-theme';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Static skeleton placeholder for the shopping list screen.
 *
 * Renders lightweight shapes that approximate the list layout while data is
 * loading: savings summary card and item rows with palette-aware separators
 * (dashed for encarte, solid for fintech).
 */
export function ListSkeleton() {
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
      {/* Savings summary card */}
      <View style={[shape(100), { backgroundColor: tokens.dark }]} />

      {/* Item rows */}
      <View style={styles.itemsSection}>
        {[0, 1, 2, 3, 4].map((i) => (
          <React.Fragment key={i}>
            {/* Row */}
            <View style={styles.itemRow}>
              {/* Checkbox circle */}
              <View style={shape(24, 24, { borderRadius: 12 })} />
              {/* Text placeholder */}
              <View style={[shape(16, '60%'), styles.textLine]} />
              {/* Price placeholder */}
              <View style={shape(16, '20%')} />
            </View>

            {/* Separator (skip after last item) */}
            {i < 4 && (
              <View
                style={[
                  styles.separator,
                  { borderColor: tokens.border },
                ]}
              />
            )}
          </React.Fragment>
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
  itemsSection: {
    gap: 0,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  textLine: {
    flex: 1,
  },
  separator: {
    borderBottomWidth: 1,
  },
});
