import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { X } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { colors, typography, spacing, fontFamily, radii, borderWidth, targets } from '../constants/tokens';
import { FilledButton } from '../components/filled-button';
import { TextLink } from '../components/text-link';
import { ListRow } from '../components/list-row';
import { SearchField } from '../components/search-field';
import { Chip } from '../components/chip';
import { BackLink } from '../components/back-link';
import { TextField } from '../components/text-field';
import { ProductSheet } from '../components/product-sheet';
import { PoupMark } from '../components/poup-mark';
import { useLocation } from '../hooks/use-location';
import { useCities } from '../hooks/use-cities';
import { useAnalytics } from '../hooks/use-analytics';
import { saveCityInterest } from '../lib/city-interest';
import {
  GENERIC_ITEMS,
  FALLBACK_COVERED_CITIES,
  isCovered,
  filterCities,
  ctaLabel,
  displayProductName,
  isValidEmail,
  saveOnboarding,
  type CoveredCity,
  type GenericItem,
  type OnboardingArea,
  type OnboardingItem,
  type PinnedProduct,
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
  const [pins, setPins] = useState<Record<string, PinnedProduct>>({});
  const [sheetItem, setSheetItem] = useState<GenericItem | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [emailNote, setEmailNote] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [leftEmail, setLeftEmail] = useState(false);

  const covered: readonly CoveredCity[] = cities.length > 0 ? cities : FALLBACK_COVERED_CITIES;

  // `track` changes identity when the resolved region does, so it stays in the
  // deps; the hook's own 2 s dedup absorbs the repeats.
  useEffect(() => {
    if (step === 'outside') {
      track('screen_viewed', { metadata: { screen: 'onboarding_outside', city: outsideCity } });
    } else {
      trackScreen(`onboarding_${step}`);
    }
  }, [step, outsideCity, track, trackScreen]);

  useEffect(() => {
    if (sheetOpen && sheetItem) {
      track('screen_viewed', { metadata: { screen: 'onboarding_item_type', item: sheetItem.label } });
    }
  }, [sheetOpen, sheetItem, track]);

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

  // Deselecting a chip also drops its pinned product (a pin only exists on a
  // selected item, so the same updater is a no-op when selecting).
  const toggle = useCallback((label: string) => {
    setSelected((s) => (s.includes(label) ? s.filter((x) => x !== label) : [...s, label]));
    setPins((p) => {
      if (!(label in p)) return p;
      const { [label]: _dropped, ...rest } = p;
      return rest;
    });
  }, []);

  const openSheet = useCallback((item: GenericItem) => {
    setSheetItem(item);
    setSheetOpen(true);
  }, []);

  const onPickProduct = useCallback(
    (product: PinnedProduct) => {
      if (sheetItem) setPins((p) => ({ ...p, [sheetItem.label]: product }));
      setSheetOpen(false);
    },
    [sheetItem],
  );

  // ✕ on an item-product: back to the generic item.
  const unpin = useCallback((label: string) => {
    setPins((p) => {
      const { [label]: _dropped, ...rest } = p;
      return rest;
    });
  }, []);

  // The e-mail is optional ("se quiser aviso"): empty just continues. A typed
  // one is saved first, and a failure stays on screen — never a silent "ok"
  // for an address we did not keep.
  const onContinueOutside = useCallback(async () => {
    if (saving) return;
    const address = email.trim();
    if (address.length > 0) {
      if (!isValidEmail(address)) {
        setEmailNote('Confira o e-mail.');
        return;
      }
      setSaving(true);
      const ok = await saveCityInterest(outsideCity, address);
      setSaving(false);
      if (!ok) {
        setEmailNote('Não conseguimos salvar agora. Tente de novo, ou apague o e-mail para seguir.');
        return;
      }
      setLeftEmail(true);
    }
    setEmailNote(null);
    setStep('items');
  }, [saving, email, outsideCity]);

  // "Buscar agora" skips the step: nothing chosen is kept.
  const finish = useCallback(
    async (skipped: boolean) => {
      const items: OnboardingItem[] = skipped
        ? []
        : GENERIC_ITEMS.filter((i) => selected.includes(i.label)).map((i) => ({ ...i, product: pins[i.label] ?? null }));
      await saveOnboarding({ items, area });
      track('onboarding_completed', {
        metadata: {
          items_count: items.length,
          pinned_count: items.filter((i) => i.product).length,
          area,
          skipped,
          left_email: leftEmail,
        },
      });
      router.replace('/');
    },
    [selected, pins, area, leftEmail, track, router],
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
              {selectedItems.map((item) => {
                const pinned = pins[item.label];
                if (pinned) {
                  return (
                    <View key={item.label} style={styles.selectedRow}>
                      <Pressable
                        onPress={() => unpin(item.label)}
                        accessibilityRole="button"
                        accessibilityLabel={`Voltar ${item.label} para genérico`}
                        style={styles.unpinTarget}
                      >
                        <X size={20} color={colors.absence} strokeWidth={2.2} />
                      </Pressable>
                      <Text style={[styles.selectedLabel, styles.flex]} numberOfLines={2}>
                        {displayProductName(pinned.name, pinned.size)}
                        {pinned.size ? <Text style={styles.selectedSize}> · {pinned.size}</Text> : null}
                      </Text>
                    </View>
                  );
                }
                return (
                  <View key={item.label} style={styles.selectedRow}>
                    <Text style={[styles.selectedLabel, styles.flex]}>
                      {item.label}
                      <Text style={styles.selectedSize}> · {item.size}</Text>
                    </Text>
                    <TextLink label="escolher tipo" onPress={() => openSheet(item)} />
                  </View>
                );
              })}
              <Text style={styles.note}>
                Genérico já basta: mostramos o menor do tamanho padrão. &quot;Escolher tipo&quot; fixa marca e tamanho.
              </Text>
            </View>
          ) : null}
        </ScrollView>
        <View style={styles.footer}>
          <FilledButton label={ctaLabel(selectedItems.length)} onPress={() => finish(false)} />
        </View>
        <ProductSheet visible={sheetOpen} item={sheetItem} onClose={() => setSheetOpen(false)} onPick={onPickProduct} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.headerWordmark}>
          <Text style={styles.wordmark}>poup</Text>
        </View>
        <ScrollView contentContainerStyle={styles.outsideBody} keyboardShouldPersistTaps="handled" bounces={false}>
          <Text style={styles.headline}>Ainda não estamos em {outsideCity}</Text>
          <Text style={styles.lead}>Hoje o Poup compara preços só em Matão.</Text>
          <View style={styles.emailBlock}>
            <TextField
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                setEmailNote(null);
              }}
              placeholder="seu e-mail, se quiser aviso"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="emailAddress"
              accessibilityLabel="E-mail"
            />
            <Text style={styles.consent}>Só para avisar quando chegarmos na sua cidade. Nada mais.</Text>
            {emailNote ? <Text style={styles.emailNote}>{emailNote}</Text> : null}
          </View>
        </ScrollView>
        <View style={styles.footer}>
          <FilledButton label="Ver preços de Matão mesmo assim ›" onPress={onContinueOutside} />
          <View style={styles.centered}>
            <TextLink label="Digitar outra cidade" onPress={() => setStep('city')} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
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
  // A scroll view that grows to fill and centers its content: with the
  // keyboard up (or a long error note) the content scrolls instead of
  // overflowing upward onto the wordmark.
  outsideBody: {
    flexGrow: 1,
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: '#fff',
    borderWidth,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
  },
  // Same 44 px target and -12 margin as ListRow's leading ✕, so the icon sits
  // 14 px from the row edge while the tap area stays 44.
  unpinTarget: {
    width: targets.touch,
    height: targets.touch,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -spacing.md,
  },
  emailBlock: {
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  consent: {
    ...typography.note,
    color: colors.secondary,
  },
  emailNote: {
    ...typography.note,
    fontFamily: fontFamily.semibold,
    color: colors.ink,
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
