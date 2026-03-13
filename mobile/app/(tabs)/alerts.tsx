import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  Switch,
  Pressable,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MotiView } from 'moti';
import { Bell, MapPin, Crown } from 'lucide-react-native';
import { useAlerts } from '@/hooks/use-alerts';
import { useAuthStore } from '@precomapa/shared';
import { useTheme } from '@/theme/use-theme';
import { Paywall } from '@/components/paywall';
import type { AlertWithProduct } from '@/types';

const FREE_ALERT_LIMIT = 3;

export default function AlertsScreen() {
  const { tokens } = useTheme();
  const { alerts, isLoading, disable, count, refresh } = useAlerts();
  const profile = useAuthStore((s) => s.profile);
  const isFree = profile?.b2c_plan === 'free';
  const [showPaywall, setShowPaywall] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const limitReached = isFree && count >= FREE_ALERT_LIMIT;

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  const renderItem = ({ item, index }: { item: AlertWithProduct; index: number }) => (
    <MotiView
      from={{ opacity: 0, translateY: 12 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: 300, delay: index * 50 }}
    >
      <View style={[styles.card, { backgroundColor: tokens.surface, borderColor: tokens.border }]}>
        <View style={[styles.iconCircle, { backgroundColor: tokens.primaryMuted }]}>
          <Bell size={20} color={tokens.primary} />
        </View>
        <View style={styles.cardContent}>
          <Text style={[styles.productName, { color: tokens.textPrimary }]}>
            {item.product.name}
          </Text>
          {item.target_price && (
            <Text style={[styles.targetPrice, { color: tokens.textSecondary }]}>
              Alvo: R$ {item.target_price.toFixed(2)}
            </Text>
          )}
          <View style={styles.radiusRow}>
            <MapPin size={10} color={tokens.textHint} />
            <Text style={[styles.radiusText, { color: tokens.textHint }]}>
              Raio: {item.radius_km} km
            </Text>
          </View>
        </View>
        <Switch
          value={item.is_active}
          onValueChange={(value) => {
            if (!value) disable(item.id);
          }}
          trackColor={{ false: tokens.border, true: tokens.primary }}
          accessibilityLabel={`Desativar alerta para ${item.product.name}`}
          accessibilityRole="switch"
        />
      </View>
    </MotiView>
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: tokens.bg }]} edges={['top']}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: tokens.textPrimary }]}>
          Alertas de Ofertas
        </Text>
        <Text style={[styles.subtitle, { color: tokens.textSecondary }]}>
          Receba notificações quando seus produtos favoritos entrarem em promoção
        </Text>
        {isFree && (
          <Pressable
            onPress={() => limitReached && setShowPaywall(true)}
            accessibilityLabel={`${count} de ${FREE_ALERT_LIMIT} alertas usados`}
            accessibilityRole={limitReached ? 'button' : undefined}
            style={[styles.limitBadge, { backgroundColor: tokens.primaryMuted }]}
          >
            <Text style={[styles.limitText, { color: tokens.primary }]}>
              {count}/{FREE_ALERT_LIMIT} alertas
            </Text>
            {limitReached && <Crown size={12} color={tokens.primary} />}
          </Pressable>
        )}
        {limitReached && (
          <Pressable
            onPress={() => setShowPaywall(true)}
            accessibilityLabel="Fazer upgrade para alertas ilimitados"
            accessibilityRole="button"
            style={[styles.upgradeBanner, { backgroundColor: tokens.accentSoft }]}
          >
            <Crown size={16} color={tokens.accent} />
            <Text style={[styles.upgradeText, { color: tokens.textSecondary }]}>
              Limite de alertas atingido.{' '}
              <Text style={{ color: tokens.primary, fontWeight: '600' }}>
                Faça upgrade
              </Text>{' '}
              para alertas ilimitados.
            </Text>
          </Pressable>
        )}
      </View>

      {isLoading ? (
        <View style={styles.skeletonList}>
          {[0, 1, 2].map((i) => (
            <MotiView
              key={i}
              from={{ opacity: 0.4 }}
              animate={{ opacity: 1 }}
              transition={{ type: 'timing', duration: 800, loop: true }}
              style={[styles.card, { backgroundColor: tokens.surface, borderColor: tokens.border }]}
            >
              <View style={[styles.skeletonCircle, { backgroundColor: tokens.border }]} />
              <View style={styles.skeletonLines}>
                <View style={[styles.skeletonLine, styles.skeletonLineLong, { backgroundColor: tokens.border }]} />
                <View style={[styles.skeletonLine, styles.skeletonLineShort, { backgroundColor: tokens.border }]} />
              </View>
              <View style={[styles.skeletonSwitch, { backgroundColor: tokens.border }]} />
            </MotiView>
          ))}
        </View>
      ) : alerts.length === 0 ? (
        <View style={styles.emptyState}>
          <Bell size={48} color={tokens.textHint} />
          <Text style={[styles.emptyTitle, { color: tokens.textPrimary }]}>
            Nenhum alerta ativo
          </Text>
          <Text style={[styles.emptySubtitle, { color: tokens.textSecondary }]}>
            Receba notificações quando seus produtos favoritos entrarem em promoção perto de você
          </Text>
        </View>
      ) : (
        <FlatList
          data={alerts}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={renderItem}
          keyboardDismissMode="on-drag"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={tokens.primary} />
          }
        />
      )}
      <Paywall visible={showPaywall} onClose={() => setShowPaywall(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { paddingHorizontal: 16, paddingTop: 24, paddingBottom: 12 },
  title: { fontSize: 24, fontWeight: '700' },
  subtitle: { fontSize: 14, marginTop: 4 },
  limitBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: 8,
  },
  limitText: { fontSize: 12, fontWeight: '600' },
  upgradeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: 8,
  },
  upgradeText: { fontSize: 12, flex: 1 },
  listContent: { gap: 12, paddingHorizontal: 16, paddingBottom: 16 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardContent: { flex: 1 },
  productName: { fontSize: 14, fontWeight: '600' },
  targetPrice: { fontSize: 12, marginTop: 2 },
  radiusRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  radiusText: { fontSize: 12 },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: { fontSize: 18, fontWeight: '600', marginTop: 16 },
  emptySubtitle: { fontSize: 14, textAlign: 'center', marginTop: 8 },
  skeletonList: { gap: 12, paddingHorizontal: 16, marginTop: 8 },
  skeletonCircle: { width: 40, height: 40, borderRadius: 20 },
  skeletonLines: { flex: 1, gap: 6 },
  skeletonLine: { borderRadius: 8, height: 16 },
  skeletonLineLong: { width: '66%' },
  skeletonLineShort: { width: '33%', height: 12 },
  skeletonSwitch: { width: 48, height: 32, borderRadius: 16 },
});
