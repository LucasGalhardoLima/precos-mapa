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
import { ClipboardList, Plus, ChevronLeft, Zap } from 'lucide-react-native';

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
  const [selectedListId, setSelectedListId] = useState<string | null>(null);

  // Selected list (or first list when drilling down)
  const list = selectedListId
    ? lists.find((l) => l.id === selectedListId) ?? null
    : lists[0] ?? null;
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
              <ClipboardList size={32} color="#0D9488" strokeWidth={1.5} />
            </View>

            {/* Copy */}
            <Text style={styles.emptyTitle}>
              Crie sua primeira lista
            </Text>
            <Text style={styles.emptySubtitle}>
              Monte sua lista de compras e descubra onde encontrar tudo mais barato
            </Text>

            {/* CTA */}
            <Pressable
              onPress={handleAddItem}
              style={styles.emptyButton}
            >
              <Plus size={18} color="#FFFFFF" strokeWidth={2} />
              <Text style={styles.emptyButtonText}>Nova lista</Text>
            </Pressable>

            {/* Suggested lists — vertical cards */}
            <View style={styles.suggestedSection}>
              <Text style={styles.suggestedTitle}>Listas sugeridas</Text>
              {LIST_TEMPLATES.map((template) => (
                <ListTemplateCard key={template.id} template={template} />
              ))}
            </View>
          </ScrollView>
        </SafeAreaView>
      </View>
    );
  }

  // ---------------------------------------------------------------------------
  // "Minhas Listas" overview (when lists exist but none is selected)
  // ---------------------------------------------------------------------------

  if (lists.length > 0 && !selectedListId) {
    const FREE_LIST_LIMIT = 3;
    const remaining = FREE_LIST_LIMIT - lists.length;

    return (
      <View style={[styles.screen, { backgroundColor: tokens.bg }]}>
        <SafeAreaView edges={['top']} style={styles.flex}>
          <ScrollView
            contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
            showsVerticalScrollIndicator={false}
          >
            {/* Title */}
            <View style={styles.overviewHeader}>
              <Text style={styles.overviewTitle}>Minhas Listas</Text>
              <Text style={styles.overviewSubtitle}>
                {lists.length} de {FREE_LIST_LIMIT} listas ·{' '}
                <Text style={{ color: '#0D9488', fontWeight: '600' }}>
                  {isFreeUser ? 'Plano Grátis' : 'Poup Plus'}
                </Text>
              </Text>
            </View>

            {/* List cards */}
            <View style={styles.overviewCards}>
              {lists.map((l) => {
                const total = l.items.length;
                const checked = l.items.filter((i) => i.is_checked).length;
                const pct = total > 0 ? Math.round((checked / total) * 100) : 0;

                return (
                  <Pressable
                    key={l.id}
                    onPress={() => setSelectedListId(l.id)}
                    style={({ pressed }) => [pressed && { opacity: 0.7 }]}
                  >
                    <View style={styles.overviewCard}>
                      <View style={styles.overviewCardTop}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.overviewCardName}>{l.name || 'Minha Lista'}</Text>
                          <Text style={styles.overviewCardMeta}>
                            {total} {total === 1 ? 'item' : 'itens'} · {checked} comprados
                          </Text>
                        </View>
                        <Text style={styles.overviewCardPrice}>R$ 89,42</Text>
                      </View>
                      <View style={styles.overviewProgressBg}>
                        <View style={[styles.overviewProgressFill, { width: `${pct}%` }]} />
                      </View>
                      <View style={styles.overviewCardBottom}>
                        <Text style={styles.overviewCardPct}>{pct}% comprado</Text>
                        <Text style={styles.overviewCardDate}>Atualizado hoje</Text>
                      </View>
                    </View>
                  </Pressable>
                );
              })}

              {/* "+ Nova lista" dashed card */}
              {isFreeUser && (
                <Pressable onPress={handleAddItem}>
                  <View style={styles.newListCard}>
                    <Text style={styles.newListText}>+ Nova lista</Text>
                    <Text style={styles.newListSub}>
                      {remaining > 0
                        ? `${remaining} lista${remaining !== 1 ? 's' : ''} restante${remaining !== 1 ? 's' : ''} no plano grátis`
                        : 'Limite atingido no plano grátis'}
                    </Text>
                  </View>
                </Pressable>
              )}

              {/* Plus upsell banner */}
              {isFreeUser && (
                <Pressable onPress={handleOpenPaywall}>
                  <View style={styles.plusBanner}>
                    <View style={styles.plusBannerIcon}>
                      <Zap size={18} color="#FFFFFF" />
                    </View>
                    <View style={styles.plusBannerInfo}>
                      <Text style={styles.plusBannerTitle}>Listas ilimitadas com Poup Plus</Text>
                      <Text style={styles.plusBannerDesc}>+ Histórico, alertas avançados e mais</Text>
                    </View>
                    <Text style={styles.plusBannerArrow}>›</Text>
                  </View>
                </Pressable>
              )}
            </View>
          </ScrollView>
        </SafeAreaView>

        <Paywall
          visible={paywallVisible}
          onClose={() => setPaywallVisible(false)}
        />
      </View>
    );
  }

  // ---------------------------------------------------------------------------
  // Main list view (detail)
  // ---------------------------------------------------------------------------

  return (
    <View style={[styles.screen, { backgroundColor: tokens.bg }]}>
      <SafeAreaView edges={['top']} style={styles.flex}>
        <ScrollView
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Header bar ── */}
          {selectedListId && (
            <View style={styles.listHeaderBar}>
              <Pressable
                onPress={() => setSelectedListId(null)}
                style={styles.listBack}
              >
                <ChevronLeft size={18} color="#0D9488" strokeWidth={2.5} />
                <Text style={styles.listBackText}>Minhas Listas</Text>
              </Pressable>
              <Pressable onPress={handleAddItem}>
                <Plus size={20} color="#94A3B8" />
              </Pressable>
            </View>
          )}

          {/* ── Title ── */}
          <View style={styles.headerRow}>
            <View>
              <Text style={[styles.headerTitle, { color: tokens.textPrimary }]}>
                {list?.name || 'Minha Lista'}
              </Text>
              <Text style={styles.headerCount}>
                {items.length} {items.length === 1 ? 'item' : 'itens'} · Atualizado hoje
              </Text>
            </View>
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

          {/* ── Item list (individual cards) ── */}
          <View style={styles.itemsList}>
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
                <View
                  key={item.id}
                  style={[
                    styles.itemCard,
                    { backgroundColor: tokens.surface },
                    item.is_checked && styles.itemCardChecked,
                  ]}
                >
                  <ListItem
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
                </View>
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
    fontFamily: 'Poppins_700Bold',
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

  // ── Items list (individual cards) ────────────────────────────────────────
  itemsList: {
    paddingHorizontal: 16,
  },
  itemCard: {
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#e8edf2',
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  itemCardChecked: {
    opacity: 0.55,
  },

  // ── Empty state ─────────────────────────────────────────────────────────
  emptyScroll: {
    alignItems: 'center',
    paddingTop: 40,
    paddingHorizontal: 30,
  },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(13,148,136,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    fontFamily: 'Poppins_700Bold',
    color: '#1A1A2E',
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 6,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#0D9488',
    borderRadius: 12,
    paddingHorizontal: 32,
    paddingVertical: 13,
    marginTop: 18,
  },
  emptyButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'Inter_500Medium',
  },

  // ── Suggested lists ────────────────────────────────────────────────────
  suggestedSection: {
    width: '100%',
    marginTop: 28,
  },
  suggestedTitle: {
    fontSize: 15,
    fontWeight: '700',
    fontFamily: 'Poppins_700Bold',
    color: '#1A1A2E',
    marginBottom: 10,
  },

  // ── List header bar (back + actions) ─────────────────────────────────────
  listHeaderBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  listBack: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  listBackText: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Inter_500Medium',
    color: '#0D9488',
  },

  // ── "Minhas Listas" overview ───────────────────────────────────────────
  overviewHeader: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 4,
  },
  overviewTitle: {
    fontSize: 20,
    fontWeight: '700',
    fontFamily: 'Poppins_700Bold',
    color: '#1A1A2E',
  },
  overviewSubtitle: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 4,
  },
  overviewCards: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  overviewCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#e8edf2',
    padding: 16,
    marginBottom: 10,
  },
  overviewCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  overviewCardName: {
    fontSize: 15,
    fontWeight: '700',
    fontFamily: 'Inter_500Medium',
    color: '#1A1A2E',
  },
  overviewCardMeta: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  overviewCardPrice: {
    fontSize: 16,
    fontWeight: '800',
    fontFamily: 'Poppins_700Bold',
    color: '#0D9488',
  },
  overviewProgressBg: {
    height: 4,
    backgroundColor: '#f1f5f9',
    borderRadius: 2,
    marginTop: 12,
  },
  overviewProgressFill: {
    height: 4,
    borderRadius: 2,
    backgroundColor: '#0D9488',
  },
  overviewCardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  overviewCardPct: {
    fontSize: 10,
    color: '#94A3B8',
  },
  overviewCardDate: {
    fontSize: 10,
    color: '#94A3B8',
  },
  newListCard: {
    borderRadius: 14,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#d1d5db',
    padding: 18,
    alignItems: 'center',
    marginBottom: 10,
  },
  newListText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#94A3B8',
  },
  newListSub: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 4,
  },
  plusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#f5f3ff',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#ddd6fe',
    padding: 14,
    marginBottom: 10,
  },
  plusBannerIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#7C3AED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  plusBannerInfo: {
    flex: 1,
  },
  plusBannerTitle: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: 'Inter_500Medium',
    color: '#7C3AED',
  },
  plusBannerDesc: {
    fontSize: 10,
    color: '#7C3AED',
    opacity: 0.7,
    marginTop: 2,
  },
  plusBannerArrow: {
    fontSize: 16,
    fontWeight: '700',
    color: '#7C3AED',
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
