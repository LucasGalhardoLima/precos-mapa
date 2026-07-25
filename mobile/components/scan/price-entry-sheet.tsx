import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Image,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Package } from 'lucide-react-native';

import { useTheme } from '@/theme/use-theme';
import type { Product } from '@/types';

interface PriceEntrySheetProps {
  ean: string | null;
  product: Product | null;
  /** Nearest store's actual current price (store_prices), preferred over product.reference_price when set. */
  prefillPrice?: number | null;
  isLookingUp: boolean;
  isSubmitting: boolean;
  submitError?: string | null;
  onSubmit: (price: number) => void;
  onDismiss: () => void;
}

function formatPriceInput(text: string): string {
  const digitsOnly = text.replace(/\D/g, '');
  if (!digitsOnly) return '';
  const cents = parseInt(digitsOnly, 10);
  return (cents / 100).toFixed(2).replace('.', ',');
}

function parsePriceInput(formatted: string): number | null {
  const normalized = formatted.replace(',', '.');
  const value = parseFloat(normalized);
  return Number.isFinite(value) && value > 0 ? value : null;
}

// A plain RN Modal, not @gorhom/bottom-sheet — this needs to reliably open
// in reaction to `ean` going from null to a value (a prop change driven by
// async scan/lookup state, not a direct onPress), and Modal's `visible`
// prop is built exactly for that. BottomSheet's `index` prop is documented
// as an INITIAL value only; reopening it after close needs the imperative
// ref API triggered from a user gesture, which doesn't fit this data flow.
export function PriceEntrySheet({ ean, product, prefillPrice, isLookingUp, isSubmitting, submitError, onSubmit, onDismiss }: PriceEntrySheetProps) {
  const { tokens } = useTheme();
  const [priceText, setPriceText] = useState('');

  useEffect(() => {
    const initial = prefillPrice ?? product?.reference_price;
    if (initial) {
      setPriceText(initial.toFixed(2).replace('.', ','));
    } else {
      setPriceText('');
    }
  }, [product, prefillPrice]);

  const parsedPrice = parsePriceInput(priceText);

  const handleConfirm = useCallback(() => {
    if (parsedPrice == null) return;
    onSubmit(parsedPrice);
  }, [parsedPrice, onSubmit]);

  return (
    <Modal visible={ean !== null} transparent animationType="slide" onRequestClose={onDismiss}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} accessibilityLabel="Fechar" onPress={onDismiss} />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.sheetWrap}
        >
          <View style={[styles.sheet, { backgroundColor: tokens.surface }]}>
            <View style={styles.handle} />
            <View style={styles.content}>
              {isLookingUp ? (
                <View style={styles.lookupRow}>
                  <ActivityIndicator color={tokens.primary} />
                  <Text style={[styles.lookupText, { color: tokens.textSecondary }]}>
                    Procurando produto...
                  </Text>
                </View>
              ) : (
                <View style={styles.productRow}>
                  {product?.image_url ? (
                    <Image source={{ uri: product.image_url }} style={styles.productImage} />
                  ) : (
                    <View style={[styles.productImage, styles.productImagePlaceholder, { backgroundColor: tokens.primaryMuted }]}>
                      <Package size={24} color={tokens.primary} />
                    </View>
                  )}
                  <View style={styles.productInfo}>
                    <Text style={[styles.productName, { color: tokens.textPrimary }]} numberOfLines={2}>
                      {product?.name ?? 'Produto não encontrado'}
                    </Text>
                    <Text style={[styles.productEan, { color: tokens.textHint }]}>
                      {product ? `EAN ${ean}` : `Código ${ean} — sem correspondência no catálogo`}
                    </Text>
                  </View>
                </View>
              )}

              <Text style={[styles.label, { color: tokens.textSecondary }]}>Preço encontrado</Text>
              <View style={[styles.priceInputRow, { borderColor: tokens.border }]}>
                <Text style={[styles.currencyPrefix, { color: tokens.textPrimary }]}>R$</Text>
                <TextInput
                  value={priceText}
                  onChangeText={(text) => setPriceText(formatPriceInput(text))}
                  keyboardType="number-pad"
                  placeholder="0,00"
                  placeholderTextColor={tokens.textHint}
                  style={[styles.priceInput, { color: tokens.textPrimary }]}
                  accessibilityLabel="Preço do produto"
                  autoFocus
                />
              </View>

              {submitError && (
                <Text style={styles.submitErrorText}>{submitError}</Text>
              )}

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Confirmar preço"
                disabled={parsedPrice == null || isSubmitting}
                onPress={handleConfirm}
                style={[
                  styles.confirmButton,
                  { backgroundColor: tokens.primary },
                  (parsedPrice == null || isSubmitting) && styles.confirmButtonDisabled,
                ]}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.confirmButtonText}>Confirmar</Text>
                )}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheetWrap: {
    width: '100%',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 8,
    paddingBottom: 32,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
    marginBottom: 12,
  },
  content: {
    paddingHorizontal: 20,
    gap: 16,
  },
  lookupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  lookupText: {
    fontSize: 14,
  },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  productImage: {
    width: 56,
    height: 56,
    borderRadius: 12,
  },
  productImagePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  productInfo: {
    flex: 1,
    gap: 2,
  },
  productName: {
    fontSize: 16,
    fontWeight: '600',
  },
  productEan: {
    fontSize: 12,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
  },
  priceInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  currencyPrefix: {
    fontSize: 20,
    fontWeight: '600',
  },
  priceInput: {
    flex: 1,
    fontSize: 24,
    fontWeight: '700',
    padding: 0,
  },
  confirmButton: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmButtonDisabled: {
    opacity: 0.5,
  },
  confirmButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  submitErrorText: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
  },
});
