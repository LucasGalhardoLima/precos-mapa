import { useState } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, Minus, Sparkles, TrendingDown, Star, ShieldCheck } from 'lucide-react-native';
import { useSubscription } from '@/hooks/use-subscription';
import { useTheme } from '@/theme/use-theme';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PaywallProps {
  visible: boolean;
  onClose: () => void;
}

type PlanCycle = 'monthly' | 'annual';

// ---------------------------------------------------------------------------
// Comparison table data
// ---------------------------------------------------------------------------

interface ComparisonRow {
  label: string;
  free: string | null; // null = dash (unavailable)
  plus: string | null; // null = dash, string = text, '✓' = check
}

const COMPARISON_ROWS: ComparisonRow[] = [
  { label: 'Comparar mercados', free: 'limitado', plus: 'Todos' },
  { label: 'Lista de compras', free: 'limitada', plus: 'Ilimitada' },
  { label: 'Histórico de preços', free: null, plus: '90 dias' },
  { label: 'Alertas de preço', free: null, plus: '✓' },
  { label: 'Análise de economia', free: null, plus: '✓' },
];

// ---------------------------------------------------------------------------
// Fallback pricing (shown when RevenueCat isn't loaded)
// ---------------------------------------------------------------------------

const FALLBACK_MONTHLY_PRICE = 'R$ 9,90';
const FALLBACK_ANNUAL_PRICE = 'R$ 7,90';
const FALLBACK_ANNUAL_TOTAL = 'R$ 94,90/ano';

// ---------------------------------------------------------------------------
// Highlights
// ---------------------------------------------------------------------------

const HIGHLIGHTS = [
  { icon: TrendingDown, text: 'Economize até R$ 120/mês' },
  { icon: Star, text: 'Favoritos e alertas ilimitados' },
  { icon: ShieldCheck, text: 'Sem anúncios, sem limites' },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function Paywall({ visible, onClose }: PaywallProps) {
  const insets = useSafeAreaInsets();
  const { tokens } = useTheme();
  const { offerings, purchasePackage, restore, isLoading } = useSubscription();

  const [selectedCycle, setSelectedCycle] = useState<PlanCycle>('annual');
  const [isPurchasing, setIsPurchasing] = useState(false);

  // -----------------------------------------------------------------------
  // Package resolution
  // -----------------------------------------------------------------------

  const monthlyPackage = offerings?.current?.availablePackages.find(
    (p) => p.identifier === 'plus_monthly' || p.identifier === '$rc_monthly',
  );
  const annualPackage = offerings?.current?.availablePackages.find(
    (p) => p.identifier === 'plus_annual' || p.identifier === '$rc_annual',
  );

  const selectedPackage =
    selectedCycle === 'monthly' ? monthlyPackage : annualPackage;

  // -----------------------------------------------------------------------
  // Handlers
  // -----------------------------------------------------------------------

  const handlePurchase = async () => {
    if (!selectedPackage) {
      Alert.alert('Indisponível', 'Assinatura não disponível no momento.');
      return;
    }
    setIsPurchasing(true);
    try {
      const success = await purchasePackage(selectedPackage);
      if (success) {
        onClose();
      }
    } finally {
      setIsPurchasing(false);
    }
  };

  const handleRestore = async () => {
    setIsPurchasing(true);
    try {
      await restore();
    } finally {
      setIsPurchasing(false);
    }
  };

  // -----------------------------------------------------------------------
  // Render helpers
  // -----------------------------------------------------------------------

  function renderComparisonCell(value: string | null, isPlus?: boolean) {
    if (value === null) {
      return <Minus size={16} color={tokens.textHint} />;
    }
    if (value === '✓') {
      return <Check size={18} color={tokens.primary} strokeWidth={3} />;
    }
    return (
      <Text
        style={[
          styles.cellText,
          { color: isPlus ? tokens.primary : tokens.textSecondary, fontWeight: isPlus ? '700' : '500' },
        ]}
      >
        {value}
      </Text>
    );
  }

  // -----------------------------------------------------------------------
  // Layout
  // -----------------------------------------------------------------------

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: tokens.bg, paddingBottom: insets.bottom }]}>
        {/* Drag handle */}
        <View style={styles.handleRow}>
          <View style={[styles.handle, { backgroundColor: tokens.textHint }]} />
        </View>

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={tokens.primary} />
          </View>
        ) : (
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            {/* Hero */}
            <View style={styles.heroSection}>
              <View style={[styles.iconCircle, { backgroundColor: tokens.primaryMuted }]}>
                <Sparkles size={28} color={tokens.primary} />
              </View>
              <Text style={[styles.heroTitle, { color: tokens.textPrimary }]}>
                Poup <Text style={{ color: tokens.primary }}>Plus</Text>
              </Text>
              <Text style={[styles.heroSubtitle, { color: tokens.textSecondary }]}>
                Economize mais. Sem limites.
              </Text>
            </View>

            {/* Highlights */}
            <View style={[styles.highlightsCard, { backgroundColor: tokens.surface, borderColor: tokens.border }]}>
              {HIGHLIGHTS.map(({ icon: Icon, text }) => (
                <View key={text} style={styles.highlightRow}>
                  <View style={[styles.highlightIcon, { backgroundColor: tokens.primaryMuted }]}>
                    <Icon size={16} color={tokens.primary} />
                  </View>
                  <Text style={[styles.highlightText, { color: tokens.textPrimary }]}>
                    {text}
                  </Text>
                </View>
              ))}
            </View>

            {/* Pricing cards */}
            <View style={styles.pricingRow}>
              {/* Monthly */}
              <Pressable
                style={[
                  styles.pricingCard,
                  {
                    backgroundColor: selectedCycle === 'monthly' ? tokens.surface : tokens.bg,
                    borderColor: selectedCycle === 'monthly' ? tokens.primary : tokens.border,
                    borderWidth: selectedCycle === 'monthly' ? 2 : 1,
                  },
                ]}
                onPress={() => setSelectedCycle('monthly')}
              >
                <Text style={[styles.pricingCycleLabel, { color: tokens.textSecondary }]}>
                  Mensal
                </Text>
                <Text style={[styles.pricingPrice, { color: tokens.textPrimary }]}>
                  {monthlyPackage?.product?.priceString ?? FALLBACK_MONTHLY_PRICE}
                </Text>
                <Text style={[styles.pricingPeriod, { color: tokens.textHint }]}>
                  /mês
                </Text>
              </Pressable>

              {/* Annual */}
              <Pressable
                style={[
                  styles.pricingCard,
                  {
                    backgroundColor: selectedCycle === 'annual' ? tokens.surface : tokens.bg,
                    borderColor: selectedCycle === 'annual' ? tokens.primary : tokens.border,
                    borderWidth: selectedCycle === 'annual' ? 2 : 1,
                  },
                ]}
                onPress={() => setSelectedCycle('annual')}
              >
                <View style={[styles.discountBadge, { backgroundColor: tokens.primaryMuted }]}>
                  <Text style={[styles.discountBadgeText, { color: tokens.primary }]}>
                    -20%
                  </Text>
                </View>
                <Text style={[styles.pricingCycleLabel, { color: tokens.textSecondary }]}>
                  Anual
                </Text>
                <Text style={[styles.pricingPrice, { color: tokens.textPrimary }]}>
                  {annualPackage?.product
                    ? `R$ ${(annualPackage.product.price / 12).toFixed(2).replace('.', ',')}`
                    : FALLBACK_ANNUAL_PRICE}
                </Text>
                <Text style={[styles.pricingPeriod, { color: tokens.textHint }]}>
                  /mês
                </Text>
                <Text style={[styles.pricingTotal, { color: tokens.textHint }]}>
                  {annualPackage?.product?.priceString
                    ? `${annualPackage.product.priceString}/ano`
                    : FALLBACK_ANNUAL_TOTAL}
                </Text>
              </Pressable>
            </View>

            {/* CTA */}
            <Pressable
              style={[
                styles.ctaButton,
                { backgroundColor: tokens.primary },
                isPurchasing && styles.ctaDisabled,
              ]}
              onPress={handlePurchase}
              disabled={isPurchasing}
            >
              {isPurchasing ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.ctaText}>
                  Experimentar 7 dias grátis
                </Text>
              )}
            </Pressable>

            {/* Restore */}
            <Pressable
              style={styles.restoreButton}
              onPress={handleRestore}
              disabled={isPurchasing}
            >
              <Text style={[styles.restoreText, { color: tokens.textHint }]}>
                Restaurar compras
              </Text>
            </Pressable>

            {/* Comparison table */}
            <View style={[styles.comparisonTable, { backgroundColor: tokens.surface, borderColor: tokens.border }]}>
              {/* Header */}
              <View style={[styles.comparisonHeaderRow, { borderBottomColor: tokens.border }]}>
                <Text style={styles.comparisonHeaderLabel} />
                <Text style={[styles.comparisonHeaderValue, { color: tokens.textHint }]}>
                  Grátis
                </Text>
                <Text style={[styles.comparisonHeaderValue, { color: tokens.primary, fontWeight: '700' }]}>
                  Plus
                </Text>
              </View>

              {/* Rows */}
              {COMPARISON_ROWS.map((row, index) => (
                <View
                  key={row.label}
                  style={[
                    styles.comparisonRowContainer,
                    index < COMPARISON_ROWS.length - 1 && {
                      borderBottomWidth: StyleSheet.hairlineWidth,
                      borderBottomColor: tokens.border,
                    },
                  ]}
                >
                  <Text style={[styles.comparisonLabel, { color: tokens.textPrimary }]}>
                    {row.label}
                  </Text>
                  <View style={styles.comparisonCell}>
                    {renderComparisonCell(row.free)}
                  </View>
                  <View style={styles.comparisonCell}>
                    {renderComparisonCell(row.plus, true)}
                  </View>
                </View>
              ))}
            </View>
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Drag handle
  handleRow: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 4,
  },
  handle: {
    width: 36,
    height: 5,
    borderRadius: 3,
    opacity: 0.3,
  },

  // Scroll
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 32,
  },

  // Hero
  heroSection: {
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  heroTitle: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  heroSubtitle: {
    fontSize: 15,
    marginTop: 6,
  },

  // Highlights card
  highlightsCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    gap: 14,
    marginBottom: 24,
  },
  highlightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  highlightIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  highlightText: {
    fontSize: 15,
    fontWeight: '500',
    flex: 1,
  },

  // Pricing cards
  pricingRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  pricingCard: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 20,
    paddingHorizontal: 12,
    alignItems: 'center',
    position: 'relative',
  },
  discountBadge: {
    position: 'absolute',
    top: -10,
    right: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  discountBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  pricingCycleLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
  },
  pricingPrice: {
    fontSize: 24,
    fontWeight: '800',
  },
  pricingPeriod: {
    fontSize: 13,
    marginTop: 2,
  },
  pricingTotal: {
    fontSize: 12,
    marginTop: 4,
  },

  // CTA
  ctaButton: {
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  ctaDisabled: {
    opacity: 0.7,
  },
  ctaText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Restore
  restoreButton: {
    alignItems: 'center',
    paddingVertical: 8,
    marginBottom: 24,
  },
  restoreText: {
    fontSize: 14,
    fontWeight: '500',
  },

  // Comparison table
  comparisonTable: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  comparisonHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  comparisonHeaderLabel: {
    flex: 1.4,
  },
  comparisonHeaderValue: {
    flex: 0.8,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  comparisonRowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
  },
  comparisonLabel: {
    flex: 1.4,
    fontSize: 14,
  },
  comparisonCell: {
    flex: 0.8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellText: {
    fontSize: 13,
    textAlign: 'center',
  },
});
