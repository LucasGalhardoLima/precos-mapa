import React from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { useTheme } from '../../theme/use-theme';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface CouponLineProps {
  style?: ViewStyle;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Themed decorative divider.
 *
 * - Encarte: scissors emoji followed by a dashed line.
 * - Fintech: simple vertical margin spacing.
 */
export function CouponLine({ style }: CouponLineProps) {
  const { palette, tokens } = useTheme();

  if (palette === 'fintech') {
    return <View style={[styles.fintechSpacer, style]} />;
  }

  return (
    <View style={[styles.encarteRow, style]}>
      <Text style={styles.scissors}>{'\u2702'}</Text>
      <View style={[styles.dashedLine, { borderColor: tokens.border }]} />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  encarteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
  },
  scissors: {
    fontSize: 16,
    marginRight: 6,
  },
  dashedLine: {
    flex: 1,
    borderBottomWidth: 1,
    borderStyle: 'dashed',
  },
  fintechSpacer: {
    marginVertical: 24,
  },
});
