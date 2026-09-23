import { useCallback, useEffect, useState } from 'react';
import { View, Text, Image, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { colors, fontFamily, typography, spacing, targets, radii } from '../../constants/tokens';
import { BackLink } from '../../components/back-link';
import { BlockLabel } from '../../components/block-label';
import { AmberBanner } from '../../components/amber-banner';
import { StoreRow } from '../../components/store-row';
import { StorePickerSheet } from '../../components/store-picker-sheet';
import { TextLink } from '../../components/text-link';
import { FilledButton } from '../../components/filled-button';
import { Provenance } from '../../components/provenance';
import { ListRow } from '../../components/list-row';
import { useLocation } from '../../hooks/use-location';
import { useProduct } from '../../hooks/use-product';
import { useStores } from '../../hooks/use-stores';
import { useTrackedItems } from '../../hooks/use-tracked-items';
import { useSizeAlternatives } from '../../hooks/use-size-alternatives';
import { useAnalytics } from '../../hooks/use-analytics';
import { triggerHaptic, triggerNotification } from '../../hooks/use-haptics';
import { formatBRL } from '../../hooks/use-search';
import { freshnessLabel, formatSize, resolveSizeAlternatives } from '../../lib/resposta';
import { getPreferredChain, setPreferredChain } from '../../lib/preferred-store';

const ONDE_TETO = 4;

export default function ProductScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { latitude, longitude } = useLocation({ autoRequest: false });
  const { trackScreen, trackProductView, trackListAdd, trackAlertCreated } = useAnalytics();

  const [preferredChain, setPreferredChainState] = useState<string | null>(null);
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      getPreferredChain().then((chain) => {
        if (!cancelled) setPreferredChainState(chain);
      });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const { view, product, isLoading, error, retry } = useProduct({ productId: id, userLat: latitude, userLng: longitude, preferredChain });
  const { stores: nearbyStores, isLoading: storesLoading } = useStores(latitude, longitude);
  const { trackProduct, isTracking } = useTrackedItems();
  const { candidates: sizeCandidates } = useSizeAlternatives(product);
  const [expanded, setExpanded] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);

  useEffect(() => {
    trackScreen('resposta');
  }, [trackScreen]);

  useEffect(() => {
    if (view) trackProductView(id, view.whereRows.map((r) => r.storeId));
    // Only re-fire when the resolved view itself changes, not on every
    // trackProductView identity change (same pattern as Raiz's trackSearch).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, id]);

  const handleSwap = useCallback(async (chainLabel: string) => {
    await setPreferredChain(chainLabel);
    setPreferredChainState(chainLabel);
    setPickerVisible(false);
  }, []);

  const handleAcompanhar = useCallback(async () => {
    if (isTracking || !view) return;
    triggerHaptic();
    const winnerStoreId = view.whereRows.find((r) => r.isWinner)?.storeId;
    const ok = await trackProduct({ productId: id, targetPrice: view.price });
    if (ok) {
      trackListAdd(id, winnerStoreId);
      trackAlertCreated(id, winnerStoreId);
      triggerNotification();
    }
  }, [isTracking, view, trackProduct, id, trackListAdd, trackAlertCreated]);

  if (isLoading || !view || !product) {
    // Reuses the exact offline pattern already shipped for Resultado
    // (mobile/app/index.tsx) — same underlying reality (a failed Supabase
    // read), not a new invented state.
    if (error) {
      return (
        <SafeAreaView style={styles.screen}>
          <Header onBack={() => router.back()} />
          <View style={styles.body}>
            <Text style={styles.stateHeadline}>Sem conexão</Text>
            <Text style={styles.stateSupport}>Não deu para buscar os preços de hoje. Verifique a rede e tente de novo.</Text>
            <View style={styles.stateActions}>
              <FilledButton label="Tentar de novo ›" onPress={retry} />
              <TextLink label="Ajustes de rede do aparelho" onPress={() => {}} />
            </View>
          </View>
        </SafeAreaView>
      );
    }
    return (
      <SafeAreaView style={styles.screen}>
        <Header onBack={() => router.back()} />
      </SafeAreaView>
    );
  }

  const visibleWhere = expanded ? view.whereRows : view.whereRows.slice(0, ONDE_TETO);
  const nameLine = product.sizeValue != null ? `${product.name} · ${formatSize(product.sizeValue, product.sizeUnit)}` : product.name;
  const qualTamanho = view.pricePerUnit ? resolveSizeAlternatives(product, view.pricePerUnit.value, sizeCandidates) : null;

  return (
    <SafeAreaView style={styles.screen}>
      <Header onBack={() => router.back()} />
      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
        <View style={styles.titleBlock}>
          {product.imageUrl ? <Image source={{ uri: product.imageUrl }} style={styles.photo} /> : null}
          <Text style={styles.nameLine}>{nameLine}</Text>
          <Text style={[styles.title, view.mode === 'no-price' && styles.titleMuted]}>
            {view.title}
            {view.price != null ? <Text style={styles.titlePrice}>: {formatBRL(view.price)}</Text> : null}
          </Text>
          {view.mode === 'comparison' && (view.pricePerUnit || view.comparison) ? (
            <Text style={styles.subphrase}>
              {view.pricePerUnit ? `${formatBRL(view.pricePerUnit.value)}/${view.pricePerUnit.unit}` : null}
              {view.pricePerUnit && view.comparison ? ' · ' : null}
              {view.comparison
                ? `${formatBRL(view.comparison.amount)} a menos que no ${view.comparison.storeName}${view.comparison.isHere ? ', onde você está' : ''}`
                : null}
            </Text>
          ) : null}
          {view.mode === 'no-price' ? (
            <Text style={styles.subphrase}>Nenhum dos 4 mercados atualizou este produto na rodada de hoje.</Text>
          ) : null}
        </View>

        <View style={styles.whereBlock}>
          {view.staleStores.map((s) => (
            <AmberBanner key={s.storeName}>{`${s.storeName}: preços de ${s.daysAgo} dias atrás`}</AmberBanner>
          ))}
          <BlockLabel>ONDE</BlockLabel>
          {visibleWhere.map((row) => (
            <StoreRow
              key={row.storeId}
              storeName={row.storeName}
              distanceKm={row.distanceKm}
              price={row.price}
              isWinner={row.isWinner}
              isHere={row.isHere}
              freshnessLabel={freshnessLabel(row.daysAgo)}
              muted={row.isStale}
              onSwap={() => setPickerVisible(true)}
            />
          ))}
          {!expanded && view.whereHasMore ? <TextLink label="ver todos os mercados" onPress={() => setExpanded(true)} /> : null}
          <TextLink label="acompanhar este item" onPress={handleAcompanhar} />
        </View>

        {qualTamanho && qualTamanho.kind !== 'none' ? (
          <View style={styles.whereBlock}>
            <BlockLabel>QUAL TAMANHO</BlockLabel>
            {qualTamanho.kind === 'current-best' ? (
              <ListRow title={qualTamanho.label} muted />
            ) : (
              qualTamanho.items.map((item) => (
                <ListRow
                  key={item.productId}
                  title={item.name}
                  subtitle={`${item.pricePerUnitLabel} · menor no ${item.storeName}`}
                  chevron
                  chevronColor={colors.brand}
                  onPress={() => router.push(`/product/${item.productId}`)}
                />
              ))
            )}
          </View>
        ) : null}

        <Provenance>{view.footerNote}</Provenance>
      </ScrollView>
      <StorePickerSheet visible={pickerVisible} stores={nearbyStores} isLoading={storesLoading} onClose={() => setPickerVisible(false)} onPick={handleSwap} />
    </SafeAreaView>
  );
}

function Header({ onBack }: { onBack: () => void }) {
  return (
    <View style={styles.header}>
      <BackLink onPress={onBack} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: spacing.md,
    height: targets.touch + spacing.sm,
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    paddingHorizontal: spacing.xl,
  },
  bodyContent: {
    paddingBottom: spacing.xl,
    gap: spacing.xl + 2,
  },
  titleBlock: {
    gap: spacing.sm,
  },
  photo: {
    width: 96,
    height: 96,
    borderRadius: radii.md,
    marginBottom: spacing.xs,
  },
  nameLine: {
    fontFamily: fontFamily.semibold,
    fontSize: 15,
    lineHeight: 19,
    color: colors.secondary,
  },
  title: {
    ...typography.title,
    color: colors.ink,
    lineHeight: 30,
    letterSpacing: -0.26,
  },
  titleMuted: {
    color: colors.secondary,
  },
  titlePrice: {
    fontFamily: fontFamily.extrabold,
  },
  subphrase: {
    ...typography.support,
    color: colors.secondary,
    lineHeight: 20,
  },
  whereBlock: {
    gap: spacing.sm,
  },
  stateHeadline: {
    fontFamily: fontFamily.bold,
    fontSize: 22,
    lineHeight: 26,
    letterSpacing: -0.22,
    color: colors.ink,
    marginTop: spacing.lg,
  },
  stateSupport: {
    ...typography.support,
    color: colors.secondary,
    marginTop: spacing.sm,
  },
  stateActions: {
    gap: spacing.md - 2,
    marginTop: spacing.lg + 2,
  },
});
