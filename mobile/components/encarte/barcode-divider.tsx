import React from 'react';
import { View, type ViewStyle } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { useTheme } from '../../theme/use-theme';

interface BarcodeDividerProps {
  style?: ViewStyle;
}

// ---------------------------------------------------------------------------
// Bar pattern — alternating thin (1-2px) and thick (3-4px) widths
// ---------------------------------------------------------------------------

const BAR_PATTERN = [
  2, 1, 3, 1, 2, 4, 1, 3, 2, 1, 4, 1, 2, 3, 1, 2, 1, 4, 3, 1, 2, 1, 3, 2,
  1, 4, 1, 2, 3, 1, 2, 1, 3, 4, 1, 2, 1, 3, 2, 4, 1, 3, 1, 2, 4, 1, 2, 3,
  1, 2, 1, 4, 3, 1, 2, 3, 1, 2, 4, 1,
] as const;

/** Gap between bars */
const GAP = 2;

const HEIGHT = 20;

/** Pre-compute total width so we can set the viewBox once. */
const TOTAL_WIDTH = BAR_PATTERN.reduce((sum, w) => sum + w + GAP, 0) - GAP;

/**
 * Decorative horizontal divider styled as a barcode strip.
 *
 * Renders alternating thin and thick vertical bars using the encarte palette's
 * dark color. The strip is 20 px tall and stretches to fill its container.
 */
export function BarcodeDivider({ style }: BarcodeDividerProps) {
  const { tokens } = useTheme();

  let x = 0;

  return (
    <View style={[{ height: HEIGHT, alignSelf: 'stretch' as const }, style]}>
      <Svg
        width="100%"
        height={HEIGHT}
        viewBox={`0 0 ${TOTAL_WIDTH} ${HEIGHT}`}
        preserveAspectRatio="none"
      >
        {BAR_PATTERN.map((barWidth, i) => {
          const barX = x;
          x += barWidth + GAP;
          return (
            <Rect
              key={i}
              x={barX}
              y={0}
              width={barWidth}
              height={HEIGHT}
              fill={tokens.dark}
            />
          );
        })}
      </Svg>
    </View>
  );
}
