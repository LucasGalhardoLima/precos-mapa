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
 * Subtle dashed-line section divider used across both palettes.
 */
export function SectionDivider({ style }: SectionDividerProps) {
  const { tokens } = useTheme();

  return (
    <View
      style={[
        {
          borderBottomWidth: 1,
          borderStyle: 'dashed',
          borderBottomColor: tokens.border,
        },
        style,
      ]}
    />
  );
}
