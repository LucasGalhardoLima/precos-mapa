import { useEffect, useState } from 'react';
import { View, Text, Image, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { colors, fontFamily, typography, spacing, targets, radii } from '../../constants/tokens';
import { BackLink } from '../../components/back-link';
import { BlockLabel } from '../../components/block-label';
import { AmberBanner } from '../../components/amber-banner';
import { StoreRow } from '../../components/store-row';
import { TextLink } from '../../components/text-link';
import { FilledButton } from '../../components/filled-button';
import { Provenance } from '../../components/provenance';
import { useLocation } from '../../hooks/use-location';
import { useProduct } from '../../hooks/use-product';
import { useAnalytics } from '../../hooks/use-analytics';
import { formatBRL } from '../../hooks/use-search';
import { freshnessLabel } from '../../lib/resposta';

const ONDE_TETO = 4;

export default function ProductScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { latitude, longitude } = useLocation({ autoRequest: false });
  const { trackScreen, trackProductView } = useAnalytics();
  const { view, product, isLoading, error, retry } = useProduct({ productId: id, userLat: latitude, userLng: longitude });
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    trackScreen('resposta');
  }, [trackScreen]);

  useEffect(() => {
    if (view) trackProductView(id, view.whereRows.map((r) => r.storeId));
    // Only re-fire when the resolved view itself changes, not on every
    // trackProductView identity change (same pattern as Raiz's trackSearch).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, id]);

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
              // shortcut: "trocar" (pick a different home store than the
              // GPS-nearest one) has no picker built yet anywhere in the
              // app — same stub pattern already shipped for Resultado's
              // "Ajustes de rede do aparelho". Upgrade: build the store-
              // picker sheet mobile/CLAUDE.md's hook table promises for
              // use-stores.ts once that hook is rebuilt for the MLP (it's
              // currently pre-MLP dead code, see Etapa 5 investigation).
              onSwap={() => {}}
            />
          ))}
          {!expanded && view.whereHasMore ? <TextLink label="ver todos os mercados" onPress={() => setExpanded(true)} /> : null}
          {/* shortcut: signInAnonymously()/notificação/insert em tracked_items
              bloqueados até enable_anonymous_sign_ins ser ativado (pré-requisito
              combinado com o Lucas). Upgrade: trocar este stub pelo fluxo real
              assim que o toggle for confirmado. */}
          <TextLink label="acompanhar este item" onPress={() => {}} />
        </View>

        {/* QUAL TAMANHO deliberately not built yet — "bate por unidade" has
            no defined matching rule anywhere in the docs/artifact/schema
            (asked Lucas, no answer yet as of this commit). See lib/resposta.ts
            for what's already wired (pricePerUnit) and ready to plug in. */}

        <Provenance>{view.footerNote}</Provenance>
      </ScrollView>
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

function formatSize(value: number, unit: string | null): string {
  if (unit === 'g' && value >= 1000) return `${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)} kg`;
  if (unit === 'ml' && value >= 1000) return `${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)} L`;
  return `${value} ${unit ?? ''}`.trim();
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
