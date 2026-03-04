import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Plus, ShoppingCart, MapPin } from 'lucide-react-native';

import { useTheme } from '@/theme/use-theme';
import { triggerHaptic } from '@/hooks/use-haptics';
import { useShoppingList } from '@/hooks/use-shopping-list';
import { useLocation } from '@/hooks/use-location';
import { useAuthStore } from '@precomapa/shared';
import { ListItem } from '@/components/themed/list-item';
import { CouponLine } from '@/components/themed/coupon-line';
import { ListSkeleton } from '@/components/skeleton/list-skeleton';
import { Paywall } from '@/components/paywall';
import { TAB_BAR_HEIGHT } from '@/components/floating-tab-bar';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format a number as Brazilian currency (R$ X,XX). */
function formatBRL(value: number): string {
  return `R$ ${value.toFixed(2).replace('.', ',')}`;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OptimizationResult {
  stores: {
    storeId: string;
    storeName: string;
    items: { productName: string; price: number; quantity: number }[];
    subtotal: number;
  }[];
  totalCost: number;
  estimatedSavings: number;
  mapsUrl: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ListScreen() {
  const { tokens } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { latitude, longitude } = useLocation();
  const profile = useAuthStore((s) => s.profile);

  const {
    lists,
    isLoading,
    toggleItem,
    removeItem,
    optimizeList,
  } = useShoppingList();

  // Local state
  const [optimization, setOptimization] = useState<OptimizationResult | null>(
    null,
  );
  const [paywallVisible, setPaywallVisible] = useState(false);

  // First list is the default
  const list = lists[0] ?? null;
  const items = list?.items ?? [];

  // Run optimization when list or location changes
  useEffect(() => {
    if (!list || items.length === 0) {
      setOptimization(null);
      return;
    }

    let cancelled = false;

    optimizeList(list.id, latitude, longitude).then((result) => {
      if (!cancelled) {
        setOptimization(result);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [list?.id, items.length, latitude, longitude, optimizeList]);

  // Handlers
  const handleAddItem = useCallback(() => {
    triggerHaptic();
    router.push('/search');
  }, [router]);

  const handleToggle = useCallback(
    (itemId: string, newChecked: boolean) => {
      toggleItem(itemId, newChecked);
    },
    [toggleItem],
  );

  const handleRemove = useCallback(
    (itemId: string) => {
      removeItem(itemId);
    },
    [removeItem],
  );

  const handleOpenRoute = useCallback(() => {
    if (optimization?.mapsUrl) {
      Linking.openURL(optimization.mapsUrl);
    }
  }, [optimization]);

  const handleOpenPaywall = useCallback(() => {
    setPaywallVisible(true);
  }, []);

  // Derived values
  const isFreeUser = profile?.b2c_plan === 'free';
  const storeCount = optimization?.stores.length ?? 0;
  const estimatedSavings = optimization?.estimatedSavings ?? 0;
  const hasMapsUrl = Boolean(optimization?.mapsUrl);

  // ---------------------------------------------------------------------------
  // Loading state
  // ---------------------------------------------------------------------------

  if (isLoading) {
    return (
      <View style={[styles.screen, { backgroundColor: tokens.bg }]}>
        <SafeAreaView edges={['top']} style={styles.flex}>
          <ListSkeleton />
        </SafeAreaView>
      </View>
    );
  }

  // ---------------------------------------------------------------------------
  // Empty state
  // ---------------------------------------------------------------------------

  if (items.length === 0) {
    return (
      <View style={[styles.screen, { backgroundColor: tokens.bg }]}>
        <SafeAreaView edges={['top']} style={styles.flex}>
          {/* Header */}
          <View style={styles.headerRow}>
            <Text style={[styles.headerTitle, { color: tokens.textPrimary }]}>
              Minha Lista
            </Text>
          </View>

          {/* Empty content */}
          <View style={styles.emptyContainer}>
            <ShoppingCart size={56} color={tokens.textHint} />
            <Text
              style={[
                styles.emptyTitle,
                { color: tokens.textPrimary, marginTop: 16 },
              ]}
            >
              Sua lista esta vazia
            </Text>
            <Text
              style={[
                styles.emptySubtitle,
                { color: tokens.textHint, marginTop: 6 },
              ]}
            >
              Adicione produtos para comparar precos
            </Text>
            <Pressable
              onPress={handleAddItem}
              style={[styles.emptyButton, { backgroundColor: tokens.primary }]}
            >
              <Plus size={18} color="#FFFFFF" />
              <Text style={styles.emptyButtonText}>Adicionar</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  // ---------------------------------------------------------------------------
  // Main list view
  // ---------------------------------------------------------------------------

  return (
    <View style={[styles.screen, { backgroundColor: tokens.bg }]}>
      <SafeAreaView edges={['top']} style={styles.flex}>
        <ScrollView
          contentContainerStyle={{
            paddingBottom: TAB_BAR_HEIGHT + insets.bottom,
          }}
          showsVerticalScrollIndicator={false}
        >
          {/* Header row */}
          <View style={styles.headerRow}>
            <Text style={[styles.headerTitle, { color: tokens.textPrimary }]}>
              Minha Lista
            </Text>
            <Pressable
              onPress={handleAddItem}
              style={[styles.addButton, { backgroundColor: tokens.primary }]}
            >
              <Text style={styles.addButtonText}>+ Item</Text>
            </Pressable>
          </View>

          {/* Economy savings card */}
          {optimization && (
            <View
              style={[styles.savingsCard, { backgroundColor: tokens.dark }]}
            >
              <Text style={styles.savingsAmount}>
                {formatBRL(estimatedSavings)}
              </Text>
              <Text style={styles.savingsLabel}>economia estimada</Text>

              <Text style={styles.savingsDetail}>
                {items.length} {items.length === 1 ? 'item' : 'itens'} ·{' '}
                {storeCount} {storeCount === 1 ? 'mercado' : 'mercados'}
              </Text>

              {hasMapsUrl && (
                <Pressable
                  onPress={handleOpenRoute}
                  style={styles.routeButton}
                >
                  <MapPin size={14} color="#FFFFFF" />
                  <Text style={styles.routeButtonText}>Ver rota</Text>
                </Pressable>
              )}
            </View>
          )}

          {/* Item list */}
          <View style={styles.itemsContainer}>
            {items.map((item) => {
              // Find cheapest price from optimization result
              let cheapestPrice: number | undefined;
              if (optimization) {
                for (const store of optimization.stores) {
                  const found = store.items.find(
                    (si) => si.productName === (item.product?.name ?? ''),
                  );
                  if (
                    found &&
                    (cheapestPrice == null || found.price < cheapestPrice)
                  ) {
                    cheapestPrice = found.price;
                  }
                }
              }

              return (
                <ListItem
                  key={item.id}
                  item={{
                    id: item.id,
                    product_name: item.product?.name ?? 'Produto',
                    quantity: item.quantity,
                    checked: item.is_checked,
                    price: cheapestPrice,
                  }}
                  onToggle={() => handleToggle(item.id, !item.is_checked)}
                  onRemove={() => handleRemove(item.id)}
                  isLocked={false}
                />
              );
            })}
          </View>

          {/* Plus upsell for free users */}
          {isFreeUser && (
            <View style={styles.upsellSection}>
              <CouponLine />

              <View
                style={[
                  styles.upsellCard,
                  {
                    backgroundColor: tokens.surface,
                    borderColor: tokens.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.upsellTitle,
                    { color: tokens.textPrimary },
                  ]}
                >
                  Assine Plus · listas ilimitadas
                </Text>
                <Pressable
                  onPress={handleOpenPaywall}
                  style={[
                    styles.upsellButton,
                    { backgroundColor: tokens.primary },
                  ]}
                >
                  <Text style={styles.upsellButtonText}>Ver planos</Text>
                </Pressable>
              </View>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>

      {/* Paywall modal */}
      <Paywall
        visible={paywallVisible}
        onClose={() => setPaywallVisible(false)}
      />
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
  flex: {
    flex: 1,
  },

  // Header
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  addButton: {
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },

  // Savings card
  savingsCard: {
    marginHorizontal: 16,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  savingsAmount: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '700',
  },
  savingsLabel: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    marginTop: 2,
  },
  savingsDetail: {
    color: '#FFFFFF',
    fontSize: 13,
    marginTop: 12,
  },
  routeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginTop: 14,
  },
  routeButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },

  // Items
  itemsContainer: {
    paddingHorizontal: 16,
  },

  // Empty state
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginTop: 24,
  },
  emptyButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },

  // Upsell
  upsellSection: {
    paddingHorizontal: 16,
    marginTop: 8,
  },
  upsellCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    alignItems: 'center',
    gap: 12,
  },
  upsellTitle: {
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
  upsellButton: {
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  upsellButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
