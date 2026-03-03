import React from 'react';
import { View, StyleSheet, type ViewStyle } from 'react-native';
import { useTheme } from '../../theme/use-theme';

interface ReceiptSeparatorProps {
  style?: ViewStyle;
}

/**
 * Dashed horizontal line that mimics the cut-line on receipt paper.
 *
 * A single `<View>` with a dashed bottom border — nothing more.
 */
export function ReceiptSeparator({ style }: ReceiptSeparatorProps) {
  const { tokens } = useTheme();

  return (
    <View
      style={[
        styles.line,
        { borderColor: tokens.border },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  line: {
    alignSelf: 'stretch',
    borderBottomWidth: 1,
    borderStyle: 'dashed',
  },
});
