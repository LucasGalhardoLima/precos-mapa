import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Camera, useCameraDevice, useCameraPermission, useCodeScanner } from 'react-native-vision-camera';
import { X, Keyboard, CircleCheckBig, CameraOff } from 'lucide-react-native';
import { getAnonymousId } from '@poup/shared';

import { useTheme } from '@/theme/use-theme';
import { useLocation, calculateDistanceKm } from '@/hooks/use-location';
import { supabase } from '@/lib/supabase';
import { PriceEntrySheet } from '@/components/scan/price-entry-sheet';
import type { Product } from '@/types';

// A submission only gets credited to a store when the device is genuinely
// close to it — this is the geo-inference step from specs/015-price-scanner
// (Mode A: "store_id inferred from location"). Full fraud-prevention
// geofencing (reject if >150-300m at submission) is a super/qualidade
// backend concern, not built here — this is just "don't guess a store the
// user obviously isn't at."
const NEAREST_STORE_MAX_KM = 0.3;

const EAN_PATTERN = /^\d{8,14}$/;

type SubmitState = 'idle' | 'submitting' | 'confirmed';

export default function ScanScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { tokens } = useTheme();
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back');
  const { latitude, longitude, hasResolvedLocation } = useLocation();

  const [permissionRequested, setPermissionRequested] = useState(false);
  const [manualEntryOpen, setManualEntryOpen] = useState(false);
  const [manualEanText, setManualEanText] = useState('');
  const [scannedEan, setScannedEan] = useState<string | null>(null);
  const [product, setProduct] = useState<Product | null>(null);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [nearestStorePrice, setNearestStorePrice] = useState<number | null>(null);
  const [submitState, setSubmitState] = useState<SubmitState>('idle');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [nearestStoreId, setNearestStoreId] = useState<string | null>(null);
  const [confirmationName, setConfirmationName] = useState<string | null>(null);

  useEffect(() => {
    if (!permissionRequested) return;
    console.log('[scan] camera state', { hasPermission, device: device?.id ?? null });
  }, [permissionRequested, hasPermission, device]);

  // Nearest active store within NEAREST_STORE_MAX_KM, resolved once real
  // location is available. Small dataset (Matão-only) — a single query is
  // fine, no need for the heavier paginated useStores hook.
  useEffect(() => {
    if (!hasResolvedLocation) return;
    let cancelled = false;
    supabase
      .from('stores')
      .select('id,latitude,longitude')
      .eq('is_active', true)
      .then(({ data, error }) => {
        if (error) console.error('[scan] stores query failed', error);
        if (cancelled || !data) return;
        let closestId: string | null = null;
        let closestKm = Infinity;
        for (const store of data) {
          const km = calculateDistanceKm(latitude, longitude, store.latitude, store.longitude);
          if (km < closestKm) {
            closestKm = km;
            closestId = store.id;
          }
        }
        setNearestStoreId(closestKm <= NEAREST_STORE_MAX_KM ? closestId : null);
      });
    return () => {
      cancelled = true;
    };
  }, [hasResolvedLocation, latitude, longitude]);

  const codeScanner = useCodeScanner({
    codeTypes: ['ean-13'],
    onCodeScanned: (codes) => {
      // Ignore further scans while a code is already being processed —
      // the sheet is already open and re-triggering would clobber it.
      if (scannedEan) return;
      const value = codes.find((c) => c.value)?.value;
      if (value) setScannedEan(value);
    },
  });

  // Product lookup — deterministic EAN match against the catalog, per the
  // Mode A user flow in specs/015-price-scanner/plan.md. Creating a new
  // product from a bare barcode scan is a DISABLED FUTURE FEATURE — see
  // plan.md's "Open decisions" #5 for why (no name to create a row with,
  // and live per-scan Cosmos lookups would compete with the seeder's paid
  // quota) and the free Open Food Facts option earmarked for when this gets
  // picked up. An unrecognized EAN just shows "sem correspondência" until
  // the catalog catches up via the seeder script.
  useEffect(() => {
    if (!scannedEan) {
      setProduct(null);
      return;
    }
    let cancelled = false;
    setIsLookingUp(true);
    supabase
      .from('products')
      .select('*')
      .eq('ean', scannedEan)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) console.error('[scan] product lookup failed', scannedEan, error);
        if (cancelled) return;
        setProduct((data as Product) ?? null);
        setIsLookingUp(false);
      });
    return () => {
      cancelled = true;
    };
  }, [scannedEan]);

  // Pre-fill from the nearest store's actual current price (store_prices —
  // active promo, ERP, or a confirmed crowdsourced report) when available;
  // it's a better starting guess than the catalog-wide reference_price,
  // which the price-entry sheet falls back to when this is null.
  useEffect(() => {
    if (!product?.id || !nearestStoreId) {
      setNearestStorePrice(null);
      return;
    }
    let cancelled = false;
    supabase
      .from('store_prices')
      .select('price')
      .eq('product_id', product.id)
      .eq('store_id', nearestStoreId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) console.error('[scan] store price lookup failed', error);
        if (cancelled) return;
        setNearestStorePrice(data?.price ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [product?.id, nearestStoreId]);

  const resetScan = useCallback(() => {
    setScannedEan(null);
    setProduct(null);
    setSubmitState('idle');
    setSubmitError(null);
  }, []);

  const handleManualSubmit = useCallback(() => {
    const trimmed = manualEanText.trim();
    if (!EAN_PATTERN.test(trimmed)) return;
    setManualEntryOpen(false);
    setManualEanText('');
    setScannedEan(trimmed);
  }, [manualEanText]);

  const handlePriceSubmit = useCallback(
    async (price: number) => {
      if (!scannedEan) return;

      // No geofence gate here — scanning is legitimate away from any store
      // too (checking a product at home before shopping, browsing a pantry
      // item, etc.), not just as an in-store price report. nearestStoreId
      // is already null in that case, so the report just saves without a
      // store attribution below rather than being blocked.

      setSubmitState('submitting');
      setSubmitError(null);

      const anonymousId = await getAnonymousId();

      // No .select() here — price_reports has no SELECT RLS policy for anon
      // (by design, see migration 053), so a RETURNING clause would fail
      // the whole insert even though the row itself is allowed.
      const { error } = await supabase.from('price_reports').insert({
        ean: scannedEan,
        product_id: product?.id ?? null,
        price,
        store_id: nearestStoreId,
        source: 'barcode_scan',
        anonymous_id: anonymousId,
      });

      if (error) {
        console.error('[scan] price report insert failed', error);
        setSubmitState('idle');
        setSubmitError(
          error.code === '23505'
            ? 'Você já reportou o preço deste produto hoje.'
            : 'Não foi possível salvar. Tente novamente.',
        );
        return;
      }

      // Close the modal immediately — it's an RN Modal, which renders in
      // its own native window layer above the rest of the screen, so the
      // confirmation banner (a plain sibling View) would stay hidden behind
      // it for as long as the modal is still open.
      setConfirmationName(product?.name ?? 'produto');
      setScannedEan(null);
      setProduct(null);
      setSubmitState('confirmed');
      setTimeout(() => {
        setSubmitState('idle');
      }, 3500);
    },
    [scannedEan, product, nearestStoreId],
  );

  const handleRequestPermission = useCallback(async () => {
    setPermissionRequested(true);
    await requestPermission();
  }, [requestPermission]);

  const showCamera = hasPermission && device != null;
  // Manual entry is reachable from two places: the priming screen (before
  // permission is ever requested) and the denied/no-camera state — both
  // land here once the user has opted into typing the code instead.
  const showManualForm = !showCamera && manualEntryOpen;
  const showPriming = !showCamera && !manualEntryOpen;

  return (
    <View style={styles.container}>
      {showCamera && (
        <Camera
          style={StyleSheet.absoluteFill}
          device={device}
          isActive={!scannedEan}
          codeScanner={codeScanner}
        />
      )}

      {showPriming && (
        <View style={[styles.centerFill, { backgroundColor: tokens.dark }]}>
          <CameraOff size={40} color="#FFFFFF" />
          <Text style={styles.primingTitle}>
            {permissionRequested ? 'Câmera indisponível' : 'Escanear código de barras'}
          </Text>
          <Text style={styles.primingBody}>
            {permissionRequested
              ? 'Você pode digitar o código de barras do produto manualmente.'
              : 'O Poup usa a câmera para ler o código de barras do produto e registrar o preço que você encontrou na loja.'}
          </Text>
          {!permissionRequested && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Permitir acesso à câmera"
              onPress={handleRequestPermission}
              style={[styles.primingButton, { backgroundColor: tokens.primary }]}
            >
              <Text style={styles.primingButtonText}>Permitir acesso à câmera</Text>
            </Pressable>
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Digitar código manualmente"
            onPress={() => setManualEntryOpen(true)}
          >
            <Text style={styles.primingSkip}>Digitar código manualmente</Text>
          </Pressable>
        </View>
      )}

      {/* Close button */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Fechar"
        onPress={() => router.back()}
        style={[styles.closeButton, { top: insets.top + 12 }]}
      >
        <X size={22} color="#FFFFFF" />
      </Pressable>

      {showCamera && (
        <>
          {/* Viewfinder guide */}
          <View pointerEvents="none" style={styles.viewfinderWrap}>
            <View style={styles.viewfinder} />
            <Text style={styles.viewfinderHint}>Aponte para o código de barras (EAN-13)</Text>
          </View>

          {/* Manual entry toggle — wrapped so the number pad doesn't cover
              the input/button (they're pinned to the bottom otherwise). */}
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.manualToggleWrap}
            pointerEvents="box-none"
          >
            <View style={{ paddingBottom: insets.bottom + 32, width: '100%', alignItems: 'center' }}>
              {manualEntryOpen ? (
                <View style={styles.manualForm}>
                  <TextInput
                    value={manualEanText}
                    onChangeText={setManualEanText}
                    keyboardType="number-pad"
                    placeholder="Digite o código de barras"
                    placeholderTextColor="#94A3B8"
                    style={styles.manualInput}
                    accessibilityLabel="Código de barras"
                    autoFocus
                  />
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Buscar produto"
                    disabled={!EAN_PATTERN.test(manualEanText.trim())}
                    onPress={handleManualSubmit}
                    style={[
                      styles.manualSubmitButton,
                      { backgroundColor: tokens.primary },
                      !EAN_PATTERN.test(manualEanText.trim()) && styles.manualSubmitButtonDisabled,
                    ]}
                  >
                    <Text style={styles.manualSubmitText}>Buscar</Text>
                  </Pressable>
                </View>
              ) : (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Digitar código manualmente"
                  onPress={() => setManualEntryOpen(true)}
                  style={styles.manualToggleButton}
                >
                  <Keyboard size={18} color="#FFFFFF" />
                  <Text style={styles.manualToggleText}>Digitar código manualmente</Text>
                </Pressable>
              )}
            </View>
          </KeyboardAvoidingView>
        </>
      )}

      {showManualForm && (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.manualOnlyFormWrap}
          pointerEvents="box-none"
        >
          <View style={[styles.manualOnlyForm, { paddingBottom: insets.bottom + 32 }]}>
            <TextInput
              value={manualEanText}
              onChangeText={setManualEanText}
              keyboardType="number-pad"
              placeholder="Digite o código de barras"
              placeholderTextColor="#94A3B8"
              style={styles.manualInput}
              accessibilityLabel="Código de barras"
              autoFocus
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Buscar produto"
              disabled={!EAN_PATTERN.test(manualEanText.trim())}
              onPress={handleManualSubmit}
              style={[
                styles.manualSubmitButton,
                { backgroundColor: tokens.primary },
                !EAN_PATTERN.test(manualEanText.trim()) && styles.manualSubmitButtonDisabled,
              ]}
            >
              <Text style={styles.manualSubmitText}>Buscar</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      )}

      {submitState === 'confirmed' && (
        // Below the close button (40pt + margin) — both share the same
        // top-left corner otherwise, and the button's zIndex:10 cuts into
        // the banner's icon/text.
        <View style={[styles.confirmationBanner, { top: insets.top + 64 }]}>
          <CircleCheckBig size={20} color="#FFFFFF" />
          <Text style={styles.confirmationText}>
            Você contribuiu com o preço de {confirmationName}! Isso ajuda outros consumidores.
          </Text>
        </View>
      )}

      <PriceEntrySheet
        ean={scannedEan}
        product={product}
        prefillPrice={nearestStorePrice}
        isLookingUp={isLookingUp}
        isSubmitting={submitState === 'submitting'}
        submitError={submitError}
        onSubmit={handlePriceSubmit}
        onDismiss={resetScan}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0F',
  },
  centerFill: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  primingTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    marginTop: 8,
    textAlign: 'center',
  },
  primingBody: {
    color: '#CBD5E1',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  primingButton: {
    marginTop: 12,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14,
  },
  primingButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  primingSkip: {
    color: '#94A3B8',
    fontSize: 14,
    marginTop: 8,
    textDecorationLine: 'underline',
  },
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
  viewfinderWrap: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  viewfinder: {
    width: '78%',
    height: 140,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  viewfinderHint: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '500',
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  manualToggleWrap: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  manualToggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 24,
  },
  manualToggleText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  manualForm: {
    flexDirection: 'row',
    gap: 8,
    width: '100%',
  },
  manualOnlyFormWrap: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
  },
  manualOnlyForm: {
    flexDirection: 'row',
    gap: 8,
  },
  manualInput: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 14 : 10,
    fontSize: 15,
    color: '#1A1A2E',
  },
  manualSubmitButton: {
    paddingHorizontal: 20,
    justifyContent: 'center',
    borderRadius: 14,
  },
  manualSubmitButtonDisabled: {
    opacity: 0.5,
  },
  manualSubmitText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  confirmationBanner: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#0D9488',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 14,
  },
  confirmationText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
});
