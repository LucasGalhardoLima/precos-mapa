import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';

import { useTheme } from '@/theme/use-theme';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface StoreCardProps {
  /** Store name */
  name: string;
  /** Street address */
  address?: string;
  /** First letter for logo avatar */
  logoInitial?: string;
  /** Background color for logo avatar */
  logoColor?: string;
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
  address,
  logoInitial,
  logoColor,
  distanceKm,
  dealCount,
  isOpen = true,
  onPress,
}: StoreCardProps) {
  const { tokens } = useTheme();
  const initial = logoInitial ?? name.charAt(0).toUpperCase();
  const avatarBg = logoColor ?? avatarColorForName(name);

  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={name}
      accessibilityRole="button"
      style={({ pressed }) => [pressed && styles.cardPressed]}
    >
      <View style={[styles.card, { backgroundColor: tokens.surface }]}>
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

          {address ? (
            <Text
              numberOfLines={1}
              style={styles.address}
            >
              {address}
            </Text>
          ) : null}

          {/* Tags row */}
          <View style={styles.tagsRow}>
            <View style={styles.badgeDistance}>
              <Text style={styles.badgeDistanceText}>
                {distanceKm.toFixed(1)} km
              </Text>
            </View>
            <View style={styles.badgeDeals}>
              <Text style={styles.badgeDealsText}>
                {dealCount} {dealCount === 1 ? 'oferta' : 'ofertas'}
              </Text>
            </View>
            <View style={[styles.badgeStatus, isOpen ? styles.badgeOpen : styles.badgeClosed]}>
              <Text style={[styles.badgeStatusText, isOpen ? styles.badgeOpenText : styles.badgeClosedText]}>
                {isOpen ? 'Aberto' : 'Fechado'}
              </Text>
            </View>
          </View>
        </View>

        {/* Right chevron */}
        <Text style={styles.chevron}>›</Text>
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
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1.5,
    borderColor: '#e8edf2',
  },
  cardPressed: {
    opacity: 0.85,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  info: {
    flex: 1,
  },
  storeName: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'Inter_500Medium',
    marginBottom: 1,
  },
  address: {
    fontSize: 10,
    color: '#9ca3af',
    marginBottom: 4,
  },
  tagsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  badgeDistance: {
    backgroundColor: '#e0f2fe',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeDistanceText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#0369a1',
  },
  badgeDeals: {
    backgroundColor: '#fef3c7',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeDealsText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#92400e',
  },
  badgeStatus: {
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeOpen: {
    backgroundColor: '#dcfce7',
  },
  badgeClosed: {
    backgroundColor: '#fee2e2',
  },
  badgeStatusText: {
    fontSize: 10,
    fontWeight: '600',
  },
  badgeOpenText: {
    color: '#166534',
  },
  badgeClosedText: {
    color: '#991b1b',
  },
  chevron: {
    fontSize: 16,
    color: '#9ca3af',
    marginLeft: 8,
  },
});
