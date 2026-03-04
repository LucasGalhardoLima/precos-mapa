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
import Animated from 'react-native-reanimated';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ChevronLeft,
  Bell,
  Plus,
  MapPin,
  ShoppingCart,
} from 'lucide-react-native';

import { useTheme } from '@/theme/use-theme';
import { triggerNotification } from '@/hooks/use-haptics';
import { NotificationFeedbackType } from 'expo-haptics';
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
      Alert.alert('Alerta criado', 'Você será notificado quando o preço cair.');
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
        await addItem(listId, id);
        triggerNotification(NotificationFeedbackType.Success);
        Alert.alert('Adicionado', 'Produto adicionado à lista de compras.');
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
          {/* Product image placeholder */}
          <Animated.View sharedTransitionTag={`product-card-${id}`}>
            <View
              style={[styles.imagePlaceholder, { backgroundColor: tokens.mist }]}
            >
              <Text
                style={[styles.imagePlaceholderText, { color: tokens.textHint }]}
              >
                Imagem ilustrativa
              </Text>
            </View>
          </Animated.View>

          {/* Product metadata */}
          <View style={styles.metadataSection}>
            <Text
              style={[styles.productName, { color: tokens.textPrimary }]}
              numberOfLines={2}
            >
              {product.name}
            </Text>

            {categoryName && (
              <Text
                style={[styles.categoryText, { color: tokens.textSecondary }]}
              >
                {categoryName}
              </Text>
            )}

            {product.brand && (
              <Text style={[styles.brandText, { color: tokens.textHint }]}>
                {product.brand}
              </Text>
            )}

            <View style={styles.referencePriceRow}>
              <Text
                style={[
                  styles.referencePriceLabel,
                  { color: tokens.textHint },
                ]}
              >
                Preço de referência:
              </Text>
              <Text
                style={[
                  styles.referencePriceValue,
                  { color: tokens.textPrimary },
                ]}
              >
                R$ {product.reference_price.toFixed(2)}
              </Text>
            </View>
          </View>

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
            <Text
              style={[styles.sectionTitle, { color: tokens.textPrimary }]}
            >
              Comparar mercados
            </Text>

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
                          borderColor: tokens.border,
                        },
                        index === 0 && {
                          borderColor: tokens.primary,
                          borderWidth: 2,
                        },
                      ]}
                    >
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
                          style={[
                            styles.storeName,
                            { color: tokens.textPrimary },
                          ]}
                          numberOfLines={1}
                        >
                          {promo.store.name}
                        </Text>
                        {distanceKm != null && (
                          <View style={styles.storeDistanceRow}>
                            <MapPin size={12} color={tokens.textHint} />
                            <Text
                              style={[
                                styles.storeDistance,
                                { color: tokens.textHint },
                              ]}
                            >
                              {distanceKm} km
                            </Text>
                          </View>
                        )}
                      </View>

                      {/* Price + badge */}
                      <View style={styles.storePriceCol}>
                        <Text
                          style={[
                            styles.storePrice,
                            {
                              color:
                                index === 0
                                  ? tokens.primary
                                  : tokens.textPrimary,
                            },
                          ]}
                        >
                          R$ {promo.promo_price.toFixed(2)}
                        </Text>
                        {isSignificantDiscount && (
                          <DiscountBadge
                            label={`-${discountPercent}%`}
                            variant="discount"
                          />
                        )}
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
            disabled={isAddingToList}
            style={[
              styles.addToListButton,
              { backgroundColor: tokens.primary },
              isAddingToList && { opacity: 0.6 },
            ]}
          >
            {isAddingToList ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Plus size={20} color="#FFFFFF" />
                <Text style={styles.addToListText}>
                  Adicionar à lista
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

  // Image placeholder
  imagePlaceholder: {
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imagePlaceholderText: {
    fontSize: 14,
    fontStyle: 'italic',
  },

  // Metadata
  metadataSection: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  productName: {
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 28,
  },
  categoryText: {
    fontSize: 14,
    marginTop: 4,
  },
  brandText: {
    fontSize: 13,
    marginTop: 2,
  },
  referencePriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  referencePriceLabel: {
    fontSize: 13,
  },
  referencePriceValue: {
    fontSize: 15,
    fontWeight: '600',
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

  // Section title
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
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
    borderWidth: 1,
    padding: 12,
    gap: 12,
  },
  storeLogoCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
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
  },
  storeDistanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 2,
  },
  storeDistance: {
    fontSize: 12,
  },
  storePriceCol: {
    alignItems: 'flex-end',
    gap: 4,
  },
  storePrice: {
    fontSize: 16,
    fontWeight: '700',
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
