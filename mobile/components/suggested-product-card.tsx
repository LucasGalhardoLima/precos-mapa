import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '@/theme/use-theme';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SuggestedProduct {
  emoji: string;
  name: string;
  subtitle: string;
}

interface SuggestedProductCardProps {
  item: SuggestedProduct;
  onCreateAlert?: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Card shown in the empty state "Sugestões perto de você" section.
 * Displays a product with an emoji icon, name, contextual subtitle, and
 * an outlined "Criar alerta" CTA.
 */
export function SuggestedProductCard({ item, onCreateAlert }: SuggestedProductCardProps) {
  const { tokens } = useTheme();

  return (
    <View style={[styles.card, { backgroundColor: tokens.surface, borderColor: tokens.border }]}>
      {/* Emoji icon */}
      <View style={[styles.iconBox, { backgroundColor: tokens.bgLight }]}>
        <Text style={styles.emoji}>{item.emoji}</Text>
      </View>

      {/* Text content */}
      <View style={styles.content}>
        <Text style={[styles.name, { color: tokens.textDark }]} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={[styles.subtitle, { color: tokens.textSecondary }]} numberOfLines={1}>
          {item.subtitle}
        </Text>
      </View>

      {/* CTA button */}
      <Pressable
        onPress={onCreateAlert}
        accessibilityLabel={`Criar alerta para ${item.name}`}
        accessibilityRole="button"
        style={({ pressed }) => [
          styles.ctaButton,
          { borderColor: tokens.primary, backgroundColor: tokens.mist },
          pressed && styles.ctaPressed,
        ]}
      >
        <Text style={[styles.ctaText, { color: tokens.primary }]}>Criar alerta</Text>
      </Pressable>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: {
    fontSize: 20,
  },
  content: {
    flex: 1,
  },
  name: {
    fontSize: 14,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  ctaButton: {
    borderWidth: 1.5,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  ctaPressed: {
    opacity: 0.7,
  },
  ctaText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
