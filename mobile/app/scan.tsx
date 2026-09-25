import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Camera, useCameraDevice, useCameraPermission, useCodeScanner } from 'react-native-vision-camera';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing } from 'react-native-reanimated';
import { colors, fontFamily, typography, radii, spacing, targets, borderWidth, tabularNums } from '../constants/tokens';
import { FilledButton } from '../components/filled-button';
import { TextLink } from '../components/text-link';
import { Provenance } from '../components/provenance';
import { triggerNotification } from '../hooks/use-haptics';
import { useAnalytics } from '../hooks/use-analytics';
import { useMarketFreshness, MATAO_CHAIN_COUNT } from '../hooks/use-market-freshness';
import { useScanLookup } from '../hooks/use-scan-lookup';
import { shouldProcessScan, type ScanGateState } from '../lib/scan';
import { searchFieldRef } from '../lib/search-focus';

const FRAME_SIZE = 260;
const READ_PAUSE_MS = 300; // "moldura fecha em verde ~300 ms" before navigating

type Phase = 'checking' | 'denied' | 'scanning' | 'reading' | 'unknown';

// Scanner (Etapa 6, decisão 6a–6c / artefato seção 5). Permissão de câmera é
// pedida aqui — nunca antes — porque esta rota só é alcançada pelo toque em
// "Escanear" na Raiz (mobile/CLAUDE.md "Permissões com contexto"). Sem
// histórico de leituras: uma leitura vai direto para a Resposta ou vira o
// cartão "não achamos", nunca uma lista.
export default function ScanScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back');
  const { track } = useAnalytics();
  const { lookup } = useScanLookup();
  const freshCount = useMarketFreshness();

  const [phase, setPhaseState] = useState<Phase>('checking');
  const phaseRef = useRef<Phase>('checking');
  const setPhase = useCallback((p: Phase) => {
    phaseRef.current = p;
    setPhaseState(p);
  }, []);
  const [unknownEan, setUnknownEan] = useState<string | null>(null);
  const gateRef = useRef<ScanGateState>({ lastCode: null, lastReadAt: null });

  useEffect(() => {
    track('scan_opened');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let granted = hasPermission;
      if (!granted) granted = await requestPermission();
      if (cancelled) return;
      if (!granted) {
        track('scan_permission_denied');
        setPhase('denied');
        return;
      }
      setPhase('scanning');
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Back from Ajustes with the camera now granted. The vision-camera hook
  // refreshes `hasPermission` on every app-state change, but the effect above
  // reads it once, at mount. iOS usually kills the app when a permission
  // changes in Ajustes (it then relaunches cold and never gets here), but when
  // the process survives this reopens the camera instead of leaving the screen
  // on "Sem acesso à câmera".
  useEffect(() => {
    if (phase === 'denied' && hasPermission) setPhase('scanning');
  }, [phase, hasPermission, setPhase]);

  const goToSearch = useCallback(() => {
    router.back();
    // Lets the pop transition start before focusing — see lib/search-focus.ts.
    requestAnimationFrame(() => searchFieldRef.current?.focus());
  }, [router]);

  const handleReadAnother = useCallback(() => {
    gateRef.current = { lastCode: null, lastReadAt: null };
    setUnknownEan(null);
    setPhase('scanning');
  }, [setPhase]);

  const handleCode = useCallback(
    async (code: string) => {
      if (phaseRef.current !== 'scanning') return;
      const now = Date.now();
      if (!shouldProcessScan(code, gateRef.current, now)) return;
      gateRef.current = { lastCode: code, lastReadAt: now };

      setPhase('reading');
      triggerNotification();

      const result = await lookup(code);
      track('scan_read', { productId: result.status === 'hit' ? result.productId : undefined, metadata: { ean: code, result: result.status } });

      if (result.status === 'hit') {
        setTimeout(() => router.replace(`/product/${result.productId}`), READ_PAUSE_MS);
      } else {
        track('scan_unknown_ean', { metadata: { ean: code } });
        setTimeout(() => {
          setUnknownEan(code);
          setPhase('unknown');
        }, READ_PAUSE_MS);
      }
    },
    [lookup, router, track, setPhase],
  );

  const codeScanner = useCodeScanner({
    codeTypes: ['ean-13', 'ean-8'],
    onCodeScanned: (codes) => {
      const value = codes[0]?.value;
      if (value) handleCode(value);
    },
  });

  if (phase === 'denied') {
    return <DeniedState onBuscar={goToSearch} onSettings={() => Linking.openSettings()} />;
  }

  const frameState = phase === 'reading' ? 'success' : phase === 'unknown' ? 'muted' : 'idle';
  const showCameraLayer = !!device && phase !== 'checking';

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      {showCameraLayer && (
        <Camera style={StyleSheet.absoluteFill} device={device!} isActive codeScanner={codeScanner} />
      )}
      {/* shortcut: no `device` (always true in the iOS Simulator, which has
          no camera hardware) falls back to the plain dark surface below with
          no feed — this is the only case not named by the artifact's 5a/5b/5c
          states. Upgrade: none needed — every real iPhone has a back camera. */}
      <View style={styles.scrim} pointerEvents="none" />

      <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Fechar" hitSlop={8} style={styles.closeTarget}>
          <Text style={styles.closeLabel}>fechar</Text>
        </Pressable>
      </View>

      <View style={styles.center}>
        <ScanFrame state={frameState} />
        {phase !== 'unknown' && <Text style={styles.instruction}>Aponte para o código de barras</Text>}
      </View>

      {phase !== 'unknown' ? (
        <View style={[styles.bottomLinks, { paddingBottom: Math.max(insets.bottom, spacing.xl) }]}>
          <TextLink label="Digitar o nome em vez disso" color={colors.brand} onPress={goToSearch} />
        </View>
      ) : (
        unknownEan && (
          <View style={[styles.cardWrap, { paddingBottom: Math.max(insets.bottom, spacing.xl) }]}>
            <UnknownCard ean={unknownEan} freshCount={freshCount} onBuscar={goToSearch} onLerOutro={handleReadAnother} />
          </View>
        )
      )}
    </View>
  );
}

function ScanFrame({ state }: { state: 'idle' | 'success' | 'muted' }) {
  const translateY = useSharedValue(0);

  useEffect(() => {
    if (state !== 'idle') return;
    translateY.value = 0;
    translateY.value = withRepeat(withTiming(FRAME_SIZE - 20, { duration: 1600, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [state, translateY]);

  const laserStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const cornerColor = state === 'muted' ? colors.absence : colors.brand;

  return (
    <View style={styles.frame}>
      <View style={[styles.corner, styles.cornerTL, { borderColor: cornerColor }]} />
      <View style={[styles.corner, styles.cornerTR, { borderColor: cornerColor }]} />
      <View style={[styles.corner, styles.cornerBL, { borderColor: cornerColor }]} />
      <View style={[styles.corner, styles.cornerBR, { borderColor: cornerColor }]} />
      {state === 'idle' && <Animated.View style={[styles.laser, laserStyle]} />}
      {state === 'success' && <View style={styles.frameClosed} />}
    </View>
  );
}

function DeniedState({ onBuscar, onSettings }: { onBuscar: () => void; onSettings: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.deniedScreen, { paddingTop: insets.top + spacing.xl, paddingBottom: Math.max(insets.bottom, spacing.xl) }]}>
      {/* Ausência em cinza, sem ícone — mesmo tratamento do "Nenhum produto
          com ..." em app/index.tsx: um fato, não um erro visual. */}
      <Text style={styles.deniedHeadline}>Sem acesso à câmera</Text>
      <View style={styles.stateActions}>
        <FilledButton label="Buscar pelo nome ›" onPress={onBuscar} />
        <TextLink label="Abrir Ajustes do aparelho" onPress={onSettings} />
      </View>
    </View>
  );
}

function UnknownCard({
  ean,
  freshCount,
  onBuscar,
  onLerOutro,
}: {
  ean: string;
  freshCount: number | null;
  onBuscar: () => void;
  onLerOutro: () => void;
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Não achamos esse produto</Text>
      <Text style={styles.cardEan}>{ean}</Text>
      <View style={styles.cardProvenance}>
        <Provenance>{`preços de hoje, 03:00${freshCount != null ? ` · ${freshCount} de ${MATAO_CHAIN_COUNT} mercados` : ''}`}</Provenance>
      </View>
      <View style={styles.stateActions}>
        <FilledButton label="Buscar pelo nome ›" onPress={onBuscar} />
        <TextLink label="Ler outro código" onPress={onLerOutro} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.ink, // superfície escura — só o scanner (CLAUDE.md)
  },
  scrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.ink,
    opacity: 0.25,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.xl,
  },
  closeTarget: {
    height: targets.touch,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    marginRight: -spacing.sm,
  },
  closeLabel: {
    fontFamily: fontFamily.semibold,
    fontSize: 16,
    color: '#fff',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xl,
  },
  instruction: {
    ...typography.phrase,
    color: '#fff',
    textAlign: 'center',
  },
  frame: {
    width: FRAME_SIZE,
    height: FRAME_SIZE,
  },
  corner: {
    position: 'absolute',
    width: 32,
    height: 32,
  },
  cornerTL: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 8 },
  cornerTR: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 8 },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 8 },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 8 },
  laser: {
    position: 'absolute',
    left: 10,
    right: 10,
    top: 0,
    height: 2,
    backgroundColor: colors.laser,
    borderRadius: 1,
  },
  frameClosed: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderWidth: 3,
    borderColor: colors.brand,
    borderRadius: 8,
  },
  bottomLinks: {
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  deniedScreen: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.xl,
    justifyContent: 'center',
  },
  deniedHeadline: {
    fontFamily: fontFamily.bold,
    fontSize: 22,
    lineHeight: 26,
    letterSpacing: -0.22,
    color: colors.secondary,
  },
  stateActions: {
    gap: spacing.md - 2,
    marginTop: spacing.lg + 2,
  },
  cardWrap: {
    paddingHorizontal: spacing.xl,
  },
  card: {
    backgroundColor: '#fff',
    borderWidth,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.xl,
  },
  cardTitle: {
    ...typography.phrase,
    color: colors.ink,
  },
  cardEan: {
    fontFamily: fontFamily.bold,
    fontSize: 16,
    color: colors.secondary,
    marginTop: spacing.sm,
    ...tabularNums,
  },
  cardProvenance: {
    marginTop: spacing.sm,
  },
});
