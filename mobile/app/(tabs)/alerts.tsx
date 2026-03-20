import React, { useState, useCallback } from 'react';
import { useRouter } from 'expo-router';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MotiView } from 'moti';
import { Bell, Plus } from 'lucide-react-native';
import { useAlerts } from '@/hooks/use-alerts';
import { useAuthStore } from '@poup/shared';
import { useTheme } from '@/theme/use-theme';
import type { PaletteTokens } from '@/theme/palettes';
import { Paywall } from '@/components/paywall';
import { AlertCard } from '@/components/alert-card';
import { SuggestedProductCard, type SuggestedProduct } from '@/components/suggested-product-card';
import type { AlertWithProduct } from '@/types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FREE_ALERT_LIMIT = 3;

const SUGGESTED_PRODUCTS: SuggestedProduct[] = [
  { emoji: '🥛', name: 'Leite Integral 1L', subtitle: 'Em promoção em 3 mercados' },
  { emoji: '🍚', name: 'Arroz 5kg', subtitle: 'Preço caiu 8% essa semana' },
  { emoji: '☕', name: 'Café 500g', subtitle: 'Menor preço em 30 dias' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Splits alerts into triggered (novidades) vs monitoring groups.
 * The current data model has no `triggered_at` field, so all alerts are
 * placed in "monitorando" until the backend adds that distinction.
 */
function splitAlerts(alerts: AlertWithProduct[]) {
  const triggered: AlertWithProduct[] = [];
  const monitoring: AlertWithProduct[] = [];

  for (const alert of alerts) {
    // Future: check alert.triggered_at or alert.last_triggered_price
    // For now, all active alerts go to monitoring.
    monitoring.push(alert);
  }

  return { triggered, monitoring };
}

// ---------------------------------------------------------------------------
// Empty State
// ---------------------------------------------------------------------------

interface EmptyStateProps {
  tokens: PaletteTokens;
  onCreateAlert: () => void;
}

function EmptyState({ tokens, onCreateAlert }: EmptyStateProps) {
  return (
    <ScrollView
      contentContainerStyle={styles.emptyScroll}
      showsVerticalScrollIndicator={false}
    >
      {/* Hero */}
      <MotiView
        from={{ opacity: 0, translateY: 20 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: 'timing', duration: 400 }}
        style={styles.emptyHero}
      >
        <View style={[styles.bellCircle, { backgroundColor: tokens.bgLight }]}>
          <Bell size={36} color={tokens.primary} />
        </View>
        <Text style={[styles.emptyTitle, { color: tokens.textDark }]}>
          Receba quando o preço cair
        </Text>
        <Text style={[styles.emptySubtitle, { color: tokens.textSecondary }]}>
          Defina um preço alvo e avisamos quando um mercado perto de você atingir esse valor.
        </Text>
        <Pressable
          onPress={onCreateAlert}
          accessibilityLabel="Criar primeiro alerta"
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.emptyCtaBtn,
            { backgroundColor: tokens.primary },
            pressed && styles.pressedOpacity,
          ]}
        >
          <Text style={styles.emptyCtaText}>Criar primeiro alerta</Text>
        </Pressable>
      </MotiView>

      {/* Suggestions */}
      <MotiView
        from={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ type: 'timing', duration: 400, delay: 150 }}
      >
        <Text style={[styles.sectionLabel, { color: tokens.textDark }]}>
          Sugestões perto de você
        </Text>
        {SUGGESTED_PRODUCTS.map((item) => (
          <SuggestedProductCard
            key={item.name}
            item={item}
            onCreateAlert={onCreateAlert}
          />
        ))}
      </MotiView>
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Section Header
// ---------------------------------------------------------------------------

interface SectionHeaderProps {
  label: string;
  count: number;
  variant: 'novidades' | 'monitorando';
  tokens: PaletteTokens;
}

function SectionHeader({ label, count, variant, tokens }: SectionHeaderProps) {
  const isDanger = variant === 'novidades';
  const badgeBg = isDanger ? tokens.danger : tokens.border;
  const badgeText = isDanger ? '#FFFFFF' : tokens.textSecondary;

  return (
    <View style={styles.sectionHeader}>
      {isDanger && <View style={[styles.redDot, { backgroundColor: tokens.danger }]} />}
      <Text style={[styles.sectionLabel, { color: tokens.textDark }]}>{label}</Text>
      <View style={[styles.countBadge, { backgroundColor: badgeBg }]}>
        <Text style={[styles.countBadgeText, { color: badgeText }]}>{count}</Text>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Upsell Card
// ---------------------------------------------------------------------------

interface UpsellCardProps {
  count: number;
  limit: number;
  tokens: PaletteTokens;
  onUpgrade: () => void;
}

function UpsellCard({ count, limit, tokens, onUpgrade }: UpsellCardProps) {
  return (
    <View
      style={[
        styles.upsellCard,
        { borderColor: tokens.primary, backgroundColor: tokens.mist },
      ]}
    >
      <Text style={[styles.upsellTitle, { color: tokens.textDark }]}>
        Você está usando {count} de {limit} alertas
      </Text>
      <Text style={[styles.upsellSubtitle, { color: tokens.textSecondary }]}>
        Assine o Poup Plus para alertas ilimitados
      </Text>
      <Pressable
        onPress={onUpgrade}
        accessibilityLabel="Ver planos"
        accessibilityRole="button"
        style={({ pressed }) => [
          styles.upsellBtn,
          { backgroundColor: tokens.primary },
          pressed && styles.pressedOpacity,
        ]}
      >
        <Text style={styles.upsellBtnText}>Ver planos</Text>
      </Pressable>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Skeleton Loading
// ---------------------------------------------------------------------------

function SkeletonLoader({ tokens }: { tokens: PaletteTokens }) {
  return (
    <View style={styles.skeletonList}>
      {[0, 1, 2].map((i) => (
        <MotiView
          key={i}
          from={{ opacity: 0.4 }}
          animate={{ opacity: 1 }}
          transition={{ type: 'timing', duration: 800, loop: true }}
          style={[styles.skeletonCard, { backgroundColor: tokens.surface, borderColor: tokens.border }]}
        >
          <View style={[styles.skeletonCircle, { backgroundColor: tokens.border }]} />
          <View style={styles.skeletonLines}>
            <View style={[styles.skeletonLine, styles.skeletonLineLong, { backgroundColor: tokens.border }]} />
            <View style={[styles.skeletonLine, styles.skeletonLineShort, { backgroundColor: tokens.border }]} />
          </View>
          <View style={[styles.skeletonDot, { backgroundColor: tokens.border }]} />
        </MotiView>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main Screen
// ---------------------------------------------------------------------------

export default function AlertsScreen() {
  const { tokens } = useTheme();
  const router = useRouter();
  const { alerts, isLoading, disable, count, refresh } = useAlerts();
  const profile = useAuthStore((s) => s.profile);
  const isFree = profile?.b2c_plan === 'free';
  const [showPaywall, setShowPaywall] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const nearLimit = isFree && count >= FREE_ALERT_LIMIT - 1;
  const atLimit = isFree && count >= FREE_ALERT_LIMIT;

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  const handleCreateAlert = useCallback(() => {
    if (atLimit) {
      setShowPaywall(true);
    } else {
      // Navigate to search so user can find a product and create an alert from the product page
      router.push('/(tabs)/search' as any);
    }
  }, [atLimit, router]);

  const { triggered, monitoring } = splitAlerts(alerts);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: tokens.bg }]} edges={['top']}>
      {/* ---- Loading ---- */}
      {isLoading ? (
        <SkeletonLoader tokens={tokens} />
      ) : alerts.length === 0 ? (
        /* ---- Empty State ---- */
        <EmptyState tokens={tokens} onCreateAlert={handleCreateAlert} />
      ) : (
        /* ---- Populated State ---- */
        <>
          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.screenTitle, { color: tokens.textDark }]}>Alertas</Text>
            <Pressable
              onPress={handleCreateAlert}
              accessibilityLabel="Criar novo alerta"
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.addBtn,
                { backgroundColor: tokens.primary },
                pressed && styles.pressedOpacity,
              ]}
            >
              <Plus size={18} color="#FFFFFF" />
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor={tokens.primary}
              />
            }
          >
            {/* Upsell card (near limit) */}
            {nearLimit && (
              <UpsellCard
                count={count}
                limit={FREE_ALERT_LIMIT}
                tokens={tokens}
                onUpgrade={() => setShowPaywall(true)}
              />
            )}

            {/* Novidades section */}
            {triggered.length > 0 && (
              <MotiView
                from={{ opacity: 0, translateY: 8 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ type: 'timing', duration: 300 }}
              >
                <SectionHeader
                  label="Novidades"
                  count={triggered.length}
                  variant="novidades"
                  tokens={tokens}
                />
                <View style={styles.sectionCards}>
                  {triggered.map((alert, index) => (
                    <MotiView
                      key={alert.id}
                      from={{ opacity: 0, translateY: 12 }}
                      animate={{ opacity: 1, translateY: 0 }}
                      transition={{ type: 'timing', duration: 300, delay: index * 50 }}
                    >
                      <AlertCard
                        alert={alert}
                        variant="triggered"
                        emoji="🛒"
                        onDisable={disable}
                      />
                    </MotiView>
                  ))}
                </View>
              </MotiView>
            )}

            {/* Monitorando section */}
            {monitoring.length > 0 && (
              <MotiView
                from={{ opacity: 0, translateY: 8 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ type: 'timing', duration: 300, delay: triggered.length > 0 ? 100 : 0 }}
              >
                <SectionHeader
                  label="Monitorando"
                  count={monitoring.length}
                  variant="monitorando"
                  tokens={tokens}
                />
                <View style={styles.sectionCards}>
                  {monitoring.map((alert, index) => (
                    <MotiView
                      key={alert.id}
                      from={{ opacity: 0, translateY: 12 }}
                      animate={{ opacity: 1, translateY: 0 }}
                      transition={{ type: 'timing', duration: 300, delay: index * 50 }}
                    >
                      <AlertCard
                        alert={alert}
                        variant="monitoring"
                        emoji="🛒"
                        onDisable={disable}
                      />
                    </MotiView>
                  ))}
                </View>
              </MotiView>
            )}
          </ScrollView>
        </>
      )}

      <Paywall visible={showPaywall} onClose={() => setShowPaywall(false)} />
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },

  // Header (populated state)
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
  },
  screenTitle: {
    fontSize: 22,
    fontWeight: '700',
  },
  addBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Content list
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
    gap: 4,
  },

  // Section header
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 20,
    marginBottom: 10,
  },
  sectionLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
  redDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  countBadge: {
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  countBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  sectionCards: {
    gap: 10,
  },

  // Upsell card
  upsellCard: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: 16,
    padding: 16,
    marginTop: 12,
    gap: 4,
  },
  upsellTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  upsellSubtitle: {
    fontSize: 12,
  },
  upsellBtn: {
    marginTop: 10,
    alignSelf: 'flex-start',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  upsellBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },

  // Empty state
  emptyScroll: {
    paddingHorizontal: 20,
    paddingTop: 32,
    paddingBottom: 32,
  },
  emptyHero: {
    alignItems: 'center',
    marginBottom: 32,
  },
  bellCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 10,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  emptyCtaBtn: {
    borderRadius: 12,
    paddingHorizontal: 28,
    paddingVertical: 14,
  },
  emptyCtaText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },

  // Skeleton
  skeletonList: {
    gap: 12,
    paddingHorizontal: 16,
    marginTop: 16,
  },
  skeletonCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
  },
  skeletonCircle: {
    width: 40,
    height: 40,
    borderRadius: 8,
  },
  skeletonLines: {
    flex: 1,
    gap: 6,
  },
  skeletonLine: {
    borderRadius: 8,
    height: 14,
  },
  skeletonLineLong: {
    width: '66%',
  },
  skeletonLineShort: {
    width: '40%',
    height: 12,
  },
  skeletonDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  // Shared
  pressedOpacity: {
    opacity: 0.75,
  },
});
