import React from 'react';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '../../theme/use-theme';

type RuleDividerProps = {
  /** Vertical margin above and below the rule line (default: 16). */
  spacing?: number;
};

/**
 * Simple 1px horizontal rule line.
 */
export function RuleDivider({ spacing = 16 }: RuleDividerProps) {
  const { tokens } = useTheme();

  return (
    <View
      style={[
        styles.rule,
        {
          backgroundColor: tokens.border,
          marginVertical: spacing,
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  rule: {
    height: 1,
    alignSelf: 'stretch',
  },
});
