import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Edit3, Plus } from 'lucide-react-native';

import { useTheme } from '@/theme/use-theme';
import { triggerHaptic } from '@/hooks/use-haptics';
import { useShoppingList } from '@/hooks/use-shopping-list';
import { useLocation } from '@/hooks/use-location';
import { useAuthStore } from '@poup/shared';
import { ListItem } from '@/components/themed/list-item';
import { CouponLine } from '@/components/themed/coupon-line';
import { ListSkeleton } from '@/components/skeleton/list-skeleton';
import { Paywall } from '@/components/paywall';
import {
  ListTemplateCard,
  LIST_TEMPLATES,
} from '@/components/list-template-card';
import { OptimizationSummary } from '@/components/optimization-summary';

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

  const handleOpenPaywall = useCallback(() => {
    setPaywallVisible(true);
  }, []);

  // Derived values
  const isFreeUser = profile?.b2c_plan === 'free';

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
          <ScrollView
            contentContainerStyle={[
              styles.emptyScroll,
              { paddingBottom: insets.bottom + 24 },
            ]}
            showsVerticalScrollIndicator={false}
          >
            {/* Icon */}
            <View style={styles.emptyIconWrap}>
              <Edit3 size={36} color="#0D9488" />
            </View>

            {/* Copy */}
            <Text style={styles.emptyTitle}>
              Monte sua lista de compras
            </Text>
            <Text style={styles.emptySubtitle}>
              Adicione itens e descubra onde comprar tudo pelo menor preço.
            </Text>

            {/* CTA */}
            <Pressable
              onPress={handleAddItem}
              style={styles.emptyButton}
            >
              <Plus size={16} color="#FFFFFF" />
              <Text style={styles.emptyButtonText}>Adicionar itens</Text>
            </Pressable>

            {/* Template cards */}
            <Text style={styles.templatesLabel}>Começar com um modelo</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.templatesScroll}
            >
              {LIST_TEMPLATES.map((template) => (
                <ListTemplateCard key={template.id} template={template} />
              ))}
            </ScrollView>
          </ScrollView>
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
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Header ── */}
          <View style={styles.headerRow}>
            <View>
              <Text style={[styles.headerTitle, { color: tokens.textPrimary }]}>
                Minha Lista
              </Text>
              <Text style={styles.headerCount}>
                {items.length} {items.length === 1 ? 'item' : 'itens'}
              </Text>
            </View>

            <Pressable
              onPress={handleAddItem}
              style={styles.addButton}
            >
              <Plus size={18} color="#FFFFFF" />
            </Pressable>
          </View>

          {/* ── Optimization summary ── */}
          {optimization && optimization.stores.length > 0 && (
            <OptimizationSummary
              stores={optimization.stores}
              totalCost={optimization.totalCost}
              estimatedSavings={optimization.estimatedSavings}
              itemCount={items.length}
            />
          )}

          {/* ── Item list ── */}
          <View
            style={[
              styles.itemsCard,
              { backgroundColor: tokens.surface, borderColor: tokens.border },
            ]}
          >
            {items.map((item) => {
              // Resolve cheapest price and store from optimization result
              let cheapestPrice: number | undefined;
              let cheapestStoreName: string | undefined;

              if (optimization) {
                for (const store of optimization.stores) {
                  const found = store.items.find(
                    (si) => si.productName === (item.product?.name ?? ''),
                  );
                  if (found) {
                    if (
                      cheapestPrice == null ||
                      found.price < cheapestPrice
                    ) {
                      cheapestPrice = found.price;
                      cheapestStoreName = store.storeName;
                    }
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
                    store_name: cheapestStoreName,
                  }}
                  onToggle={() => handleToggle(item.id, !item.is_checked)}
                  onRemove={() => handleRemove(item.id)}
                  isLocked={false}
                />
              );
            })}
          </View>

          {/* ── Plus upsell for free users ── */}
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
                  style={[styles.upsellTitle, { color: tokens.textPrimary }]}
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

  // ── Header ──────────────────────────────────────────────────────────────
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
  },
  headerCount: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  addButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#0D9488',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Items card ──────────────────────────────────────────────────────────
  itemsCard: {
    marginHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    marginBottom: 8,
    overflow: 'hidden',
  },

  // ── Empty state ─────────────────────────────────────────────────────────
  emptyScroll: {
    alignItems: 'center',
    paddingTop: 56,
    paddingHorizontal: 32,
  },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#CCFBF1',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#134E4A',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#0D9488',
    borderRadius: 10,
    paddingHorizontal: 24,
    paddingVertical: 13,
    marginTop: 24,
  },
  emptyButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },

  // ── Template cards ───────────────────────────────────────────────────────
  templatesLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 32,
    marginBottom: 12,
    alignSelf: 'flex-start',
  },
  templatesScroll: {
    gap: 10,
    paddingRight: 8,
  },

  // ── Upsell ───────────────────────────────────────────────────────────────
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
