import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../theme/use-theme';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface InlineErrorProps {
  onRetry: () => void;
  message?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const DEFAULT_MESSAGE = 'Não foi possível carregar. Tentar novamente?';

/**
 * Inline retry banner for section-level errors.
 *
 * Displays a compact message with a "Tentar" button so the user can retry
 * without leaving the current screen.
 */
export function InlineError({
  onRetry,
  message = DEFAULT_MESSAGE,
}: InlineErrorProps) {
  const { tokens } = useTheme();

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: tokens.accentSoft },
      ]}
    >
      <Text style={[styles.message, { color: tokens.textPrimary }]}>
        {message}
      </Text>
      <Pressable onPress={onRetry} style={styles.button}>
        <Text style={[styles.buttonText, { color: tokens.primary }]}>
          Tentar
        </Text>
      </Pressable>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    padding: 12,
    gap: 12,
  },
  message: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  button: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
