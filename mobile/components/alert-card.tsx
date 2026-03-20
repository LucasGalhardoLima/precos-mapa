import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
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
  /** Emoji to represent the product */
  emoji?: string;
  /** Icon background color */
  iconBg?: string;
  onDisable?: (id: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Alert card used in both "Novidades" (triggered) and "Monitorando" sections.
 *
 * - triggered: has a green left border, shows triggered price + store, optional badge.
 * - monitoring: no border accent, shows last price info and a gray dot.
 */
export function AlertCard({
  alert,
  variant,
  triggeredPrice,
  storeName,
  badgeLabel,
  badgeVariant = 'green',
  timestamp,
  distance,
  emoji = '🛒',
  iconBg,
  onDisable,
}: AlertCardProps) {
  const { tokens } = useTheme();
  const isTriggered = variant === 'triggered';

  const resolvedIconBg = iconBg ?? tokens.bgLight;

  const badgeBg = badgeVariant === 'purple' ? tokens.purpleLight : tokens.successLight;
  const badgeColor = badgeVariant === 'purple' ? tokens.purple : tokens.success;

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: tokens.surface, borderColor: tokens.border },
        isTriggered && styles.cardTriggered,
      ]}
    >
      {/* Green left border indicator for triggered alerts */}
      {isTriggered && <View style={styles.triggeredBorder} />}

      {/* Emoji icon */}
      <View style={[styles.iconBox, { backgroundColor: resolvedIconBg }]}>
        <Text style={styles.emoji}>{emoji}</Text>
      </View>

      {/* Text content */}
      <View style={styles.content}>
        <Text style={[styles.productName, { color: tokens.textDark }]} numberOfLines={1}>
          {alert.product.name}
        </Text>

        {isTriggered && triggeredPrice !== undefined && storeName ? (
          <Text style={[styles.triggeredPrice, { color: tokens.success }]}>
            R$ {triggeredPrice.toFixed(2)} no {storeName}
          </Text>
        ) : (
          <Text style={[styles.monitoringInfo, { color: tokens.textSecondary }]}>
            {alert.target_price
              ? `Alvo: R$ ${alert.target_price.toFixed(2)} · sem variação`
              : 'Monitorando preços · sem variação'}
          </Text>
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

      {/* Right indicator */}
      {isTriggered ? null : (
        <View style={[styles.monitoringDot, { backgroundColor: tokens.border }]} />
      )}

      {/* Disable button for triggered alerts (optional) */}
      {isTriggered && onDisable && (
        <Pressable
          onPress={() => onDisable(alert.id)}
          accessibilityLabel={`Desativar alerta para ${alert.product.name}`}
          accessibilityRole="button"
          style={styles.disableBtn}
        >
          <Text style={[styles.disableBtnText, { color: tokens.textHint }]}>✕</Text>
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
    borderRadius: 16,
    borderWidth: 1,
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
    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 16,
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
  productName: {
    fontSize: 14,
    fontWeight: '700',
  },
  triggeredPrice: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },
  monitoringInfo: {
    fontSize: 12,
    marginTop: 2,
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
  monitoringDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  disableBtn: {
    padding: 4,
  },
  disableBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
