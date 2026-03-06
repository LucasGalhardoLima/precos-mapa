import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../../theme/use-theme';

type PillBadgeProps = {
  label: string;
  variant: 'discount' | 'highlight';
};

/**
 * Pill-shaped badge with flat styling.
 * The fintech equivalent of the encarte StampBadge -- no rotation, no double border.
 */
export function PillBadge({ label, variant }: PillBadgeProps) {
  const { tokens } = useTheme();

  const isDiscount = variant === 'discount';

  const pillBg = isDiscount ? tokens.accentSoft : tokens.primaryMuted;
  const pillText = isDiscount ? tokens.accent : tokens.primary;

  return (
    <View style={[styles.pill, { backgroundColor: pillBg }]}>
      <Text style={[styles.label, { color: pillText }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    borderRadius: 9999,
    paddingHorizontal: 12,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
  },
});
