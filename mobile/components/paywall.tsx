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
import { X, Check, Minus, Sparkles } from 'lucide-react-native';
import { useSubscription } from '@/hooks/use-subscription';
import { useTheme } from '@/theme/use-theme';
import { DiscountBadge } from '@/components/themed/discount-badge';

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
const FALLBACK_ANNUAL_PRICE = 'R$ 6,90';
const FALLBACK_ANNUAL_TOTAL = 'R$ 82,80/ano';

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
  // Dynamic styles based on theme tokens
  // -----------------------------------------------------------------------

  const dynamicStyles = {
    container: {
      backgroundColor: tokens.dark,
      paddingTop: insets.top,
      paddingBottom: insets.bottom,
    } as const,
    closeButton: {
      backgroundColor: tokens.darkSurface,
    } as const,
    comparisonHeader: {
      borderBottomColor: 'rgba(255,255,255,0.1)',
    } as const,
    comparisonRow: {
      borderBottomColor: 'rgba(255,255,255,0.08)',
    } as const,
    pricingCardBase: {
      backgroundColor: tokens.darkSurface,
      borderColor: tokens.darkSurface,
    } as const,
    pricingCardSelected: {
      backgroundColor: tokens.darkSurface,
      borderColor: tokens.primary,
    } as const,
    ctaButton: {
      backgroundColor: tokens.primary,
    } as const,
  };

  // -----------------------------------------------------------------------
  // Render helpers
  // -----------------------------------------------------------------------

  function renderComparisonCell(value: string | null) {
    if (value === null) {
      return <Minus size={16} color={tokens.textHint} />;
    }
    if (value === '✓') {
      return <Check size={16} color={tokens.primary} />;
    }
    return <Text style={styles.cellText}>{value}</Text>;
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
      <View style={[styles.container, dynamicStyles.container]}>
        {/* Close button — top right */}
        <View style={styles.closeRow}>
          <Pressable
            onPress={onClose}
            style={[styles.closeButton, dynamicStyles.closeButton]}
            hitSlop={12}
          >
            <X size={20} color="#FFFFFF" />
          </Pressable>
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
            {/* Hero — savings number */}
            <View style={styles.heroSection}>
              <Sparkles size={24} color={tokens.goldBright} />
              <Text style={styles.savingsAmount}>R$ 120</Text>
              <Text style={styles.savingsSubtitle}>economizados por mês</Text>
            </View>

            {/* Branding */}
            <View style={styles.brandingSection}>
              <Text style={styles.brandingPlus}>
                {'+ '}
                <Text style={[styles.brandingPoup, { color: tokens.primary }]}>
                  POUP
                </Text>
                {' PLUS'}
              </Text>
              <Text style={styles.tagline}>
                Economize mais. Sem limites.
              </Text>
            </View>

            {/* Comparison table */}
            <View style={[styles.comparisonTable, { backgroundColor: tokens.darkSurface }]}>
              {/* Header */}
              <View
                style={[styles.comparisonHeaderRow, dynamicStyles.comparisonHeader]}
              >
                <Text style={styles.comparisonHeaderLabel} />
                <Text style={styles.comparisonHeaderValue}>Grátis</Text>
                <Text
                  style={[
                    styles.comparisonHeaderValue,
                    styles.comparisonHeaderPlus,
                    { color: tokens.primary },
                  ]}
                >
                  Plus
                </Text>
              </View>

              {/* Rows */}
              {COMPARISON_ROWS.map((row, index) => (
                <View
                  key={row.label}
                  style={[
                    styles.comparisonRowContainer,
                    index < COMPARISON_ROWS.length - 1 &&
                      dynamicStyles.comparisonRow,
                    index < COMPARISON_ROWS.length - 1 &&
                      styles.comparisonRowBorder,
                  ]}
                >
                  <Text style={styles.comparisonLabel}>{row.label}</Text>
                  <View style={styles.comparisonCell}>
                    {renderComparisonCell(row.free)}
                  </View>
                  <View style={styles.comparisonCell}>
                    {renderComparisonCell(row.plus)}
                  </View>
                </View>
              ))}
            </View>

            {/* Pricing cards */}
            <View style={styles.pricingRow}>
              {/* Monthly */}
              <Pressable
                style={[
                  styles.pricingCard,
                  selectedCycle === 'monthly'
                    ? dynamicStyles.pricingCardSelected
                    : dynamicStyles.pricingCardBase,
                ]}
                onPress={() => setSelectedCycle('monthly')}
              >
                <Text style={styles.pricingCycleLabel}>Mensal</Text>
                <Text style={styles.pricingPrice}>
                  {monthlyPackage?.product?.priceString ?? FALLBACK_MONTHLY_PRICE}
                </Text>
                <Text style={styles.pricingPeriod}>/mês</Text>
              </Pressable>

              {/* Annual */}
              <Pressable
                style={[
                  styles.pricingCard,
                  selectedCycle === 'annual'
                    ? dynamicStyles.pricingCardSelected
                    : dynamicStyles.pricingCardBase,
                ]}
                onPress={() => setSelectedCycle('annual')}
              >
                <View style={styles.badgeContainer}>
                  <DiscountBadge label="-30%" variant="discount" />
                </View>
                <Text style={styles.pricingCycleLabel}>Anual</Text>
                <Text style={styles.pricingPrice}>
                  {FALLBACK_ANNUAL_PRICE}
                </Text>
                <Text style={styles.pricingPeriod}>/mês</Text>
                <Text style={styles.pricingTotal}>{FALLBACK_ANNUAL_TOTAL}</Text>
              </Pressable>
            </View>

            {/* CTA */}
            <Pressable
              style={[
                styles.ctaButton,
                dynamicStyles.ctaButton,
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
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Static styles
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

  // Close button
  closeRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Scroll
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },

  // Hero
  heroSection: {
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 4,
  },
  savingsAmount: {
    fontSize: 52,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 8,
    letterSpacing: -1,
  },
  savingsSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 2,
  },

  // Branding
  brandingSection: {
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  brandingPlus: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 1.5,
  },
  brandingPoup: {
    fontWeight: '800',
  },
  tagline: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 6,
  },

  // Comparison table
  comparisonTable: {
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 4,
    marginBottom: 24,
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
    color: 'rgba(255,255,255,0.5)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  comparisonHeaderPlus: {
    fontWeight: '700',
  },
  comparisonRowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
  },
  comparisonRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  comparisonLabel: {
    flex: 1.4,
    fontSize: 14,
    color: 'rgba(255,255,255,0.85)',
  },
  comparisonCell: {
    flex: 0.8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellText: {
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '500',
    textAlign: 'center',
  },

  // Pricing cards
  pricingRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  pricingCard: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 2,
    paddingVertical: 20,
    paddingHorizontal: 12,
    alignItems: 'center',
    position: 'relative',
  },
  badgeContainer: {
    position: 'absolute',
    top: -10,
    right: -4,
  },
  pricingCycleLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 6,
  },
  pricingPrice: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  pricingPeriod: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 2,
  },
  pricingTotal: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    marginTop: 4,
  },

  // CTA
  ctaButton: {
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
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
    marginBottom: 8,
  },
  restoreText: {
    fontSize: 14,
    fontWeight: '500',
  },
});
