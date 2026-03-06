import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Alert,
  Linking,
  StyleSheet,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Bell,
  MapPin,
  Store,
  ChevronRight,
  Lock,
  History,
  Trash2,
  Crown,
  CreditCard,
  FileText,
  Check,
  Sparkles,
} from 'lucide-react-native';

import { useTheme } from '@/theme/use-theme';
import type { PaletteName } from '@/theme/palettes';
import type { TabStyle } from '@/theme/store';
import { triggerHaptic } from '@/hooks/use-haptics';
import { ImpactFeedbackStyle } from 'expo-haptics';
import { useAuthStore } from '@precomapa/shared';
import { useFavorites } from '@/hooks/use-favorites';
import { useAlerts } from '@/hooks/use-alerts';
import { useSubscription } from '@/hooks/use-subscription';
import { supabase } from '@/lib/supabase';
import { Paywall } from '@/components/paywall';
import { CouponLine } from '@/components/themed/coupon-line';
import { SectionDivider } from '@/components/themed/section-divider';
import { TAB_BAR_HEIGHT } from '@/components/floating-tab-bar';

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

const PALETTE_OPTIONS: {
  value: PaletteName;
  label: string;
  description: string;
  colors: [string, string, string];
}[] = [
  {
    value: 'economia_verde',
    label: 'Economia Verde',
    description: 'Teal e dourado. Confiança e economia.',
    colors: ['#0D9488', '#F59E0B', '#F0FDFA'],
  },
  {
    value: 'encarte',
    label: 'Encarte',
    description: 'Verde floresta e papel. Clássico de mercado.',
    colors: ['#2A6041', '#C8392B', '#FAF7F0'],
  },
  {
    value: 'encarte_digital',
    label: 'Encarte Digital',
    description: 'Verde vibrante e vermelho. Familiar brasileiro.',
    colors: ['#059669', '#EF4444', '#ECFDF5'],
  },
  {
    value: 'fintech',
    label: 'Fintech',
    description: 'Grafite e verde profundo. App financeiro.',
    colors: ['#0B5E3A', '#C8192B', '#FAFBFC'],
  },
  {
    value: 'fintech_moderna',
    label: 'Fintech Moderna',
    description: 'Cyan e roxo. Premium digital.',
    colors: ['#0891B2', '#8B5CF6', '#F0F9FF'],
  },
];

const TAB_STYLE_OPTIONS: {
  value: TabStyle;
  label: string;
  description: string;
}[] = [
  {
    value: 'glass-pill',
    label: 'Glass Pill',
    description: 'Pílula flutuante com Liquid Glass.',
  },
  {
    value: 'native',
    label: 'Nativa iOS',
    description: 'Barra nativa com Liquid Glass automático.',
  },
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
  const { tokens, palette, setPalette, tabStyle, setTabStyle } = useTheme();
  const insets = useSafeAreaInsets();
  const session = useAuthStore((s) => s.session);
  const profile = useAuthStore((s) => s.profile);
  const { count: favoriteCount } = useFavorites();
  const { count: alertCount } = useAlerts();
  const { plan, isPlus } = useSubscription();

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
            try {
              const { error } = await supabase.rpc('delete_user_account');
              if (error) throw error;
              Alert.alert('Conta excluída', 'Sua conta foi excluída com sucesso.');
            } catch {
              Alert.alert(
                'Erro',
                'Não foi possível excluir sua conta. Tente novamente mais tarde.',
              );
            }
          },
        },
      ],
    );
  }, []);

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
          paddingBottom: TAB_BAR_HEIGHT + insets.bottom,
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
          onPress={() => {}}
          tokens={tokens}
        />

        <SettingsRow
          icon={MapPin}
          iconColor={tokens.primary}
          label="Localização"
          value={locationDisplay}
          onPress={() => {}}
          tokens={tokens}
        />

        <SettingsRow
          icon={Store}
          iconColor={tokens.primary}
          label="Meus mercados"
          value={`${favoriteCount} selecionado${favoriteCount !== 1 ? 's' : ''}`}
          onPress={() => {}}
          tokens={tokens}
        />

        <SectionDivider style={{ marginVertical: 8 }} />

        {/* ----------------------------------------------------------------- */}
        {/* APARÊNCIA                                                         */}
        {/* ----------------------------------------------------------------- */}
        <SectionHeader title="APARÊNCIA" tokens={tokens} />

        {PALETTE_OPTIONS.map((opt) => {
          const isSelected = palette === opt.value;
          return (
            <Pressable
              key={opt.value}
              style={[styles.row, { borderBottomColor: tokens.border }]}
              onPress={() => {
                triggerHaptic(ImpactFeedbackStyle.Medium);
                setPalette(opt.value);
              }}
              android_ripple={{ color: tokens.mist }}
            >
              <View style={styles.rowLeft}>
                <View style={styles.swatchRow}>
                  {opt.colors.map((c, i) => (
                    <View
                      key={i}
                      style={[
                        styles.swatchCircle,
                        { backgroundColor: c, borderColor: tokens.border },
                      ]}
                    />
                  ))}
                </View>
                <View style={styles.paletteInfo}>
                  <Text style={[styles.rowLabel, { color: tokens.textPrimary }]}>
                    {opt.label}
                  </Text>
                  <Text style={[styles.paletteDesc, { color: tokens.textHint }]}>
                    {opt.description}
                  </Text>
                </View>
              </View>
              {isSelected && <Check size={20} color={tokens.primary} />}
            </Pressable>
          );
        })}

        {/* Tab style picker */}
        <SectionHeader title="ESTILO DA BARRA" tokens={tokens} />

        {TAB_STYLE_OPTIONS.map((opt) => {
          const isSelected = tabStyle === opt.value;
          return (
            <Pressable
              key={opt.value}
              style={[styles.row, { borderBottomColor: tokens.border }]}
              onPress={() => {
                triggerHaptic(ImpactFeedbackStyle.Medium);
                setTabStyle(opt.value);
              }}
              android_ripple={{ color: tokens.mist }}
            >
              <View style={styles.rowLeft}>
                <View style={styles.paletteInfo}>
                  <Text style={[styles.rowLabel, { color: tokens.textPrimary }]}>
                    {opt.label}
                  </Text>
                  <Text style={[styles.paletteDesc, { color: tokens.textHint }]}>
                    {opt.description}
                  </Text>
                </View>
              </View>
              {isSelected && <Check size={20} color={tokens.primary} />}
            </Pressable>
          );
        })}

        <SectionDivider style={{ marginVertical: 8 }} />

        {/* ----------------------------------------------------------------- */}
        {/* CONTA                                                             */}
        {/* ----------------------------------------------------------------- */}
        <SectionHeader title="CONTA" tokens={tokens} />

        <SettingsRow
          icon={Lock}
          iconColor={tokens.primary}
          label="Alterar senha"
          onPress={() => {}}
          tokens={tokens}
        />

        <SettingsRow
          icon={History}
          iconColor={tokens.primary}
          label="Histórico de buscas"
          onPress={() => {}}
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

  // -- Palette selector -----------------------------------------------------
  swatchRow: {
    flexDirection: 'row',
    gap: 4,
  },
  swatchCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
  },
  paletteInfo: {
    flex: 1,
  },
  paletteDesc: {
    fontSize: 12,
    marginTop: 1,
  },
});
