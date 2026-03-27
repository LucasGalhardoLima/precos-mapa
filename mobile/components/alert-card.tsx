import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Bell } from 'lucide-react-native';
import { useTheme } from '@/theme/use-theme';
import type { AlertWithProduct } from '@/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AlertCardVariant = 'triggered' | 'monitoring';

interface AlertCardProps {
  alert: AlertWithProduct;
  variant: AlertCardVariant;
  /** Optional triggered price info (for "novidades" cards) */
  triggeredPrice?: number;
  /** Optional store name (for "novidades" cards) */
  storeName?: string;
  /** Optional badge label (e.g. "-12%" or "Menor em 30d") */
  badgeLabel?: string;
  /** Badge color variant */
  badgeVariant?: 'green' | 'purple';
  /** Timestamp string (e.g. "agora", "2h atrás") */
  timestamp?: string;
  /** Distance string (e.g. "1.2 km") */
  distance?: string;
  onToggle?: (id: string, active: boolean) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AlertCard({
  alert,
  variant,
  triggeredPrice,
  storeName,
  badgeLabel,
  badgeVariant = 'green',
  timestamp,
  distance,
  onToggle,
}: AlertCardProps) {
  const { tokens } = useTheme();
  const isTriggered = variant === 'triggered';
  const isOn = alert.is_active !== false;

  const badgeBg = badgeVariant === 'purple' ? tokens.purpleLight : tokens.successLight;
  const badgeColor = badgeVariant === 'purple' ? tokens.purple : tokens.success;

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: tokens.surface, borderColor: '#e8edf2' },
        isTriggered && styles.cardTriggered,
      ]}
    >
      {/* Green left border indicator for triggered alerts */}
      {isTriggered && <View style={styles.triggeredBorder} />}

      {/* Bell icon */}
      <View style={[styles.iconBox, { backgroundColor: tokens.accentSoft }]}>
        <Bell size={18} color={tokens.accent} strokeWidth={2} />
      </View>

      {/* Text content */}
      <View style={styles.content}>
        <Text style={[styles.productName, { color: tokens.textDark }]} numberOfLines={1}>
          {alert.product.name}
        </Text>

        {isTriggered ? (
          <>
            {triggeredPrice !== undefined && storeName && (
              <Text style={[styles.triggeredPrice, { color: tokens.success }]}>
                R$ {triggeredPrice.toFixed(2)} no {storeName}
              </Text>
            )}
            <View style={styles.statusRow}>
              <View style={[styles.statusDot, { backgroundColor: tokens.success }]} />
              <Text style={[styles.statusText, { color: tokens.success }]}>
                Em promoção agora!
              </Text>
            </View>
          </>
        ) : (
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, { backgroundColor: tokens.primary }]} />
            <Text style={[styles.statusText, { color: tokens.primary }]}>
              {alert.target_price
                ? `Monitorando · R$ ${alert.target_price.toFixed(2)} alvo`
                : 'Monitorando · sem alvo definido'}
            </Text>
          </View>
        )}

        {/* Meta row: badge + timestamp + distance */}
        {isTriggered && (badgeLabel || timestamp || distance) && (
          <View style={styles.metaRow}>
            {badgeLabel && (
              <View style={[styles.badge, { backgroundColor: badgeBg }]}>
                <Text style={[styles.badgeText, { color: badgeColor }]}>{badgeLabel}</Text>
              </View>
            )}
            {timestamp && (
              <Text style={[styles.metaText, { color: tokens.textHint }]}>{timestamp}</Text>
            )}
            {distance && (
              <Text style={[styles.metaText, { color: tokens.textHint }]}>· {distance}</Text>
            )}
          </View>
        )}
      </View>

      {/* Toggle switch */}
      {onToggle && (
        <Pressable
          onPress={() => onToggle(alert.id, !isOn)}
          accessibilityLabel={`${isOn ? 'Desativar' : 'Ativar'} alerta para ${alert.product.name}`}
          accessibilityRole="switch"
          style={styles.toggleHitArea}
        >
          <View style={[styles.toggleTrack, isOn && { backgroundColor: tokens.primary }]}>
            <View style={[styles.toggleKnob, isOn && styles.toggleKnobOn]} />
          </View>
        </Pressable>
      )}
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
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 14,
    overflow: 'hidden',
  },
  cardTriggered: {
    paddingLeft: 18,
  },
  triggeredBorder: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: '#16A34A',
    borderTopLeftRadius: 14,
    borderBottomLeftRadius: 14,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
  },
  productName: {
    fontSize: 14,
    fontWeight: '700',
  },
  triggeredPrice: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 3,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    flexWrap: 'wrap',
  },
  badge: {
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  metaText: {
    fontSize: 11,
  },
  toggleHitArea: {
    padding: 4,
  },
  toggleTrack: {
    width: 42,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#D1D5DB',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleKnob: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
  },
  toggleKnobOn: {
    alignSelf: 'flex-end',
  },
});
