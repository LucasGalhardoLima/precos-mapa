import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Settings, ScanLine } from 'lucide-react-native';
import { colors, fontFamily, typography, spacing, targets, radii } from '../constants/tokens';
import { SearchField } from '../components/search-field';
import { ListRow } from '../components/list-row';
import { FilledButton } from '../components/filled-button';
import { TextLink } from '../components/text-link';
import { useLocation } from '../hooks/use-location';
import { useSearch, formatBRL } from '../hooks/use-search';
import { useTrackedSummary } from '../hooks/use-tracked-summary';
import { useMarketFreshness, MATAO_CHAIN_LABELS, MATAO_CHAIN_COUNT } from '../hooks/use-market-freshness';
import { useAnalytics } from '../hooks/use-analytics';
import { loadOnboarding, type OnboardingItem } from '../lib/onboarding';
import { computeTitlePhrase, type TitlePhrase } from '../lib/raiz';
import { searchFieldRef } from '../lib/search-focus';

const RAIZ_TETO = 4;
const RESULTADO_TETO_TECLADO = 5;
const RESULTADO_TETO_SEM_TECLADO = 8;

export default function RaizScreen() {
  const router = useRouter();
  const { trackScreen, trackSearch } = useAnalytics();
  const { latitude, longitude } = useLocation({ autoRequest: false });

  // Redirect guard: onboarding owns the mandatory-location step (decisão 9);
  // a device that never completed it has no business seeing Raiz yet. Read
  // fresh on every focus, not just mount, so finishing onboarding and coming
  // back doesn't show a stale "still onboarding" read.
  const [checkedOnboarding, setCheckedOnboarding] = useState(false);
  const [items, setItems] = useState<OnboardingItem[]>([]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      loadOnboarding().then((result) => {
        if (cancelled) return;
        if (!result) {
          router.replace('/onboarding');
          return;
        }
        setItems(result.items);
        setCheckedOnboarding(true);
      });
      return () => {
        cancelled = true;
      };
    }, [router]),
  );

  useEffect(() => {
    if (checkedOnboarding) trackScreen('raiz');
  }, [checkedOnboarding, trackScreen]);

  const [query, setQuery] = useState('');
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const resultadoActive = query.trim().length >= 2;

  const { rows: trackedRows, isLoading: trackedLoading } = useTrackedSummary(items, latitude, longitude);
  const freshCount = useMarketFreshness();

  const { results, isSearching, error: searchError, retry: retrySearch } = useSearch({
    query,
    userLat: latitude,
    userLng: longitude,
  });

  useEffect(() => {
    if (!resultadoActive || isSearching || searchError) return;
    trackSearch(
      query.trim(),
      results.length,
      results.map((r) => r.winnerStoreName).filter((s): s is string => !!s),
    );
    // Only re-fire when the result set itself changes, not on every
    // keystroke re-render — trackSearch/query/resultadoActive are stable
    // per search, results is the actual completion signal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results]);

  const cap = keyboardVisible ? RESULTADO_TETO_TECLADO : RESULTADO_TETO_SEM_TECLADO;
  const [expanded, setExpanded] = useState(false);
  const visibleResults = expanded ? results : results.slice(0, cap);
  const hasMore = !expanded && results.length > cap;

  const titlePhrase = useMemo(() => computeTitlePhrase(trackedRows), [trackedRows]);

  if (!checkedOnboarding) return null;

  return (
    <SafeAreaView style={styles.screen}>
      <Header router={router} />
      {resultadoActive ? (
        <>
          <SearchHeader
            query={query}
            onChangeText={setQuery}
            onFocus={() => setKeyboardVisible(true)}
            onBlur={() => setKeyboardVisible(false)}
            onScan={() => router.push('/scan')}
          />
          <ResultadoBody
            query={query}
            results={visibleResults}
            totalCount={results.length}
            isSearching={isSearching}
            hasMore={hasMore}
            onVerMais={() => setExpanded(true)}
            onProductPress={(id) => router.push(`/product/${id}`)}
            onBuscarSoPrimeira={() => setQuery(query.trim().split(/\s+/)[0] ?? '')}
            onScan={() => router.push('/scan')}
            onOffline={!!searchError}
            onRetry={retrySearch}
          />
        </>
      ) : (
        <>
          <SearchHeader
            query={query}
            onChangeText={setQuery}
            onFocus={() => setKeyboardVisible(true)}
            onBlur={() => setKeyboardVisible(false)}
            onScan={() => router.push('/scan')}
          />
          <RaizBody
            trackedRows={trackedRows}
            trackedLoading={trackedLoading}
            titlePhrase={titlePhrase}
            freshCount={freshCount}
            onProductPress={(id) => router.push(`/product/${id}`)}
            // "ver todos" para itens acompanhados: routes.md lists no
            // dedicated all-items screen — Ajustes (7a) already owns the
            // full teto+"ver todos" list for the same concept.
            onVerTodos={() => router.push('/settings')}
          />
        </>
      )}
    </SafeAreaView>
  );
}

function Header({ router }: { router: ReturnType<typeof useRouter> }) {
  return (
    <View style={styles.header}>
      <Text style={styles.wordmark}>poup</Text>
      <Pressable
        accessibilityLabel="Ajustes"
        accessibilityRole="button"
        onPress={() => router.push('/settings')}
        style={styles.settingsTarget}
      >
        <Settings size={22} color={colors.secondary} strokeWidth={2} />
      </Pressable>
    </View>
  );
}

function SearchHeader({
  query,
  onChangeText,
  onFocus,
  onBlur,
  onScan,
}: {
  query: string;
  onChangeText: (t: string) => void;
  onFocus: () => void;
  onBlur: () => void;
  onScan: () => void;
}) {
  return (
    <View style={styles.searchRow}>
      <View style={styles.searchFieldFlex}>
        <SearchField ref={searchFieldRef} value={query} onChangeText={onChangeText} onFocus={onFocus} onBlur={onBlur} />
      </View>
      <Pressable style={styles.scanButton} onPress={onScan} accessibilityRole="button">
        <ScanLine size={20} color="#fff" strokeWidth={2.2} />
        <Text style={styles.scanLabel}>Escanear</Text>
      </Pressable>
    </View>
  );
}

function RaizBody({
  trackedRows,
  trackedLoading,
  titlePhrase,
  freshCount,
  onProductPress,
  onVerTodos,
}: {
  trackedRows: ReturnType<typeof useTrackedSummary>['rows'];
  trackedLoading: boolean;
  titlePhrase: TitlePhrase | null;
  freshCount: number | null;
  onProductPress: (key: string) => void;
  onVerTodos: () => void;
}) {
  // Dia zero: no tracked items at all — a fact, not an empty list (nada de
  // convite, nada de bloco). Distinct from "still resolving prices"
  // (trackedLoading), which renders nothing rather than flash dia zero first.
  if (trackedRows.length === 0) {
    if (trackedLoading) return <View style={styles.body} />;
    return (
      <View style={styles.body}>
        <Text style={typography.phrase}>Preços de hoje nos {MATAO_CHAIN_COUNT} mercados de Matão</Text>
        <Text style={styles.diaZeroSub}>atualizados às 03:00 · {MATAO_CHAIN_LABELS.join(', ')}</Text>
      </View>
    );
  }

  const visible = trackedRows.slice(0, RAIZ_TETO);
  const hasMore = trackedRows.length > RAIZ_TETO;

  return (
    <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} keyboardShouldPersistTaps="handled">
      <View style={styles.titleBlock}>
        {titlePhrase ? (
          <Text style={typography.phrase}>
            Hoje o <Text style={styles.titleWinner}>{titlePhrase.winner}</Text> tem o menor preço em{' '}
            {titlePhrase.count} dos seus {titlePhrase.total} itens
          </Text>
        ) : (
          <Text style={typography.phrase}>Preços de hoje dos seus itens</Text>
        )}
        <Text style={styles.provenance}>
          preços de hoje, 03:00{freshCount != null ? ` · ${freshCount} de ${MATAO_CHAIN_COUNT} mercados` : ''}
        </Text>
      </View>

      <View style={styles.listBlock}>
        <View style={styles.listHeader}>
          <Text style={styles.blockLabel}>SEUS ITENS</Text>
          <Text style={styles.blockLabelRight}>menor preço de hoje</Text>
        </View>
        {visible.map((row) => (
          <ListRow
            key={row.key}
            title={row.size ? `${row.name} · ${row.size}` : row.name}
            subtitle={row.hasPriceToday ? `menor no ${row.winnerStoreName}` : 'sem preço hoje'}
            value={row.priceLabel}
            muted={!row.hasPriceToday}
            // A generic item whose category search hasn't resolved a
            // product yet has nowhere to navigate to — not tappable rather
            // than pushing a broken route.
            chevron={!!row.productId}
            chevronColor={colors.brand}
            onPress={row.productId ? () => onProductPress(row.productId!) : undefined}
          />
        ))}
        {hasMore && <TextLink label={`ver todos os ${trackedRows.length}`} onPress={onVerTodos} />}
      </View>
    </ScrollView>
  );
}

function ResultadoBody({
  query,
  results,
  totalCount,
  isSearching,
  hasMore,
  onVerMais,
  onProductPress,
  onBuscarSoPrimeira,
  onScan,
  onOffline,
  onRetry,
}: {
  query: string;
  results: ReturnType<typeof useSearch>['results'];
  totalCount: number;
  isSearching: boolean;
  hasMore: boolean;
  onVerMais: () => void;
  onProductPress: (id: string) => void;
  onBuscarSoPrimeira: () => void;
  onScan: () => void;
  onOffline: boolean;
  onRetry: () => void;
}) {
  if (onOffline) {
    return (
      <View style={styles.body}>
        <Text style={styles.stateHeadline}>Sem conexão</Text>
        <Text style={styles.stateSupport}>Não deu para buscar os preços de hoje. Verifique a rede e tente de novo.</Text>
        <View style={styles.stateActions}>
          <FilledButton label="Tentar de novo ›" onPress={onRetry} />
          <TextLink label="Ajustes de rede do aparelho" onPress={() => {}} />
        </View>
      </View>
    );
  }

  if (!isSearching && results.length === 0) {
    const firstWord = query.trim().split(/\s+/)[0] ?? query.trim();
    return (
      <View style={styles.body}>
        <Text style={[styles.stateHeadline, { color: colors.secondary }]}>Nenhum produto com &quot;{query.trim()}&quot;</Text>
        <Text style={styles.stateSupport}>nos {MATAO_CHAIN_COUNT} mercados de Matão hoje</Text>
        <View style={styles.stateActions}>
          <FilledButton label={`Buscar só "${firstWord}" ›`} onPress={onBuscarSoPrimeira} />
          <TextLink label="Escanear o código" onPress={onScan} />
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} keyboardShouldPersistTaps="handled">
      <View style={styles.listHeader}>
        <Text style={styles.blockLabel}>{totalCount} PRODUTOS</Text>
        <Text style={styles.blockLabelRight}>menor preço de hoje</Text>
      </View>
      <View style={styles.listBlock}>
        {results.map((r) => (
          <ListRow
            key={r.productId}
            title={r.name}
            subtitle={r.hasPriceToday ? (r.singleStore ? `só no ${r.winnerStoreName}` : `menor no ${r.winnerStoreName}`) : 'sem preço hoje'}
            imageUrl={r.imageUrl}
            value={r.hasPriceToday && r.price != null ? formatBRL(r.price) : '—'}
            muted={!r.hasPriceToday}
            chevron
            chevronColor={colors.brand}
            onPress={() => onProductPress(r.productId)}
          />
        ))}
        {hasMore && <TextLink label={`ver mais ${totalCount - results.length}`} onPress={onVerMais} />}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: targets.touch,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
  },
  wordmark: {
    ...typography.wordmark,
    color: colors.brandInk,
  },
  settingsTarget: {
    width: targets.touch,
    height: targets.touch,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -spacing.md,
  },
  searchRow: {
    flexDirection: 'row',
    gap: spacing.sm + 2,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
  },
  searchFieldFlex: {
    flex: 1,
    minWidth: 0,
  },
  scanButton: {
    height: targets.button,
    backgroundColor: colors.brandInk,
    borderRadius: radii.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg + 2,
  },
  scanLabel: {
    fontFamily: fontFamily.bold,
    fontSize: 16,
    color: '#fff',
  },
  body: {
    flex: 1,
    paddingHorizontal: spacing.xl,
  },
  bodyContent: {
    paddingBottom: spacing.xl,
    gap: spacing.xl - 2,
  },
  diaZeroSub: {
    ...typography.support,
    color: colors.secondary,
    marginTop: spacing.sm,
  },
  titleBlock: {
    gap: spacing.sm - 2,
  },
  titleWinner: {
    fontFamily: fontFamily.extrabold,
  },
  provenance: {
    ...typography.provenance,
    color: colors.secondary,
  },
  listBlock: {
    gap: spacing.sm,
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingHorizontal: 2,
  },
  blockLabel: {
    ...typography.label,
    color: colors.secondary,
  },
  blockLabelRight: {
    ...typography.support,
    color: colors.secondary,
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
