import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Camera, useCameraDevice, useCameraPermission, useCodeScanner } from 'react-native-vision-camera';
import { X, CameraOff, CircleCheckBig, TriangleAlert } from 'lucide-react-native';
import { getAnonymousId } from '@poup/shared';

import { useTheme } from '@/theme/use-theme';
import { supabase } from '@/lib/supabase';

// Mode B (NFC-e receipt) gets its own scanner mounted with codeTypes:['qr']
// only — a separate screen from Mode A's scan.tsx (codeTypes:['ean-13']
// only), per specs/015-price-scanner/plan.md's Mode A rationale: a shared
// dual-scoped scanner risks reading a product's own marketing QR code
// instead of what it's actually pointed at for that mode.
//
// Single-action flow, no separate preview/confirm step: scanning the QR
// calls the edge function, which fetches/parses/persists in one request —
// mirrors Mode A's "Confirmar preço" button, which is itself the save
// action, not a second step after a preview (see sefaz-nfce-fetch/index.ts
// for why this mirrors Mode A rather than the plan's literal preview-then-
// confirm wording).
//
// No manual-entry fallback here, unlike Mode A: plan.md only requires one
// for Mode A's EAN (8-14 digits); a 44-digit NFC-e access key is not
// something worth asking a user to type character-by-character.

type ScreenState =
  | { kind: 'scanning' }
  | { kind: 'processing' }
  | { kind: 'result'; result: ReceiptResult }
  | { kind: 'error'; message: string };

interface ReceiptResult {
  status: 'processed' | 'partial' | 'already_processed';
  storeName: string | null;
  totalValue: number | null;
  itemCount: number;
  savedItemCount: number;
}

function formatCurrency(value: number | null): string {
  if (value == null) return '—';
  return `R$ ${value.toFixed(2).replace('.', ',')}`;
}

export default function ScanReceiptScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { tokens } = useTheme();
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back');

  const [permissionRequested, setPermissionRequested] = useState(false);
  const [screen, setScreen] = useState<ScreenState>({ kind: 'scanning' });

  const handleQrScanned = useCallback(async (qrUrl: string) => {
    setScreen({ kind: 'processing' });
    try {
      const anonymousId = await getAnonymousId();
      const { data, error } = await supabase.functions.invoke('sefaz-nfce-fetch', {
        body: { qrUrl, anonymousId },
      });

      if (error) {
        console.error('[scan-receipt] sefaz-nfce-fetch invoke failed', error.message);
        const response = error.context;
        if (response && typeof response.clone === 'function') {
          console.error('[scan-receipt] edge function status', response.status);
          response
            .clone()
            .text()
            .then((body: string) => console.error('[scan-receipt] edge function body', body))
            .catch((readErr: unknown) => console.error('[scan-receipt] failed to read body', readErr));
        }
        setScreen({ kind: 'error', message: 'Não foi possível ler a nota fiscal. Tente novamente.' });
        return;
      }
      if (data?.error === 'unsupported_state') {
        setScreen({ kind: 'error', message: 'No momento só oferecemos suporte a notas fiscais de São Paulo.' });
        return;
      }
      if (data?.error) {
        console.warn('[scan-receipt] sefaz-nfce-fetch returned error', data.error);
        setScreen({ kind: 'error', message: 'Código QR não reconhecido como uma nota fiscal (NFC-e).' });
        return;
      }

      setScreen({ kind: 'result', result: data as ReceiptResult });
    } catch (err) {
      console.error('[scan-receipt] handleQrScanned threw', err);
      setScreen({ kind: 'error', message: 'Não foi possível ler a nota fiscal. Tente novamente.' });
    }
  }, []);

  useEffect(() => {
    if (!permissionRequested) return;
    console.log('[scan-receipt] camera state', { hasPermission, device: device?.id ?? null });
  }, [permissionRequested, hasPermission, device]);

  const codeScanner = useCodeScanner({
    codeTypes: ['qr'],
    onCodeScanned: (codes) => {
      if (screen.kind !== 'scanning') return; // ignore further scans while one is already being processed
      const value = codes.find((c) => c.value)?.value;
      if (value) handleQrScanned(value);
    },
  });

  const handleRequestPermission = useCallback(async () => {
    setPermissionRequested(true);
    await requestPermission();
  }, [requestPermission]);

  const resetScan = useCallback(() => setScreen({ kind: 'scanning' }), []);

  const showCamera = hasPermission && device != null && screen.kind === 'scanning';
  const showPriming = !showCamera && screen.kind === 'scanning';

  return (
    <View style={styles.container}>
      {showCamera && (
        <Camera style={StyleSheet.absoluteFill} device={device} isActive={true} codeScanner={codeScanner} />
      )}

      {showPriming && (
        <View style={[styles.centerFill, { backgroundColor: tokens.dark }]}>
          <CameraOff size={40} color="#FFFFFF" />
          <Text style={styles.title}>
            {permissionRequested ? 'Câmera indisponível' : 'Escanear nota fiscal'}
          </Text>
          <Text style={styles.body}>
            {permissionRequested
              ? 'Não foi possível acessar a câmera neste dispositivo.'
              : 'O Poup usa a câmera para ler o QR code da sua nota fiscal (NFC-e) e registrar os preços da compra.'}
          </Text>
          {!permissionRequested && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Permitir acesso à câmera"
              onPress={handleRequestPermission}
              style={[styles.primaryButton, { backgroundColor: tokens.primary }]}
            >
              <Text style={styles.primaryButtonText}>Permitir acesso à câmera</Text>
            </Pressable>
          )}
        </View>
      )}

      {screen.kind === 'scanning' && showCamera && (
        <View pointerEvents="none" style={styles.viewfinderWrap}>
          <View style={styles.viewfinder} />
          <Text style={styles.viewfinderHint}>Aponte para o QR code da nota fiscal</Text>
        </View>
      )}

      {screen.kind === 'processing' && (
        <View style={[styles.centerFill, { backgroundColor: tokens.dark }]}>
          <ActivityIndicator size="large" color="#FFFFFF" />
          <Text style={styles.body}>Lendo nota fiscal...</Text>
        </View>
      )}

      {screen.kind === 'result' && (
        <View style={[styles.centerFill, { backgroundColor: tokens.dark }]}>
          <CircleCheckBig size={40} color={tokens.primary} />
          <Text style={styles.title}>{resultHeadline(screen.result)}</Text>
          <Text style={styles.body}>{resultBody(screen.result)}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Escanear outra nota"
            onPress={resetScan}
            style={[styles.primaryButton, { backgroundColor: tokens.primary }]}
          >
            <Text style={styles.primaryButtonText}>Escanear outra nota</Text>
          </Pressable>
        </View>
      )}

      {screen.kind === 'error' && (
        <View style={[styles.centerFill, { backgroundColor: tokens.dark }]}>
          <TriangleAlert size={40} color="#F59E0B" />
          <Text style={styles.title}>Não foi possível processar</Text>
          <Text style={styles.body}>{screen.message}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Tentar novamente"
            onPress={resetScan}
            style={[styles.primaryButton, { backgroundColor: tokens.primary }]}
          >
            <Text style={styles.primaryButtonText}>Tentar novamente</Text>
          </Pressable>
        </View>
      )}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Fechar"
        onPress={() => router.back()}
        style={[styles.closeButton, { top: insets.top + 12 }]}
      >
        <X size={22} color="#FFFFFF" />
      </Pressable>
    </View>
  );
}

function resultHeadline(result: ReceiptResult): string {
  if (result.status === 'already_processed') return 'Nota já registrada';
  if (result.status === 'partial') return 'Total registrado';
  return `${result.savedItemCount} ${result.savedItemCount === 1 ? 'produto encontrado' : 'produtos encontrados'}`;
}

function resultBody(result: ReceiptResult): string {
  const store = result.storeName ?? 'loja';
  const total = formatCurrency(result.totalValue);
  if (result.status === 'already_processed') {
    return `Você já registrou os ${result.itemCount} itens desta nota anteriormente.`;
  }
  if (result.status === 'partial') {
    return `Não conseguimos ler os itens desta nota, mas o valor total (${total}) foi registrado. Isso ainda ajuda outros consumidores.`;
  }
  return `${store} — ${total}. Isso ajuda outros consumidores.`;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0F' },
  centerFill: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32, gap: 12 },
  title: { color: '#FFFFFF', fontSize: 20, fontWeight: '700', marginTop: 8, textAlign: 'center' },
  body: { color: '#CBD5E1', fontSize: 14, textAlign: 'center', lineHeight: 20 },
  primaryButton: { marginTop: 12, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 14 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  closeButton: {
    position: 'absolute',
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  viewfinderWrap: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', gap: 16 },
  viewfinder: { width: '78%', height: 220, borderRadius: 16, borderWidth: 2, borderColor: '#FFFFFF' },
  viewfinderHint: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '500',
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
});
