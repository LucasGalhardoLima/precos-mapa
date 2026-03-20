import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';

import { useTheme } from '@/theme/use-theme';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface StoreCardProps {
  /** Store name */
  name: string;
  /** Distance in km */
  distanceKm: number;
  /** Number of active deals */
  dealCount: number;
  /** Whether the store is currently open */
  isOpen?: boolean;
  onPress?: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Generate a consistent background color from a store name. */
function avatarColorForName(name: string): string {
  const colors = [
    '#0D9488',
    '#0891B2',
    '#7C3AED',
    '#DB2777',
    '#D97706',
    '#16A34A',
    '#DC2626',
    '#2563EB',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) & 0xffffffff;
  }
  return colors[Math.abs(hash) % colors.length];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Card representing a nearby store in the "Mercados perto de você" section.
 */
export function StoreCard({
  name,
  distanceKm,
  dealCount,
  isOpen = true,
  onPress,
}: StoreCardProps) {
  const { tokens } = useTheme();
  const initial = name.charAt(0).toUpperCase();
  const avatarBg = avatarColorForName(name);

  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={name}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: tokens.surface },
        pressed && styles.cardPressed,
      ]}
    >
      {/* Store initial avatar */}
      <View style={[styles.avatar, { backgroundColor: avatarBg }]}>
        <Text style={styles.avatarText}>{initial}</Text>
      </View>

      {/* Text content */}
      <View style={styles.info}>
        <Text
          numberOfLines={1}
          style={[styles.storeName, { color: tokens.textDark }]}
        >
          {name}
        </Text>

        {/* Tags row */}
        <View style={styles.tagsRow}>
          <Text style={[styles.tag, { color: tokens.textSecondary }]}>
            {distanceKm.toFixed(1)} km
          </Text>
          <Text style={[styles.tagSep, { color: tokens.textSecondary }]}>·</Text>
          <Text style={[styles.tag, { color: tokens.textSecondary }]}>
            {dealCount} {dealCount === 1 ? 'oferta' : 'ofertas'}
          </Text>
          <Text style={[styles.tagSep, { color: tokens.textSecondary }]}>·</Text>
          <Text
            style={[
              styles.tag,
              { color: isOpen ? tokens.success : tokens.danger, fontWeight: '600' },
            ]}
          >
            {isOpen ? 'Aberto' : 'Fechado'}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  cardPressed: {
    opacity: 0.85,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  info: {
    flex: 1,
  },
  storeName: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  tagsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  tag: {
    fontSize: 12,
  },
  tagSep: {
    fontSize: 12,
  },
});
