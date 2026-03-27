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
import { Bell, Check, ChevronRight, Zap } from 'lucide-react-native';
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

const HOW_IT_WORKS_STEPS = [
  {
    title: 'Escolha um produto',
    desc: 'Busque e selecione o produto que deseja monitorar',
  },
  {
    title: 'Nós monitoramos',
    desc: 'Acompanhamos os preços em todos os mercados da região',
  },
  {
    title: 'Você é notificado',
    desc: 'Receba uma notificação assim que o produto entrar em promoção',
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Splits alerts into triggered (novidades) vs monitoring groups.
 * An alert is "triggered" when the backend has recorded a triggered_at timestamp.
 */
function splitAlerts(alerts: AlertWithProduct[]) {
  const triggered: AlertWithProduct[] = [];
  const monitoring: AlertWithProduct[] = [];

  for (const alert of alerts) {
    if (alert.triggered_at) {
      triggered.push(alert);
    } else {
      monitoring.push(alert);
    }
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
          Nunca perca uma promoção
        </Text>
        <Text style={[styles.emptySubtitle, { color: tokens.textSecondary }]}>
          Crie alertas para seus produtos favoritos e seja notificado quando entrarem em promoção
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

      {/* Como funciona */}
      <MotiView
        from={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ type: 'timing', duration: 400, delay: 300 }}
        style={styles.howItWorksSection}
      >
        <Text style={[styles.howItWorksLabel, { color: tokens.textMuted }]}>
          COMO FUNCIONA
        </Text>
        {HOW_IT_WORKS_STEPS.map((step, i) => (
          <View key={step.title} style={styles.stepRow}>
            <View style={[styles.numberCircle, { backgroundColor: tokens.bgLight }]}>
              <Text style={[styles.numberText, { color: tokens.primary }]}>{i + 1}</Text>
            </View>
            <View style={styles.stepTextCol}>
              <Text style={[styles.stepTitle, { color: tokens.textDark }]}>{step.title}</Text>
              <Text style={[styles.stepDesc, { color: tokens.textSecondary }]}>{step.desc}</Text>
            </View>
          </View>
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
// Triggered Banner
// ---------------------------------------------------------------------------

interface TriggeredBannerProps {
  alert: AlertWithProduct;
  triggeredPrice: number;
  storeName: string;
  discount?: number;
  tokens: PaletteTokens;
  onPress: () => void;
}

function TriggeredBanner({
  alert,
  triggeredPrice,
  storeName,
  discount,
  tokens,
  onPress,
}: TriggeredBannerProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.triggeredBanner,
        pressed && styles.pressedOpacity,
      ]}
    >
      <View style={styles.triggeredBannerIcon}>
        <Check size={18} color="#FFFFFF" strokeWidth={2.5} />
      </View>
      <View style={styles.triggeredBannerContent}>
        <Text style={styles.triggeredBannerTitle} numberOfLines={1}>
          {alert.product.name} em promoção!
        </Text>
        <Text style={styles.triggeredBannerDesc} numberOfLines={1}>
          R$ {triggeredPrice.toFixed(2)} no {storeName}
          {discount ? ` · -${discount}%` : ''}
          {' · Menor em 30 dias'}
        </Text>
      </View>
      <Text style={[styles.triggeredBannerAction, { color: tokens.success }]}>
        Ver oferta →
      </Text>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Upsell Card
// ---------------------------------------------------------------------------

interface UpsellCardProps {
  tokens: PaletteTokens;
  onUpgrade: () => void;
}

function UpsellCard({ tokens, onUpgrade }: UpsellCardProps) {
  return (
    <Pressable
      onPress={onUpgrade}
      style={({ pressed }) => [
        styles.upsellCard,
        pressed && styles.pressedOpacity,
      ]}
    >
      <View style={[styles.upsellIcon, { backgroundColor: tokens.purple }]}>
        <Zap size={16} color="#FFFFFF" strokeWidth={2} />
      </View>
      <View style={styles.upsellTextCol}>
        <Text style={[styles.upsellTitle, { color: tokens.purple }]}>
          Alertas avançados com Plus
        </Text>
        <Text style={styles.upsellSubtitle}>
          Me avise quando desconto {'>'} 45%
        </Text>
      </View>
      <ChevronRight size={16} color={tokens.purple} />
    </Pressable>
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
  const { alerts, isLoading, toggle, count, refresh } = useAlerts();
  const profile = useAuthStore((s) => s.profile);
  const isFree = profile?.b2c_plan === 'free';
  const [showPaywall, setShowPaywall] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

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
              style={({ pressed }) => [pressed && styles.pressedOpacity]}
            >
              <Text style={[styles.addBtnText, { color: tokens.primary }]}>+ Novo</Text>
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
            {/* Triggered banners */}
            {triggered.map((alert) => {
              const discount = alert.triggered_price && alert.product.reference_price
                ? Math.round((1 - alert.triggered_price / alert.product.reference_price) * 100)
                : undefined;
              return (
                <TriggeredBanner
                  key={alert.id}
                  alert={alert}
                  triggeredPrice={alert.triggered_price ?? 0}
                  storeName={alert.triggered_store?.name ?? ''}
                  discount={discount}
                  tokens={tokens}
                  onPress={() => router.push(`/product/${alert.product_id}` as any)}
                />
              );
            })}

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
                  {triggered.map((alert, index) => {
                    const discount = alert.triggered_price && alert.product.reference_price
                      ? Math.round((1 - alert.triggered_price / alert.product.reference_price) * 100)
                      : undefined;
                    return (
                      <MotiView
                        key={alert.id}
                        from={{ opacity: 0, translateY: 12 }}
                        animate={{ opacity: 1, translateY: 0 }}
                        transition={{ type: 'timing', duration: 300, delay: index * 50 }}
                      >
                        <AlertCard
                          alert={alert}
                          variant="triggered"
                          triggeredPrice={alert.triggered_price ?? undefined}
                          storeName={alert.triggered_store?.name ?? undefined}
                          badgeLabel={discount ? `-${discount}%` : undefined}
                          onToggle={toggle}
                        />
                      </MotiView>
                    );
                  })}
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
                        onToggle={toggle}
                      />
                    </MotiView>
                  ))}
                </View>
              </MotiView>
            )}

            {/* Upsell banner for free users */}
            {isFree && (
              <UpsellCard
                tokens={tokens}
                onUpgrade={() => setShowPaywall(true)}
              />
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
    fontFamily: 'Poppins_700Bold',
  },
  addBtnText: {
    fontSize: 12,
    fontWeight: '600',
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
    fontFamily: 'Poppins_700Bold',
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

  // Triggered banner
  triggeredBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 14,
    padding: 12,
    marginBottom: 4,
  },
  triggeredBannerIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#16A34A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  triggeredBannerContent: {
    flex: 1,
  },
  triggeredBannerTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#166534',
  },
  triggeredBannerDesc: {
    fontSize: 10,
    color: '#15803d',
    marginTop: 1,
  },
  triggeredBannerAction: {
    fontSize: 11,
    fontWeight: '700',
  },

  // Upsell card (purple Plus banner)
  upsellCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F5F3FF',
    borderWidth: 1.5,
    borderColor: '#DDD6FE',
    borderRadius: 14,
    padding: 14,
    marginTop: 16,
  },
  upsellIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  upsellTextCol: {
    flex: 1,
  },
  upsellTitle: {
    fontSize: 12,
    fontWeight: '700',
  },
  upsellSubtitle: {
    fontSize: 10,
    color: '#7C3AED',
    opacity: 0.7,
    marginTop: 1,
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

  // How it works
  howItWorksSection: {
    marginTop: 32,
  },
  howItWorksLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 16,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 16,
  },
  numberCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numberText: {
    fontSize: 14,
    fontWeight: '800',
  },
  stepTextCol: {
    flex: 1,
    paddingTop: 2,
  },
  stepTitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  stepDesc: {
    fontSize: 11,
    marginTop: 2,
    lineHeight: 15,
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
