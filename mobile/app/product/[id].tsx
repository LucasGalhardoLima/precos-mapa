import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  StyleSheet,
  Alert,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ChevronLeft,
  Bell,
  MapPin,
  ShoppingCart,
  Package,
} from 'lucide-react-native';

import { useTheme } from '@/theme/use-theme';
import { triggerNotification } from '@/hooks/use-haptics';
import { NotificationFeedbackType } from 'expo-haptics';
import * as Burnt from 'burnt';
import { useAlerts } from '@/hooks/use-alerts';
import { useShoppingList } from '@/hooks/use-shopping-list';
import { useLocation, calculateDistanceKm } from '@/hooks/use-location';
import { supabase } from '@/lib/supabase';
import { PriceChart } from '@/components/price-chart';
import { SectionDivider } from '@/components/themed/section-divider';
import { DiscountBadge } from '@/components/themed/discount-badge';
import type { Product, Store } from '@/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PromotionWithStore {
  id: string;
  product_id: string;
  store_id: string;
  original_price: number;
  promo_price: number;
  end_date: string;
  store: Store;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { tokens } = useTheme();
  const { latitude, longitude } = useLocation();
  const { alerts, create: createAlert, disable: disableAlert } = useAlerts();
  const { lists, addItem, createList } = useShoppingList();

  // Product data
  const [product, setProduct] = useState<Product | null>(null);
  const [categoryName, setCategoryName] = useState<string | null>(null);
  const [isLoadingProduct, setIsLoadingProduct] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Store promotions for comparison
  const [promotions, setPromotions] = useState<PromotionWithStore[]>([]);
  const [isLoadingPromotions, setIsLoadingPromotions] = useState(true);

  // Alert state
  const [targetPriceInput, setTargetPriceInput] = useState('');
  const [isCreatingAlert, setIsCreatingAlert] = useState(false);

  // Shopping list state
  const [isAddingToList, setIsAddingToList] = useState(false);
  const isInList = lists.some((list) =>
    list.items.some((item) => item.product_id === id),
  );

  // Find existing alert for this product
  const existingAlert = alerts.find(
    (a) => a.product_id === id && a.is_active,
  );

  // ---------------------------------------------------------------------------
  // Fetch product
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!id) return;

    async function fetchProduct() {
      setIsLoadingProduct(true);

      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('id', id)
        .single();

      if (error || !data) {
        setNotFound(true);
        setIsLoadingProduct(false);
        return;
      }

      setProduct(data as Product);

      // Fetch category name
      if (data.category_id) {
        const { data: cat } = await supabase
          .from('categories')
          .select('name')
          .eq('id', data.category_id)
          .single();

        if (cat) setCategoryName(cat.name);
      }

      setIsLoadingProduct(false);
    }

    fetchProduct();
  }, [id]);

  // ---------------------------------------------------------------------------
  // Fetch promotions for store comparison
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!id) return;

    async function fetchPromotions() {
      setIsLoadingPromotions(true);

      const { data } = await supabase
        .from('promotions')
        .select('*, store:stores!inner(*)')
        .eq('product_id', id)
        .eq('status', 'active')
        .gt('end_date', new Date().toISOString())
        .order('promo_price', { ascending: true });

      if (data) setPromotions(data as unknown as PromotionWithStore[]);
      setIsLoadingPromotions(false);
    }

    fetchPromotions();
  }, [id]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleCreateAlert = useCallback(async () => {
    if (!id) return;

    setIsCreatingAlert(true);
    try {
      const targetPrice = targetPriceInput
        ? parseFloat(targetPriceInput.replace(',', '.'))
        : undefined;

      if (targetPrice !== undefined && isNaN(targetPrice)) {
        Alert.alert('Valor inválido', 'Informe um valor numérico válido.');
        setIsCreatingAlert(false);
        return;
      }

      await createAlert(id, targetPrice);
      triggerNotification(NotificationFeedbackType.Success);
      setTargetPriceInput('');
      Burnt.toast({
        title: 'Alerta criado',
        message: 'Você será notificado quando o preço cair.',
        preset: 'done',
        haptic: 'success',
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Erro ao criar alerta.';
      Alert.alert('Erro', message);
    } finally {
      setIsCreatingAlert(false);
    }
  }, [id, targetPriceInput, createAlert]);

  const handleDisableAlert = useCallback(async () => {
    if (!existingAlert) return;

    try {
      await disableAlert(existingAlert.id);
    } catch {
      Alert.alert('Erro', 'Não foi possível desativar o alerta.');
    }
  }, [existingAlert, disableAlert]);

  const handleAddToList = useCallback(async () => {
    if (!id) return;

    setIsAddingToList(true);
    try {
      let listId: string | null = null;

      if (lists.length > 0) {
        // Use the first (most recent) list
        listId = lists[0].id;
      } else {
        // Create a default list
        listId = await createList('Minha lista');
      }

      if (listId) {
        // Use the cheapest promotion's store as origin
        const cheapestStoreId = promotions.length > 0 ? promotions[0].store_id : undefined;
        await addItem(listId, id, 1, cheapestStoreId);
        triggerNotification(NotificationFeedbackType.Success);
        Burnt.toast({
          title: 'Adicionado à lista',
          preset: 'done',
          haptic: 'success',
        });
      }
    } catch {
      Alert.alert('Erro', 'Não foi possível adicionar à lista.');
    } finally {
      setIsAddingToList(false);
    }
  }, [id, lists, addItem, createList]);

  // ---------------------------------------------------------------------------
  // Loading state
  // ---------------------------------------------------------------------------

  if (isLoadingProduct) {
    return (
      <View style={[styles.screen, { backgroundColor: tokens.bg }]}>
        <SafeAreaView edges={['top']} style={styles.centered}>
          <ActivityIndicator size="large" color={tokens.primary} />
        </SafeAreaView>
      </View>
    );
  }

  // ---------------------------------------------------------------------------
  // Not found state
  // ---------------------------------------------------------------------------

  if (notFound || !product) {
    return (
      <View style={[styles.screen, { backgroundColor: tokens.bg }]}>
        <SafeAreaView edges={['top']} style={styles.safeArea}>
          <Header tokens={tokens} router={router} />
          <View style={styles.centered}>
            <Text style={[styles.notFoundTitle, { color: tokens.textPrimary }]}>
              Produto não encontrado
            </Text>
            <Text
              style={[styles.notFoundSubtitle, { color: tokens.textHint }]}
            >
              O produto que você procura não está disponível.
            </Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <View style={[styles.screen, { backgroundColor: tokens.bg }]}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <Header tokens={tokens} router={router} />

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Product header (matches mockup: image + name + category + best price) */}
          <View style={styles.productHeader}>
            <View style={[styles.productImageWrap, { backgroundColor: tokens.mist }]}>
              <Package size={32} color={tokens.textHint} strokeWidth={1.2} />
            </View>
            <View style={styles.productHeaderInfo}>
              <Text
                style={[styles.productName, { color: tokens.textPrimary }]}
                numberOfLines={2}
              >
                {product.name}
              </Text>
              {categoryName && (
                <Text style={styles.productCategory}>
                  {categoryName}{product.brand ? ` · ${product.brand}` : ''}
                </Text>
              )}
            </View>
          </View>

          {/* Best price callout */}
          {promotions.length > 0 && (
            <View style={styles.bestPriceSection}>
              <Text style={styles.bestPriceLabel}>A partir de</Text>
              <Text style={styles.bestPriceValue}>
                R$ {promotions[0].promo_price.toFixed(2).replace('.', ',')}
              </Text>
              <Text style={styles.bestPriceStore}>
                {promotions[0].store.name} · {
                  latitude && longitude
                    ? `${calculateDistanceKm(latitude, longitude, promotions[0].store.latitude, promotions[0].store.longitude)} km`
                    : ''
                }
              </Text>
            </View>
          )}

          <SectionDivider style={{ marginVertical: 16 }} />

          {/* Price chart */}
          <View style={styles.sectionPadding}>
            <PriceChart productId={product.id} productName={product.name} />
          </View>

          <SectionDivider style={{ marginVertical: 16 }} />

          {/* Price alert card */}
          <View style={styles.sectionPadding}>
            <View
              style={[
                styles.alertCard,
                {
                  backgroundColor: tokens.surface,
                  borderColor: tokens.border,
                },
              ]}
            >
              <View style={styles.alertCardHeader}>
                <Bell size={20} color={tokens.primary} />
                <Text
                  style={[
                    styles.alertCardTitle,
                    { color: tokens.textPrimary },
                  ]}
                >
                  Alerta de queda de preço
                </Text>
              </View>

              {existingAlert ? (
                <View style={styles.alertActiveRow}>
                  <View style={styles.alertActiveInfo}>
                    <Text
                      style={[
                        styles.alertActiveLabel,
                        { color: tokens.primary },
                      ]}
                    >
                      Alerta ativo
                    </Text>
                    {existingAlert.target_price && (
                      <Text
                        style={[
                          styles.alertActivePrice,
                          { color: tokens.textSecondary },
                        ]}
                      >
                        Alvo: R$ {existingAlert.target_price.toFixed(2)}
                      </Text>
                    )}
                  </View>
                  <Switch
                    value={true}
                    onValueChange={() => handleDisableAlert()}
                    trackColor={{
                      false: tokens.border,
                      true: tokens.primary,
                    }}
                  />
                </View>
              ) : (
                <>
                  <Text
                    style={[
                      styles.alertDescription,
                      { color: tokens.textSecondary },
                    ]}
                  >
                    Receba uma notificação quando o preço cair abaixo do valor
                    desejado.
                  </Text>

                  <View style={styles.alertInputRow}>
                    <Text
                      style={[
                        styles.alertCurrencyPrefix,
                        { color: tokens.textPrimary },
                      ]}
                    >
                      R$
                    </Text>
                    <TextInput
                      style={[
                        styles.alertInput,
                        {
                          color: tokens.textPrimary,
                          backgroundColor: tokens.bg,
                          borderColor: tokens.border,
                        },
                      ]}
                      placeholder="Ex: 5,99"
                      placeholderTextColor={tokens.textHint}
                      value={targetPriceInput}
                      onChangeText={setTargetPriceInput}
                      keyboardType="decimal-pad"
                    />
                  </View>

                  <Pressable
                    onPress={handleCreateAlert}
                    disabled={isCreatingAlert}
                    style={[
                      styles.alertButton,
                      { backgroundColor: tokens.primary },
                      isCreatingAlert && { opacity: 0.6 },
                    ]}
                  >
                    {isCreatingAlert ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={styles.alertButtonText}>Ativar alerta</Text>
                    )}
                  </Pressable>
                </>
              )}
            </View>
          </View>

          <SectionDivider style={{ marginVertical: 16 }} />

          {/* Store comparison */}
          <View style={styles.sectionPadding}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Comparar mercados</Text>
              <Text style={styles.sectionCount}>{promotions.length} mercados</Text>
            </View>

            {isLoadingPromotions ? (
              <View style={styles.promotionsLoading}>
                <ActivityIndicator size="small" color={tokens.primary} />
                <Text
                  style={[
                    styles.promotionsLoadingText,
                    { color: tokens.textHint },
                  ]}
                >
                  Carregando ofertas...
                </Text>
              </View>
            ) : promotions.length === 0 ? (
              <View style={styles.promotionsEmpty}>
                <ShoppingCart size={32} color={tokens.textHint} />
                <Text
                  style={[
                    styles.promotionsEmptyText,
                    { color: tokens.textHint },
                  ]}
                >
                  Nenhuma oferta ativa para este produto
                </Text>
              </View>
            ) : (
              <View style={styles.promotionsList}>
                {promotions.map((promo, index) => {
                  const distanceKm =
                    latitude && longitude
                      ? calculateDistanceKm(
                          latitude,
                          longitude,
                          promo.store.latitude,
                          promo.store.longitude,
                        )
                      : null;

                  const discountPercent = Math.round(
                    (1 - promo.promo_price / promo.original_price) * 100,
                  );
                  const isSignificantDiscount = discountPercent >= 10;

                  return (
                    <View
                      key={promo.id}
                      style={[
                        styles.storeRow,
                        {
                          backgroundColor: tokens.surface,
                          borderColor: '#e8edf2',
                        },
                        index === 0 && {
                          borderColor: '#0D9488',
                          borderWidth: 2,
                        },
                      ]}
                    >
                      {/* Position number */}
                      <View style={[styles.positionCircle, index === 0 && styles.positionCircleFirst]}>
                        <Text style={[styles.positionText, index === 0 && styles.positionTextFirst]}>
                          {index + 1}
                        </Text>
                      </View>

                      {/* Store logo initial */}
                      <View
                        style={[
                          styles.storeLogoCircle,
                          { backgroundColor: promo.store.logo_color || tokens.primary },
                        ]}
                      >
                        <Text style={styles.storeLogoText}>
                          {promo.store.logo_initial}
                        </Text>
                      </View>

                      {/* Store info */}
                      <View style={styles.storeInfo}>
                        <Text
                          style={[styles.storeName, { color: tokens.textPrimary }]}
                          numberOfLines={1}
                        >
                          {promo.store.name}
                        </Text>
                        <Text style={styles.storeMetaText}>
                          {distanceKm != null ? `${distanceKm} km` : ''} · Aberto
                        </Text>
                      </View>

                      {/* Price + badge */}
                      <View style={styles.storePriceCol}>
                        <Text
                          style={[
                            styles.storePrice,
                            { color: index === 0 ? '#0D9488' : tokens.textPrimary },
                          ]}
                        >
                          R$ {promo.promo_price.toFixed(2).replace('.', ',')}
                        </Text>
                        {index === 0 ? (
                          <View style={styles.bestPriceBadge}>
                            <Text style={styles.bestPriceBadgeText}>Menor preço</Text>
                          </View>
                        ) : isSignificantDiscount ? (
                          <View style={styles.discountBadge}>
                            <Text style={styles.discountBadgeText}>-{discountPercent}%</Text>
                          </View>
                        ) : null}
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>

          {/* Bottom spacer for fixed CTA */}
          <View style={{ height: 100 }} />
        </ScrollView>

        {/* Fixed bottom CTA */}
        <View
          style={[
            styles.bottomCta,
            {
              backgroundColor: tokens.bg,
              borderTopColor: tokens.border,
            },
          ]}
        >
          <Pressable
            onPress={handleAddToList}
            disabled={isAddingToList || isInList}
            style={[
              styles.addToListButton,
              { backgroundColor: isInList ? tokens.textHint : tokens.primary },
              isAddingToList && { opacity: 0.6 },
            ]}
          >
            {isAddingToList ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <ShoppingCart size={20} color="#FFFFFF" />
                <Text style={styles.addToListText}>
                  {isInList ? 'Já na lista' : 'Adicionar à lista'}
                </Text>
              </>
            )}
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Header sub-component
// ---------------------------------------------------------------------------

function Header({
  tokens,
  router,
}: {
  tokens: ReturnType<typeof useTheme>['tokens'];
  router: ReturnType<typeof useRouter>;
}) {
  return (
    <View
      style={[
        styles.header,
        { borderBottomColor: tokens.border },
      ]}
    >
      <Pressable
        onPress={() => router.back()}
        style={styles.headerBackButton}
        hitSlop={8}
      >
        <ChevronLeft size={22} color={tokens.textPrimary} />
        <Text style={[styles.headerBackText, { color: tokens.textPrimary }]}>
          Voltar
        </Text>
      </Pressable>

      <Pressable
        onPress={() => router.push('/(tabs)/alerts')}
        style={styles.headerAlertsLink}
        hitSlop={8}
      >
        <Text style={[styles.headerAlertsText, { color: tokens.primary }]}>
          Alertas
        </Text>
      </Pressable>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerBackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  headerBackText: {
    fontSize: 16,
    fontWeight: '500',
  },
  headerAlertsLink: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerAlertsText: {
    fontSize: 15,
    fontWeight: '600',
  },

  // Not found
  notFoundTitle: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  notFoundSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
  },

  // Scroll
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 16,
  },

  // Product header (inline image + name)
  productHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  productImageWrap: {
    width: 80,
    height: 80,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  productHeaderInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 20,
    fontWeight: '700',
    fontFamily: 'Poppins_700Bold',
    lineHeight: 26,
    color: '#1A1A2E',
  },
  productCategory: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 2,
  },

  // Best price callout
  bestPriceSection: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  bestPriceLabel: {
    fontSize: 13,
    color: '#94A3B8',
  },
  bestPriceValue: {
    fontSize: 28,
    fontWeight: '800',
    fontFamily: 'Poppins_700Bold',
    color: '#0D9488',
  },
  bestPriceStore: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0D9488',
    marginTop: 2,
  },

  // Section padding
  sectionPadding: {
    paddingHorizontal: 16,
  },

  // Alert card
  alertCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  alertCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  alertCardTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  alertDescription: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
  },
  alertInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  alertCurrencyPrefix: {
    fontSize: 16,
    fontWeight: '600',
  },
  alertInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  alertButton: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  alertActiveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  alertActiveInfo: {
    flex: 1,
  },
  alertActiveLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  alertActivePrice: {
    fontSize: 13,
    marginTop: 2,
  },

  // Section header
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    fontFamily: 'Poppins_700Bold',
    color: '#1A1A2E',
  },
  sectionCount: {
    fontSize: 12,
    color: '#94A3B8',
  },

  // Promotions / store comparison
  promotionsLoading: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 8,
  },
  promotionsLoadingText: {
    fontSize: 13,
  },
  promotionsEmpty: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 8,
  },
  promotionsEmptyText: {
    fontSize: 14,
    textAlign: 'center',
  },
  promotionsList: {
    gap: 8,
  },
  storeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 12,
    gap: 10,
    marginBottom: 8,
  },
  positionCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  positionCircleFirst: {
    backgroundColor: '#dcfce7',
  },
  positionText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
  },
  positionTextFirst: {
    color: '#166534',
  },
  storeLogoCircle: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  storeLogoText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  storeInfo: {
    flex: 1,
  },
  storeName: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Inter_500Medium',
  },
  storeMetaText: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  storePriceCol: {
    alignItems: 'flex-end',
    gap: 4,
  },
  storePrice: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'Poppins_700Bold',
  },
  bestPriceBadge: {
    backgroundColor: '#dcfce7',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  bestPriceBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#166534',
  },
  discountBadge: {
    backgroundColor: '#fef3c7',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  discountBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#92400e',
  },

  // Fixed bottom CTA
  bottomCta: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  addToListButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    paddingVertical: 14,
  },
  addToListText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
