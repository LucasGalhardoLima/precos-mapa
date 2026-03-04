import React from 'react';
import type { ViewStyle } from 'react-native';

import { useTheme } from '../../theme/use-theme';
import { BarcodeDivider } from '../encarte/barcode-divider';
import { RuleDivider } from '../fintech/rule-divider';

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
 * Themed section divider that renders a `BarcodeDivider` (encarte) or
 * `RuleDivider` (fintech) depending on the active palette.
 */
export function SectionDivider({ style }: SectionDividerProps) {
  const { palette } = useTheme();

  if (palette === 'encarte') {
    return <BarcodeDivider style={style} />;
  }

  return <RuleDivider spacing={style?.marginVertical as number | undefined} />;
}
