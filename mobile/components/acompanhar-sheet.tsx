import { useEffect, useState } from 'react';
import { Modal, View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fontFamily, typography, radii, spacing, targets, borderWidth, tabularNums } from '../constants/tokens';
import { BlockLabel } from './block-label';
import { FilledButton } from './filled-button';
import { TextLink } from './text-link';
import { formatBRL } from '../hooks/use-search';

interface AcompanharSheetProps {
  visible: boolean;
  productName: string;
  productSize: string | null; // já formatado (ex. "750 ml") — bloco some do título se null
  // "8a com preço, 8b sem preço" — today's cheapest price pre-fills the
  // field; null (no price today) leaves it empty with a gray "R$" hint.
  // When editing an already-tracked item, its own target price wins over
  // today's price as the starting value (see app/product/[id].tsx).
  suggestedPrice: number | null;
  // Fato de hoje, sempre — independe do valor-alvo (editável) acima. Linha
  // de procedência abaixo do campo: "hoje: R$ 37,90 no Tenda" / "sem preço
  // hoje" quando null.
  todayPrice: number | null;
  todayStoreName: string | null;
  isSubmitting: boolean;
  onClose: () => void;
  onTrackWithAlert: (targetPrice: number) => void;
  onTrackWithoutAlert: () => void;
}

// Folha "Acompanhar" (artefato seção 8, spec do Lucas 2026-09-23) — mesmo
// padrão de Modal + backdrop de product-sheet.tsx/store-picker-sheet.tsx,
// com um puxador no topo e "fechar" à direita (essas duas telas usam
// BackLink à esquerda; esta é uma folha de ação isolada, não um passo de
// fluxo, daí o padrão diferente).
export function AcompanharSheet({
  visible,
  productName,
  productSize,
  suggestedPrice,
  todayPrice,
  todayStoreName,
  isSubmitting,
  onClose,
  onTrackWithAlert,
  onTrackWithoutAlert,
}: AcompanharSheetProps) {
  const insets = useSafeAreaInsets();
  const [priceText, setPriceText] = useState('');
  const [fieldFocused, setFieldFocused] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setPriceText(suggestedPrice != null ? suggestedPrice.toFixed(2).replace('.', ',') : '');
  }, [visible, suggestedPrice]);

  const parsedPrice = parseFloat(priceText.replace(',', '.'));
  const hasValidPrice = !Number.isNaN(parsedPrice) && parsedPrice > 0;
  const title = `Acompanhar ${productName}${productSize ? ` · ${productSize}` : ''}`;
  const provenance = todayPrice != null && todayStoreName ? `hoje: ${formatBRL(todayPrice)} no ${todayStoreName}` : 'sem preço hoje';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Fechar" />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.xl) }]}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Fechar" hitSlop={8} style={styles.closeTarget}>
              <Text style={styles.closeLabel}>fechar</Text>
            </Pressable>
          </View>

          <View style={styles.field}>
            <BlockLabel>AVISAR QUANDO CAIR ABAIXO DE</BlockLabel>
            <View style={[styles.priceField, fieldFocused && styles.priceFieldFocused]}>
              <Text style={styles.pricePrefix}>R$</Text>
              <TextInput
                value={priceText}
                onChangeText={setPriceText}
                keyboardType="decimal-pad"
                placeholder="0,00"
                placeholderTextColor={colors.absence}
                selectionColor={colors.brand}
                editable={!isSubmitting}
                onFocus={() => setFieldFocused(true)}
                onBlur={() => setFieldFocused(false)}
                style={styles.priceInput}
              />
            </View>
            <Text style={styles.provenance}>{provenance}</Text>
          </View>

          <View style={styles.actions}>
            {/* "nenhum botão fica desabilitado" (mobile/CLAUDE.md) — sempre
                tocável; um preço vazio/inválido só faz o toque não fazer nada,
                em vez de desabilitar visualmente. */}
            <FilledButton
              label="Acompanhar e avisar ›"
              onPress={() => {
                if (!isSubmitting && hasValidPrice) onTrackWithAlert(parsedPrice);
              }}
            />
            <TextLink label="Acompanhar sem avisos" onPress={() => !isSubmitting && onTrackWithoutAlert()} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.ink,
    opacity: 0.4,
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    paddingHorizontal: 20,
    paddingTop: spacing.sm,
    gap: spacing.xl,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  title: {
    ...typography.phrase,
    color: colors.ink,
    flex: 1,
  },
  closeTarget: {
    height: targets.touch,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    marginRight: -spacing.sm,
    marginTop: -spacing.xs,
    flexShrink: 0,
  },
  closeLabel: {
    fontFamily: fontFamily.semibold,
    fontSize: 16,
    color: colors.brandInk,
  },
  field: {
    gap: spacing.sm,
  },
  priceField: {
    height: targets.button,
    backgroundColor: '#fff',
    borderWidth,
    borderColor: colors.border,
    borderRadius: radii.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.xl,
  },
  priceFieldFocused: {
    borderColor: colors.brand,
  },
  pricePrefix: {
    ...typography.price,
    color: colors.absence,
  },
  priceInput: {
    flex: 1,
    ...typography.price,
    color: colors.ink,
    ...tabularNums,
    padding: 0,
  },
  provenance: {
    ...typography.provenance,
    color: colors.secondary,
  },
  actions: {
    gap: spacing.md - 2,
  },
});
