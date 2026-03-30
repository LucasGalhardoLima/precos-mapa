import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronRight } from 'lucide-react-native';

import type { StoreWithPromotions } from '@/types';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface MarketDetectionCardProps {
  storeData: StoreWithPromotions;
  onPress: (storeId: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MarketDetectionCard({ storeData, onPress }: MarketDetectionCardProps) {
  const { store, activePromotionCount, distanceKm } = storeData;

  return (
    <LinearGradient
      colors={['#0D9488', '#14B8A6']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.card}
    >
      <Text style={styles.label}>Mercado encontrado</Text>

      <View style={styles.topRow}>
        <View style={[styles.avatar, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
          <Text style={styles.avatarText}>
            {store.logo_initial || store.name.charAt(0)}
          </Text>
        </View>
        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={1}>
            {store.name}
          </Text>
          <Text style={styles.address} numberOfLines={1}>
            {store.address} — {store.city}, {store.state}
          </Text>
        </View>
      </View>

      <View style={styles.tagsRow}>
        <View style={styles.tag}>
          <Text style={styles.tagText}>📍 {distanceKm.toFixed(1)} km</Text>
        </View>
        <View style={styles.tag}>
          <Text style={styles.tagText}>
            🏷️ {activePromotionCount} oferta{activePromotionCount !== 1 ? 's' : ''}
          </Text>
        </View>
      </View>

      <Pressable
        onPress={() => onPress(store.id)}
        style={styles.cta}
      >
        <Text style={styles.ctaText}>Ver todas as ofertas deste mercado</Text>
        <ChevronRight size={14} color="#FFFFFF" />
      </Pressable>
    </LinearGradient>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },
  label: {
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 6,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  address: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 1,
  },
  tagsRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 10,
  },
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  tagText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  ctaText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
