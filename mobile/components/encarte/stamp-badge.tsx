import React from 'react';
import { View, Text, StyleSheet, type ViewStyle } from 'react-native';
import { useTheme } from '../../theme/use-theme';

interface StampBadgeProps {
  /** Text displayed inside the badge (e.g. "-23%", "OFERTA", "MELHOR PRECO") */
  label: string;
  /** Color scheme: discount uses red tones, highlight uses green tones */
  variant: 'discount' | 'highlight';
  style?: ViewStyle;
}

/**
 * Oval badge with a double-border "stamped" effect and slight rotation.
 *
 * The double border is achieved by nesting two Views: the outer one provides
 * the first stroke, a small gap of background color separates it from the
 * inner View which provides the second stroke plus the tinted background.
 */
export function StampBadge({ label, variant, style }: StampBadgeProps) {
  const { tokens } = useTheme();

  const isDiscount = variant === 'discount';

  const borderColor = isDiscount ? tokens.discountRed : tokens.primary;
  const backgroundColor = isDiscount ? tokens.discountRedSoft : tokens.primaryLight;
  const textColor = isDiscount ? tokens.discountRed : tokens.primary;

  return (
    <View
      style={[
        styles.outer,
        { borderColor },
        { transform: [{ rotate: '-3deg' }] },
        style,
      ]}
    >
      <View style={[styles.inner, { borderColor, backgroundColor }]}>
        <Text style={[styles.label, { color: textColor }]}>{label}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    alignSelf: 'flex-start',
    borderWidth: 1.5,
    borderRadius: 50,
    padding: 2,
  },
  inner: {
    borderWidth: 1.5,
    borderRadius: 50,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  label: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
});
