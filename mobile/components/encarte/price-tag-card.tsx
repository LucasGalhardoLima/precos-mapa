import React from 'react';
import { View, StyleSheet, type ViewStyle } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { useTheme } from '../../theme/use-theme';

interface PriceTagCardProps {
  children: React.ReactNode;
  /** Fixed width in px; defaults to flex fill via style */
  width?: number;
  /** Fixed height in px; when omitted the card auto-sizes from children */
  height?: number;
  style?: ViewStyle;
}

// ---------------------------------------------------------------------------
// Constants for the SVG decorations
// ---------------------------------------------------------------------------

/** Radius of the punch-hole circle */
const HOLE_R = 5;
/** Center of the punch-hole (x, y relative to the SVG viewBox) */
const HOLE_CX = 22;
const HOLE_CY = 14;
/** Bottom-corner radius of the card body */
const CORNER_R = 12;

/**
 * A decorative price-tag shaped card used by the "encarte" (supermarket flyer)
 * palette. The SVG draws:
 * 1. A white card body rectangle with rounded bottom corners.
 * 2. A small circle cutout near the top-left simulating a punch hole.
 * 3. A thin curved wire line hanging from the hole upward.
 *
 * Content is rendered as a regular `<View>` overlay on top of the SVG
 * background, with padding that avoids the punch-hole area.
 */
export function PriceTagCard({
  children,
  width,
  height,
  style,
}: PriceTagCardProps) {
  const { tokens } = useTheme();

  // When no explicit height is provided we let the container auto-size from
  // the children and use a "stretch" SVG that fills the wrapper.  When height
  // IS provided the SVG viewBox matches exactly.
  const svgHeight = height ?? '100%';
  const svgWidth = width ?? '100%';

  // The viewBox is set to a reference size.  Because the SVG uses
  // preserveAspectRatio="none" the shapes stretch to fill whatever the actual
  // container dimensions turn out to be, EXCEPT the hole and wire which are
  // positioned in absolute pixels via the overlay trick below.
  const VB_W = 300;
  const VB_H = 180;

  return (
    <View
      style={[
        styles.wrapper,
        width != null && { width },
        height != null && { height },
        style,
      ]}
    >
      {/* ---- SVG background ---- */}
      <Svg
        width={svgWidth}
        height={svgHeight}
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        preserveAspectRatio="none"
        style={StyleSheet.absoluteFill}
      >
        {/* Card body — rounded bottom corners, square top corners */}
        <Path
          d={[
            `M 0 0`,
            `L ${VB_W} 0`,
            `L ${VB_W} ${VB_H - CORNER_R}`,
            `Q ${VB_W} ${VB_H} ${VB_W - CORNER_R} ${VB_H}`,
            `L ${CORNER_R} ${VB_H}`,
            `Q 0 ${VB_H} 0 ${VB_H - CORNER_R}`,
            `Z`,
          ].join(' ')}
          fill={tokens.surface}
          stroke={tokens.border}
          strokeWidth={1}
        />
      </Svg>

      {/* ---- Punch-hole + wire (not stretched, positioned absolutely) ---- */}
      <Svg
        width={HOLE_CX + HOLE_R + 4}
        height={HOLE_CY + HOLE_R + 2}
        style={styles.holeSvg}
      >
        {/* Wire — thin curved path from above the card down into the hole */}
        <Path
          d={`M ${HOLE_CX} 0 C ${HOLE_CX + 6} 4, ${HOLE_CX - 4} 8, ${HOLE_CX} ${HOLE_CY - HOLE_R}`}
          stroke={tokens.border}
          strokeWidth={1.2}
          fill="none"
        />
        {/* Punch hole — filled with page background so it looks cut out */}
        <Circle
          cx={HOLE_CX}
          cy={HOLE_CY}
          r={HOLE_R}
          fill={tokens.bg}
          stroke={tokens.border}
          strokeWidth={0.8}
        />
      </Svg>

      {/* ---- Content overlay ---- */}
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
    // Allow the card to stretch horizontally by default
    alignSelf: 'stretch',
  },
  holeSvg: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  content: {
    position: 'relative',
    // Pad top a bit more so children don't overlap the punch-hole area
    paddingTop: 28,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
});
