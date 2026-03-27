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
  Share as RNShare,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ChevronLeft,
  ChevronRight,
  Check,
  Bell,
  MapPin,
  ShoppingCart,
  Package,
  Share2,
  Zap,
} from 'lucide-react-native';

import { useTheme } from '@/theme/use-theme';
import { triggerNotification } from '@/hooks/use-haptics';
import { NotificationFeedbackType } from 'expo-haptics';
import * as Burnt from 'burnt';
import { useAlerts } from '@/hooks/use-alerts';
import { useShoppingList } from '@/hooks/use-shopping-list';
import { useSubscription } from '@/hooks/use-subscription';
import { useAuthStore } from '@poup/shared';
import { useLocation, calculateDistanceKm } from '@/hooks/use-location';
import { supabase } from '@/lib/supabase';
import { PriceChart } from '@/components/price-chart';
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
  const { isPlus } = useSubscription();

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

  // Derive list name for "Já na lista" display
  const listWithProduct = lists.find((list) =>
    list.items.some((item) => item.product_id === id),
  );
  const listName = listWithProduct?.name ?? 'Minha lista';

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

  const handleToggleAlert = useCallback(async (value: boolean) => {
    if (value) {
      await handleCreateAlert();
    } else {
      await handleDisableAlert();
    }
  }, [handleCreateAlert, handleDisableAlert]);

  const handleAddToList = useCallback(async () => {
    if (!id) return;

    const session = useAuthStore.getState().session;
    if (!session?.user) {
      Alert.alert(
        'Login necessário',
        'Faça login para adicionar produtos à sua lista.',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Entrar', onPress: () => router.push('/(tabs)/account') },
        ],
      );
      return;
    }

    setIsAddingToList(true);
    try {
      let listId: string | null = null;

      if (lists.length > 0) {
        listId = lists[0].id;
      } else {
        listId = await createList('Minha lista');
      }

      if (!listId) {
        Alert.alert('Erro', 'Não foi possível criar a lista.');
        return;
      }

      const cheapestStoreId = promotions.length > 0 ? promotions[0].store_id : undefined;
      await addItem(listId, id, 1, cheapestStoreId);
      triggerNotification(NotificationFeedbackType.Success);
      Burnt.toast({
        title: 'Adicionado à lista',
        preset: 'done',
        haptic: 'success',
      });
    } catch {
      Alert.alert('Erro', 'Não foi possível adicionar à lista.');
    } finally {
      setIsAddingToList(false);
    }
  }, [id, lists, addItem, createList, promotions, router]);

  const handleShare = useCallback(async () => {
    if (!product) return;

    const bestPrice = promotions.length > 0
      ? `R$ ${promotions[0].promo_price.toFixed(2).replace('.', ',')} no ${promotions[0].store.name}`
      : '';

    const message = bestPrice
      ? `${product.name} — ${bestPrice}`
      : product.name;

    try {
      await RNShare.share({ message });
    } catch {
      // User cancelled or share failed — no action needed
    }
  }, [product, promotions]);

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
          <Header tokens={tokens} router={router} onShare={handleShare} />
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
  // Derived values for alert card
  // ---------------------------------------------------------------------------

  const isAlertTriggered = !!existingAlert && promotions.length > 0;
  const bestPromoPrice = promotions.length > 0 ? promotions[0].promo_price : null;
  const bestOriginalPrice = promotions.length > 0 ? promotions[0].original_price : null;
  const alertDiscountPercent = bestPromoPrice && bestOriginalPrice
    ? Math.round((1 - bestPromoPrice / bestOriginalPrice) * 100)
    : 0;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <View style={[styles.screen, { backgroundColor: tokens.bg }]}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <Header tokens={tokens} router={router} onShare={handleShare} />

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Product header (compact: 48x48 icon + name + category + best price inline) */}
          <View style={styles.productHeader}>
            <View style={[styles.productImageWrap, { backgroundColor: tokens.mist }]}>
              <Package size={22} color={tokens.textHint} strokeWidth={1.2} />
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
              {promotions.length > 0 && (
                <>
                  <View style={styles.bestPriceRow}>
                    <Text style={styles.bestPriceLabel}>A partir de</Text>
                    <Text style={styles.bestPriceValue}>
                      R$ {promotions[0].promo_price.toFixed(2).replace('.', ',')}
                    </Text>
                  </View>
                  <Text style={styles.bestPriceStore}>
                    {promotions[0].store.name} · {
                      latitude && longitude
                        ? `${calculateDistanceKm(latitude, longitude, promotions[0].store.latitude, promotions[0].store.longitude)} km`
                        : ''
                    }
                  </Text>
                </>
              )}
            </View>
          </View>

          {/* "Já na lista" banner */}
          {isInList && (
            <View style={[styles.sectionPadding, { marginTop: 12 }]}>
              <View style={styles.inListBanner}>
                <Check size={16} color="#16A34A" strokeWidth={2.5} />
                <Text style={styles.inListBannerText}>
                  Já na lista "{listName}"
                </Text>
              </View>
            </View>
          )}

          {/* Store comparison (immediately after header / in-list bar) */}
          <View style={[styles.sectionPadding, { marginTop: 16 }]}>
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
                          backgroundColor: '#f0fdfa',
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
                            <Text style={styles.bestPriceBadgeText}>
                              {isPlus ? 'Menor em 30d' : 'Menor preço'}
                            </Text>
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

          {/* Price chart */}
          <View style={[styles.sectionPadding, { marginTop: 16 }]}>
            <PriceChart productId={product.id} productName={product.name} />
          </View>

          {/* Price alert card */}
          <View style={[styles.sectionPadding, { marginTop: 12 }]}>
            <View
              style={[
                styles.alertCard,
                {
                  backgroundColor: isAlertTriggered ? '#f0fdf4' : tokens.surface,
                  borderColor: isAlertTriggered ? '#bbf7d0' : tokens.border,
                },
              ]}
            >
              <View style={styles.alertCardHeader}>
                <View style={[
                  styles.alertIconWrap,
                  {
                    backgroundColor: isAlertTriggered
                      ? '#dcfce7'
                      : isPlus ? 'rgba(13,148,136,0.08)' : '#fef3c7',
                  },
                ]}>
                  {isAlertTriggered ? (
                    <Check size={18} color="#16A34A" strokeWidth={2.5} />
                  ) : (
                    <Bell size={18} color={isPlus ? '#0D9488' : '#F59E0B'} />
                  )}
                </View>
                <Text style={[
                  styles.alertCardTitle,
                  isAlertTriggered && { color: '#166534' },
                ]}>
                  {isAlertTriggered
                    ? 'Em promoção agora!'
                    : isPlus ? 'Alerta personalizado' : 'Alerta de promoção'}
                </Text>
                <Switch
                  value={!!existingAlert}
                  onValueChange={handleToggleAlert}
                  trackColor={{
                    false: tokens.border,
                    true: isAlertTriggered ? '#16A34A' : tokens.primary,
                  }}
                />
              </View>

              {existingAlert ? (
                <View>
                  <Text style={[styles.alertDescription, { color: tokens.textSecondary }]}>
                    {isAlertTriggered
                      ? 'Você será notificado quando este produto entrar em promoção'
                      : isPlus
                        ? 'Me avise quando o preço cair abaixo de:'
                        : 'Me avise quando este produto entrar em promoção'}
                  </Text>

                  {/* Plus threshold input (existing alert) */}
                  {isPlus && !isAlertTriggered && (
                    <View style={styles.plusInputRow}>
                      <View style={styles.plusInputGroup}>
                        <Text style={styles.plusInputPrefix}>R$</Text>
                        <TextInput
                          style={styles.plusInputField}
                          value={
                            existingAlert.target_price
                              ? existingAlert.target_price.toFixed(2).replace('.', ',')
                              : ''
                          }
                          editable={false}
                          placeholderTextColor={tokens.textHint}
                        />
                      </View>
                    </View>
                  )}

                  <View style={styles.alertStatusRow}>
                    <View style={[
                      styles.alertStatusDot,
                      { backgroundColor: isAlertTriggered ? '#16A34A' : tokens.primary },
                    ]} />
                    <Text style={[
                      styles.alertStatusText,
                      { color: isAlertTriggered ? '#16A34A' : tokens.primary },
                    ]}>
                      {isAlertTriggered
                        ? `Alerta disparado · R$ ${bestPromoPrice!.toFixed(2).replace('.', ',')} (-${alertDiscountPercent}%)`
                        : isPlus && existingAlert.target_price && bestPromoPrice
                          ? `Monitorando · Atual R$ ${bestPromoPrice.toFixed(2).replace('.', ',')} (falta R$ ${(bestPromoPrice - existingAlert.target_price).toFixed(2).replace('.', ',')})`
                          : bestPromoPrice
                            ? `Monitorando · R$ ${bestPromoPrice.toFixed(2).replace('.', ',')} atual`
                            : 'Monitorando'}
                    </Text>
                  </View>
                </View>
              ) : (
                <View>
                  <Text style={[styles.alertDescription, { color: tokens.textSecondary }]}>
                    {isPlus
                      ? 'Me avise quando o preço cair abaixo de:'
                      : 'Me avise quando este produto entrar em promoção'}
                  </Text>

                  {/* Plus threshold input (new alert) */}
                  {isPlus && (
                    <View style={styles.plusInputRow}>
                      <View style={[styles.plusInputGroup, { borderColor: '#5EEAD4' }]}>
                        <Text style={styles.plusInputPrefix}>R$</Text>
                        <TextInput
                          style={styles.plusInputField}
                          placeholder="Ex: 20,00"
                          placeholderTextColor={tokens.textHint}
                          value={targetPriceInput}
                          onChangeText={setTargetPriceInput}
                          keyboardType="decimal-pad"
                        />
                      </View>
                    </View>
                  )}
                </View>
              )}
            </View>
          </View>

          {/* Plus upsell card (free users only, no existing alert) */}
          {!isPlus && !existingAlert && (
            <Pressable
              style={[styles.sectionPadding, { marginTop: 12 }]}
              onPress={() => router.push('/(tabs)/account/subscription')}
            >
              <View style={styles.plusUpsell}>
                <View style={styles.plusUpsellIcon}>
                  <Zap size={14} color="#FFFFFF" />
                </View>
                <View style={styles.plusUpsellInfo}>
                  <Text style={styles.plusUpsellTitle}>Alerta com valor personalizado</Text>
                  <Text style={styles.plusUpsellDesc}>"Avise quando menor que R$ 6,00"</Text>
                </View>
                <ChevronRight size={16} color="#7C3AED" />
              </View>
            </Pressable>
          )}

          {/* Bottom spacer for fixed CTA */}
          <View style={{ height: 100 }} />
        </ScrollView>

        {/* Fixed bottom CTA */}
        <View style={[styles.bottomCta, { backgroundColor: tokens.bg }]}>
          <Pressable
            onPress={isInList ? undefined : handleAddToList}
            disabled={isAddingToList}
            style={[
              styles.addToListButton,
              { backgroundColor: isInList ? '#f1f5f9' : tokens.primary },
              isAddingToList && { opacity: 0.6 },
            ]}
          >
            {isAddingToList ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : isInList ? (
              <>
                <Check size={20} color="#64748B" strokeWidth={2.5} />
                <Text style={[styles.addToListText, { color: '#64748B' }]}>
                  Já na lista · {listName}
                </Text>
              </>
            ) : (
              <>
                <ShoppingCart size={20} color="#FFFFFF" />
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
  onShare,
}: {
  tokens: ReturnType<typeof useTheme>['tokens'];
  router: ReturnType<typeof useRouter>;
  onShare: () => void;
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

      <Pressable onPress={onShare} hitSlop={8}>
        <Share2 size={20} color={tokens.textHint} />
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

  // Product header (compact: 48x48 icon + name + best price inline)
  productHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  productImageWrap: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  productHeaderInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 17,
    fontWeight: '700',
    fontFamily: 'Poppins_700Bold',
    lineHeight: 22,
    color: '#1A1A2E',
  },
  productCategory: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },

  // Best price (inline in header)
  bestPriceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginTop: 6,
  },
  bestPriceLabel: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '500',
  },
  bestPriceValue: {
    fontSize: 22,
    fontWeight: '800',
    fontFamily: 'Poppins_700Bold',
    color: '#0D9488',
  },
  bestPriceStore: {
    fontSize: 11,
    fontWeight: '600',
    color: '#0D9488',
    marginTop: 2,
  },

  // "Já na lista" banner
  inListBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  inListBannerText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#166534',
  },

  // Section padding
  sectionPadding: {
    paddingHorizontal: 16,
  },

  // Alert card
  alertCard: {
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 14,
  },
  alertCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  alertIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertCardTitle: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: 'Inter_500Medium',
    color: '#1A1A2E',
    flex: 1,
  },
  alertDescription: {
    fontSize: 11,
    lineHeight: 16,
  },

  // Alert status row
  alertStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  alertStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  alertStatusText: {
    fontSize: 10,
    fontWeight: '600',
  },

  // Plus threshold input
  plusInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  plusInputGroup: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f8fffe',
    borderWidth: 1.5,
    borderColor: '#5EEAD4',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  plusInputPrefix: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1A1A2E',
  },
  plusInputField: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#0D9488',
    padding: 0,
  },

  // Plus upsell
  plusUpsell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#ddd6fe',
    padding: 12,
    // RN doesn't support linear-gradient natively; approximate with solid
    backgroundColor: '#f0ecfe',
  },
  plusUpsellIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#7C3AED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  plusUpsellInfo: {
    flex: 1,
  },
  plusUpsellTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#7C3AED',
  },
  plusUpsellDesc: {
    fontSize: 10,
    color: '#7C3AED',
    opacity: 0.65,
    marginTop: 1,
  },

  // Section header
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'Poppins_700Bold',
    color: '#1A1A2E',
  },
  sectionCount: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '500',
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
    borderRadius: 12,
    borderWidth: 1.5,
    padding: 12,
    gap: 12,
  },
  positionCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  positionCircleFirst: {
    backgroundColor: '#0D9488',
  },
  positionText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94A3B8',
  },
  positionTextFirst: {
    color: '#FFFFFF',
  },
  storeLogoCircle: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  storeLogoText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  storeInfo: {
    flex: 1,
  },
  storeName: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: 'Inter_500Medium',
  },
  storeMetaText: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 1,
  },
  storePriceCol: {
    alignItems: 'flex-end',
    gap: 3,
  },
  storePrice: {
    fontSize: 16,
    fontWeight: '800',
    fontFamily: 'Poppins_700Bold',
  },
  bestPriceBadge: {
    backgroundColor: '#dcfce7',
    borderRadius: 5,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  bestPriceBadgeText: {
    fontSize: 8,
    fontWeight: '700',
    color: '#166534',
  },
  discountBadge: {
    backgroundColor: '#fef3c7',
    borderRadius: 5,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  discountBadgeText: {
    fontSize: 8,
    fontWeight: '700',
    color: '#92400e',
  },

  // Fixed bottom CTA
  bottomCta: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: 28,
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
    fontSize: 14,
    fontWeight: '700',
  },
});
