import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../theme/use-theme';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
  children?: React.ReactNode;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function EmptyState({
  icon,
  title,
  subtitle,
  actionLabel,
  onAction,
  children,
}: EmptyStateProps) {
  const { tokens } = useTheme();

  return (
    <View style={styles.container}>
      <View style={[styles.iconCircle, { backgroundColor: tokens.bgLight }]}>
        {icon}
      </View>

      <Text style={[styles.title, { color: tokens.textPrimary }]}>
        {title}
      </Text>

      {subtitle != null && (
        <Text style={[styles.subtitle, { color: tokens.textHint }]}>
          {subtitle}
        </Text>
      )}

      {actionLabel && onAction && (
        <Pressable
          onPress={onAction}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          style={[styles.actionButton, { backgroundColor: tokens.primary }]}
        >
          <Text style={styles.actionText}>{actionLabel}</Text>
        </Pressable>
      )}

      {children}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 8,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    fontFamily: 'Poppins_700Bold',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  actionButton: {
    borderRadius: 24,
    paddingHorizontal: 28,
    paddingVertical: 12,
    marginTop: 8,
  },
  actionText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
