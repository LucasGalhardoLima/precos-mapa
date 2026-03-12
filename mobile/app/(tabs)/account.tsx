import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Alert,
  Linking,
  Share,
  StyleSheet,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Burnt from 'burnt';
import {
  Bell,
  MapPin,
  Store,
  ChevronRight,
  Lock,
  Trash2,
  Crown,
  CreditCard,
  FileText,
  FileDown,
  LogOut,
  Check,
  Sparkles,
} from 'lucide-react-native';

import { useTheme } from '@/theme/use-theme';
import { useAuthStore } from '@precomapa/shared';
import { useFavorites } from '@/hooks/use-favorites';
import { useAlerts } from '@/hooks/use-alerts';
import { useSubscription } from '@/hooks/use-subscription';
import { useAccount } from '@/hooks/use-account';
import { supabase } from '@/lib/supabase';
import { Paywall } from '@/components/paywall';
import { CouponLine } from '@/components/themed/coupon-line';
import { SectionDivider } from '@/components/themed/section-divider';
import type { LucideIcon } from 'lucide-react-native';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TERMS_URL = 'https://poup.com.br/termos';

const PLUS_HIGHLIGHTS = [
  'Favoritos e alertas ilimitados',
  'Listas de compras inteligentes',
  'Sem anúncios',
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getInitial(displayName: string | null | undefined, email: string | undefined): string {
  if (displayName && displayName.length > 0) {
    return displayName.charAt(0).toUpperCase();
  }
  if (email && email.length > 0) {
    return email.charAt(0).toUpperCase();
  }
  return '?';
}

function getPlanLabel(plan: string): string {
  switch (plan) {
    case 'plus':
      return 'PLUS';
    case 'family':
      return 'FAMILY';
    default:
      return 'FREE';
  }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface SettingsRowProps {
  icon: LucideIcon;
  iconColor: string;
  label: string;
  value?: string;
  labelColor?: string;
  onPress?: () => void;
  tokens: ReturnType<typeof useTheme>['tokens'];
}

function SettingsRow({
  icon: Icon,
  iconColor,
  label,
  value,
  labelColor,
  onPress,
  tokens,
}: SettingsRowProps) {
  return (
    <Pressable
      style={[styles.row, { borderBottomColor: tokens.border }]}
      onPress={onPress}
      android_ripple={{ color: tokens.mist }}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={value ? `${label}, ${value}` : label}
    >
      <View style={styles.rowLeft}>
        <Icon size={20} color={iconColor} />
        <Text
          style={[
            styles.rowLabel,
            { color: labelColor ?? tokens.textPrimary },
          ]}
        >
          {label}
        </Text>
      </View>
      <View style={styles.rowRight}>
        {value != null && (
          <Text style={[styles.rowValue, { color: tokens.textHint }]}>
            {value}
          </Text>
        )}
        {onPress != null && (
          <ChevronRight size={18} color={tokens.textHint} />
        )}
      </View>
    </Pressable>
  );
}

interface SectionHeaderProps {
  title: string;
  tokens: ReturnType<typeof useTheme>['tokens'];
}

function SectionHeader({ title, tokens }: SectionHeaderProps) {
  return (
    <Text style={[styles.sectionHeader, { color: tokens.textHint }]}>
      {title}
    </Text>
  );
}

// ---------------------------------------------------------------------------
// Account Screen
// ---------------------------------------------------------------------------

export default function AccountScreen() {
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const session = useAuthStore((s) => s.session);
  const profile = useAuthStore((s) => s.profile);
  const setSession = useAuthStore((s) => s.setSession);
  const { count: favoriteCount } = useFavorites();
  const { count: alertCount } = useAlerts();
  const { plan, isPlus } = useSubscription();
  const { exportData, deleteAccount, isExporting } = useAccount();

  const [paywallVisible, setPaywallVisible] = useState(false);

  const email = session?.user?.email ?? '';
  const displayName = profile?.display_name ?? '';
  const city = profile?.city ?? 'Não definida';
  const state = profile?.state ?? '';
  const locationDisplay = state ? `${city}, ${state}` : city;
  const initial = getInitial(displayName, email);
  const planLabel = getPlanLabel(plan);
  const isPaidPlan = isPlus;

  // -----------------------------------------------------------------------
  // Handlers
  // -----------------------------------------------------------------------

  const handleOpenPaywall = useCallback(() => {
    setPaywallVisible(true);
  }, []);

  const handleClosePaywall = useCallback(() => {
    setPaywallVisible(false);
  }, []);

  const handleOpenAlerts = useCallback(() => {
    router.push('/(tabs)/alerts');
  }, [router]);

  const handleOpenLocation = useCallback(() => {
    Linking.openSettings();
  }, []);

  const handleOpenFavorites = useCallback(() => {
    router.push('/(tabs)/favorites');
  }, [router]);

  const handleResetPassword = useCallback(async () => {
    if (!email) return;
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) throw error;
      Burnt.toast({
        title: 'E-mail enviado',
        message: 'Verifique sua caixa de entrada para redefinir a senha.',
        preset: 'done',
        haptic: 'success',
      });
    } catch {
      Burnt.toast({
        title: 'Erro',
        message: 'Não foi possível enviar o e-mail. Tente novamente.',
        preset: 'error',
        haptic: 'error',
      });
    }
  }, [email]);

  const handleExportData = useCallback(async () => {
    const data = await exportData();
    if (!data) return;
    const json = JSON.stringify(data, null, 2);
    await Share.share({
      message: json,
      title: 'Meus dados — Poup',
    });
  }, [exportData]);

  const handleDeleteAccount = useCallback(() => {
    Alert.alert(
      'Excluir conta',
      'Tem certeza que deseja excluir sua conta? Esta ação é irreversível e todos os seus dados serão apagados permanentemente.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            const success = await deleteAccount();
            if (success) {
              Burnt.toast({
                title: 'Conta excluída',
                message: 'Sua conta foi excluída com sucesso.',
                preset: 'done',
                haptic: 'success',
              });
            } else {
              Alert.alert(
                'Erro',
                'Não foi possível excluir sua conta. Tente novamente mais tarde.',
              );
            }
          },
        },
      ],
    );
  }, [deleteAccount]);

  const handleSignOut = useCallback(async () => {
    await supabase.auth.signOut();
    setSession(null);
  }, [setSession]);

  const handleOpenTerms = useCallback(() => {
    Linking.openURL(TERMS_URL);
  }, []);

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: tokens.bg }]} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{
          paddingBottom: insets.bottom,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* ----------------------------------------------------------------- */}
        {/* User Header                                                       */}
        {/* ----------------------------------------------------------------- */}
        <View style={styles.header}>
          <View
            style={[
              styles.avatar,
              { backgroundColor: isPaidPlan ? tokens.accentSoft : tokens.primaryMuted },
            ]}
          >
            <Text
              style={[
                styles.avatarLetter,
                { color: isPaidPlan ? tokens.warning : tokens.primary },
              ]}
            >
              {initial}
            </Text>
          </View>

          <View style={styles.headerInfo}>
            <View style={styles.nameRow}>
              <Text
                style={[styles.displayName, { color: tokens.textPrimary }]}
                numberOfLines={1}
              >
                {displayName || 'Usuário'}
              </Text>

              {/* Plan badge */}
              {isPaidPlan ? (
                <View style={[styles.badge, { backgroundColor: tokens.accentSoft }]}>
                  <Crown size={12} color={tokens.warning} />
                  <Text style={[styles.badgeText, { color: tokens.warning }]}>
                    {planLabel}
                  </Text>
                </View>
              ) : (
                <View
                  style={[
                    styles.badge,
                    styles.badgeOutline,
                    { borderColor: tokens.primary },
                  ]}
                >
                  <Text style={[styles.badgeText, { color: tokens.primary }]}>
                    GRÁTIS
                  </Text>
                </View>
              )}
            </View>

            <Text
              style={[styles.email, { color: tokens.textSecondary }]}
              numberOfLines={1}
            >
              {email}
            </Text>
          </View>
        </View>

        {/* ----------------------------------------------------------------- */}
        {/* Upgrade CTA / Plan management                                     */}
        {/* ----------------------------------------------------------------- */}
        <CouponLine style={styles.couponLine} />

        {isPaidPlan ? (
          /* Plan management info for Plus/Family subscribers */
          <View
            style={[
              styles.planCard,
              { backgroundColor: tokens.accentSoft, borderColor: tokens.warning },
            ]}
          >
            <View style={styles.planCardHeader}>
              <Crown size={20} color={tokens.warning} />
              <Text style={[styles.planCardTitle, { color: tokens.warning }]}>
                Plano {planLabel}
              </Text>
            </View>
            <Text style={[styles.planCardDesc, { color: tokens.textSecondary }]}>
              Você tem acesso a todos os recursos premium. Gerencie sua
              assinatura nas configurações da loja de aplicativos.
            </Text>
          </View>
        ) : (
          /* Upgrade CTA card for free users */
          <Pressable
            style={[styles.upgradeCard, { backgroundColor: tokens.accentSoft }]}
            onPress={handleOpenPaywall}
          >
            <View style={styles.upgradeCardHeader}>
              <Sparkles size={22} color={tokens.warning} />
              <Text style={[styles.upgradeTitle, { color: tokens.warning }]}>
                Upgrade para Plus
              </Text>
            </View>

            <View style={styles.upgradeHighlights}>
              {PLUS_HIGHLIGHTS.map((text) => (
                <View key={text} style={styles.highlightRow}>
                  <Check size={14} color={tokens.warning} />
                  <Text style={[styles.highlightText, { color: tokens.textPrimary }]}>
                    {text}
                  </Text>
                </View>
              ))}
            </View>

            <Text style={[styles.upgradeTeaser, { color: tokens.warning }]}>
              {'7 dias grátis \u2192'}
            </Text>
          </Pressable>
        )}

        <SectionDivider style={{ marginVertical: 8 }} />

        {/* ----------------------------------------------------------------- */}
        {/* PREFERÊNCIAS                                                      */}
        {/* ----------------------------------------------------------------- */}
        <SectionHeader title="PREFERÊNCIAS" tokens={tokens} />

        <SettingsRow
          icon={Bell}
          iconColor={tokens.primary}
          label="Alertas de oferta"
          value={`${alertCount} ativo${alertCount !== 1 ? 's' : ''}`}
          onPress={handleOpenAlerts}
          tokens={tokens}
        />

        <SettingsRow
          icon={MapPin}
          iconColor={tokens.primary}
          label="Localização"
          value={locationDisplay}
          onPress={handleOpenLocation}
          tokens={tokens}
        />

        <SettingsRow
          icon={Store}
          iconColor={tokens.primary}
          label="Meus favoritos"
          value={`${favoriteCount} produto${favoriteCount !== 1 ? 's' : ''}`}
          onPress={handleOpenFavorites}
          tokens={tokens}
        />

        <SectionDivider style={{ marginVertical: 8 }} />

        {/* ----------------------------------------------------------------- */}
        {/* CONTA                                                             */}
        {/* ----------------------------------------------------------------- */}
        <SectionHeader title="CONTA" tokens={tokens} />

        <SettingsRow
          icon={Lock}
          iconColor={tokens.primary}
          label="Alterar senha"
          onPress={handleResetPassword}
          tokens={tokens}
        />

        <SettingsRow
          icon={FileDown}
          iconColor={tokens.primary}
          label={isExporting ? 'Exportando...' : 'Exportar meus dados'}
          onPress={handleExportData}
          tokens={tokens}
        />

        <SettingsRow
          icon={Trash2}
          iconColor={tokens.danger}
          label="Excluir conta"
          labelColor={tokens.danger}
          onPress={handleDeleteAccount}
          tokens={tokens}
        />

        <SectionDivider style={{ marginVertical: 8 }} />

        {/* ----------------------------------------------------------------- */}
        {/* ASSINATURA                                                        */}
        {/* ----------------------------------------------------------------- */}
        <SectionHeader title="ASSINATURA" tokens={tokens} />

        <SettingsRow
          icon={CreditCard}
          iconColor={tokens.primary}
          label="Plano atual"
          value={planLabel}
          onPress={isPaidPlan ? undefined : handleOpenPaywall}
          tokens={tokens}
        />

        <SettingsRow
          icon={FileText}
          iconColor={tokens.primary}
          label="Termos de uso"
          onPress={handleOpenTerms}
          tokens={tokens}
        />

        <SectionDivider style={{ marginVertical: 8 }} />

        <SettingsRow
          icon={LogOut}
          iconColor={tokens.textSecondary}
          label="Sair"
          onPress={handleSignOut}
          tokens={tokens}
        />
      </ScrollView>

      {/* Paywall modal */}
      <Paywall visible={paywallVisible} onClose={handleClosePaywall} />
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
  scroll: {
    flex: 1,
  },

  // -- Header ---------------------------------------------------------------
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    fontSize: 24,
    fontWeight: '700',
  },
  headerInfo: {
    flex: 1,
    marginLeft: 14,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  displayName: {
    fontSize: 18,
    fontWeight: '700',
    flexShrink: 1,
  },
  email: {
    fontSize: 13,
    marginTop: 2,
  },

  // -- Badge ----------------------------------------------------------------
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  badgeOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  // -- Coupon line ----------------------------------------------------------
  couponLine: {
    marginHorizontal: 16,
  },

  // -- Upgrade card ---------------------------------------------------------
  upgradeCard: {
    marginHorizontal: 16,
    borderRadius: 16,
    padding: 16,
  },
  upgradeCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  upgradeTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  upgradeHighlights: {
    gap: 6,
    marginBottom: 12,
  },
  highlightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  highlightText: {
    fontSize: 14,
  },
  upgradeTeaser: {
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'right',
  },

  // -- Plan management card -------------------------------------------------
  planCard: {
    marginHorizontal: 16,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
  },
  planCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  planCardTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  planCardDesc: {
    fontSize: 13,
    lineHeight: 18,
  },

  // -- Section header -------------------------------------------------------
  sectionHeader: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 8,
  },

  // -- Settings row ---------------------------------------------------------
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  rowLabel: {
    fontSize: 15,
    fontWeight: '500',
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rowValue: {
    fontSize: 13,
  },
});
