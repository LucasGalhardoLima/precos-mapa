import React from 'react';
import { View, StyleSheet, type ViewStyle } from 'react-native';
import { useTheme } from '../../theme/use-theme';

interface ReceiptSeparatorProps {
  style?: ViewStyle;
}

/**
 * Horizontal line divider styled as a receipt paper separator.
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
  },
});
