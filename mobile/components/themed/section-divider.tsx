import React from 'react';
import { View, type ViewStyle } from 'react-native';

import { useTheme } from '../../theme/use-theme';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SectionDividerProps {
  style?: ViewStyle;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Subtle section divider used across all palettes.
 */
export function SectionDivider({ style }: SectionDividerProps) {
  const { tokens } = useTheme();

  return (
    <View
      style={[
        {
          borderBottomWidth: 1,
          borderBottomColor: tokens.border,
        },
        style,
      ]}
    />
  );
}
