import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { colors, typography, spacing, fontFamily, radii, borderWidth } from '../constants/tokens';
import { FilledButton } from '../components/filled-button';
import { TextLink } from '../components/text-link';
import { ListRow } from '../components/list-row';
import { SearchField } from '../components/search-field';
import { Chip } from '../components/chip';
import { BackLink } from '../components/back-link';
import { PoupMark } from '../components/poup-mark';
import { useLocation } from '../hooks/use-location';
import { useCities } from '../hooks/use-cities';
import { useAnalytics } from '../hooks/use-analytics';
import {
  GENERIC_ITEMS,
  FALLBACK_COVERED_CITIES,
  isCovered,
  filterCities,
  ctaLabel,
  saveOnboarding,
  type CoveredCity,
  type OnboardingArea,
} from '../lib/onboarding';

// Onboarding: passo 1 localização → passo 2 itens, com "Fora de Matão" e a
// digitação de cidade como desvios do passo 1. Telas: artefato 7a (passo 1),
// 7b (passo 2), 7c (fora de Matão); "digitar minha cidade" não tem desenho no
// artefato e é montada só com os componentes do sistema.
// Permissão de localização só depois do toque em "Usar minha localização"
// (decisão 10); notificação e câmera nunca aparecem aqui.
type Step = 'location' | 'city' | 'items' | 'outside';

export default function Onboarding() {
  const router = useRouter();
  const { track, trackScreen } = useAnalytics();
  // autoRequest: false — the system dialog must only follow the tap below.
  const { requestPermission, city, hasResolvedLocation, setPreferredCity } = useLocation({ autoRequest: false });
  const { cities, isLoading: citiesLoading } = useCities();

  const [step, setStep] = useState<Step>('location');
  const [area, setArea] = useState<OnboardingArea>('covered');
  const [outsideCity, setOutsideCity] = useState('');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [attempt, setAttempt] = useState<'idle' | 'asking' | 'done'>('idle');
  const [granted, setGranted] = useState(false);

  const covered: readonly CoveredCity[] = cities.length > 0 ? cities : FALLBACK_COVERED_CITIES;

  // `track` is a no-op until the anonymous id has loaded and gets a new
  // identity when it does, so it stays in the deps: the first screen's event
  // would otherwise be dropped. The hook's own 2 s dedup absorbs the repeats.
  useEffect(() => {
    if (step === 'outside') {
      track('screen_viewed', { metadata: { screen: 'onboarding_outside', city: outsideCity } });
    } else {
      trackScreen(`onboarding_${step}`);
    }
  }, [step, outsideCity, track, trackScreen]);

  const onUseLocation = useCallback(async () => {
    if (attempt === 'asking') return;
    setAttempt('asking');
    setGranted(await requestPermission());
    setAttempt('done');
  }, [attempt, requestPermission]);

  // requestPermission() resolves only after the permission, position and
  // reverse geocode are all done, so `city`/`hasResolvedLocation` are final
  // here. Wait for use-cities too: judging coverage against a list that
  // hasn't loaded would call Matão "uncovered".
  useEffect(() => {
    if (attempt !== 'done' || citiesLoading) return;
    setAttempt('idle');
    if (!granted || !hasResolvedLocation) {
      // Denied, or granted but the geocode failed: "digitar minha cidade",
      // and the app goes on without "você está aqui" (decisão 10).
      setStep('city');
    } else if (isCovered(city, covered)) {
      setArea('covered');
      setStep('items');
    } else {
      setArea('outside');
      setOutsideCity(city);
      setStep('outside');
    }
  }, [attempt, granted, hasResolvedLocation, city, covered, citiesLoading]);

  const onChooseCity = useCallback(
    async (chosen: CoveredCity) => {
      await setPreferredCity(chosen.city, chosen.state);
      setArea('covered');
      setStep('items');
    },
    [setPreferredCity],
  );

  const onUseTypedCity = useCallback((name: string) => {
    setArea('outside');
    setOutsideCity(name);
    setStep('outside');
  }, []);

  const toggle = useCallback((label: string) => {
    setSelected((s) => (s.includes(label) ? s.filter((x) => x !== label) : [...s, label]));
  }, []);

  // "Buscar agora" skips the step: nothing chosen is kept.
  const finish = useCallback(
    async (skipped: boolean) => {
      const items = skipped ? [] : GENERIC_ITEMS.filter((i) => selected.includes(i.label));
      await saveOnboarding({ items, area });
      track('onboarding_completed', { metadata: { items_count: items.length, area, skipped } });
      router.replace('/');
    },
    [selected, area, track, router],
  );

  const matches = useMemo(() => filterCities(query, covered), [query, covered]);
  const selectedItems = GENERIC_ITEMS.filter((i) => selected.includes(i.label));

  if (step === 'location') {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.headerEmpty} />
        <View style={styles.locationBody}>
          <View style={styles.markArea}>
            <PoupMark width={200} />
          </View>
          <Text style={styles.headline}>O menor preço de hoje nos mercados perto de você</Text>
          <Text style={styles.lead}>
            Comparamos as 4 redes de Matão todo dia às 03:00. Para saber qual está mais perto, precisamos da sua
            localização.
          </Text>
        </View>
        <View style={styles.footer}>
          <FilledButton label="Usar minha localização ›" onPress={onUseLocation} />
          <View style={styles.centered}>
            <TextLink label="Digitar minha cidade" onPress={() => setStep('city')} />
          </View>
          <Text style={styles.footnote}>Só a cidade e o mercado mais perto. Sem cadastro.</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (step === 'city') {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.headerBack}>
          <BackLink onPress={() => setStep('location')} />
        </View>
        <ScrollView
          contentContainerStyle={styles.cityContent}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
        >
          <Text style={styles.headlineSm}>Qual é a sua cidade?</Text>
          <SearchField value={query} onChangeText={setQuery} placeholder="digite sua cidade" />
          <View style={styles.rows}>
            {matches.map((c) => (
              <ListRow key={`${c.city}|${c.state}`} title={`${c.city}, ${c.state}`} chevron onPress={() => onChooseCity(c)} />
            ))}
            {query.trim().length > 0 && matches.length === 0 ? (
              <ListRow
                title={query.trim()}
                subtitle="ainda não estamos aqui"
                chevron
                onPress={() => onUseTypedCity(query.trim())}
              />
            ) : null}
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (step === 'items') {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.headerSplit}>
          <Text style={styles.wordmark}>poup</Text>
          <TextLink label="Buscar agora" onPress={() => finish(true)} />
        </View>
        <ScrollView contentContainerStyle={styles.itemsContent}>
          <Text style={styles.headlineSm}>O que você compra sempre?</Text>
          <Text style={styles.leadSm}>Escolha alguns e a tela inicial mostra onde estão mais baratos hoje.</Text>
          <View style={styles.chips}>
            {GENERIC_ITEMS.map((item) => (
              <Chip
                key={item.label}
                label={item.label}
                selected={selected.includes(item.label)}
                onToggle={() => toggle(item.label)}
              />
            ))}
          </View>
          {selectedItems.length > 0 ? (
            <View style={styles.selectedBlock}>
              {selectedItems.map((item) => (
                <View key={item.label} style={styles.selectedRow}>
                  <Text style={styles.selectedLabel}>
                    {item.label}
                    <Text style={styles.selectedSize}> · {item.size}</Text>
                  </Text>
                </View>
              ))}
              <Text style={styles.note}>Genérico já basta: mostramos o menor do tamanho padrão.</Text>
            </View>
          ) : null}
        </ScrollView>
        <View style={styles.footer}>
          <FilledButton label={ctaLabel(selectedItems.length)} onPress={() => finish(false)} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.headerWordmark}>
        <Text style={styles.wordmark}>poup</Text>
      </View>
      <View style={styles.outsideBody}>
        <Text style={styles.headline}>Ainda não estamos em {outsideCity}</Text>
        <Text style={styles.lead}>Hoje o Poup compara preços só em Matão.</Text>
      </View>
      <View style={styles.footer}>
        <FilledButton label="Ver preços de Matão mesmo assim ›" onPress={() => setStep('items')} />
        <View style={styles.centered}>
          <TextLink label="Digitar outra cidade" onPress={() => setStep('city')} />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    alignItems: 'center',
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: spacing.md,
    paddingBottom: 14,
    gap: spacing.sm,
  },
  headline: {
    ...typography.headline,
    color: colors.ink,
  },
  headlineSm: {
    ...typography.headlineSm,
    color: colors.ink,
  },
  lead: {
    ...typography.lead,
    color: colors.secondary,
  },
  leadSm: {
    ...typography.leadSm,
    color: colors.secondary,
  },
  note: {
    ...typography.note,
    color: colors.secondary,
    paddingHorizontal: 2,
  },
  footnote: {
    ...typography.note,
    color: colors.secondary,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
  },
  wordmark: {
    ...typography.wordmark,
    color: colors.brandInk,
  },
  // Passo 1 carries the symbol, not the wordmark, so its header is just space.
  headerEmpty: {
    height: 52,
  },
  headerWordmark: {
    height: 52,
    paddingTop: spacing.sm,
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  headerSplit: {
    height: 52,
    paddingTop: spacing.sm,
    paddingLeft: 20,
    paddingRight: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerBack: {
    height: 52,
    paddingTop: spacing.xs,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
  },
  locationBody: {
    flex: 1,
    justifyContent: 'flex-end',
    gap: spacing.xl,
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  markArea: {
    height: 180,
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginBottom: spacing.sm,
  },
  outsideBody: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.xl,
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  cityContent: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: spacing.xl,
    gap: 14,
  },
  rows: {
    gap: spacing.sm,
  },
  itemsContent: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: spacing.md,
    gap: 14,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  selectedBlock: {
    gap: spacing.sm,
    marginTop: 6,
  },
  selectedRow: {
    minHeight: 56,
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderWidth,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
  },
  selectedLabel: {
    fontFamily: fontFamily.semibold,
    fontSize: 16,
    color: colors.ink,
  },
  selectedSize: {
    fontFamily: fontFamily.medium,
    color: colors.secondary,
  },
});
