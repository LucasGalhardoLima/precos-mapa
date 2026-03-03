import React from 'react';
import { Platform, StyleSheet, View, type ViewStyle } from 'react-native';

import { useTheme } from '../../theme/use-theme';

type CleanCardProps = {
  children: React.ReactNode;
  style?: ViewStyle;
};

/**
 * Standard rounded card with subtle border and optional shadow.
 * The fintech equivalent of the PriceTagCard.
 */
export function CleanCard({ children, style }: CleanCardProps) {
  const { tokens } = useTheme();

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: tokens.surface,
          borderColor: tokens.border,
          ...Platform.select({
            ios: {
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.06,
              shadowRadius: 4,
            },
            android: {
              elevation: 2,
            },
          }),
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
});
