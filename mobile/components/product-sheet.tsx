import { Modal, View, Text, Pressable, ScrollView, ActivityIndicator, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, typography, radii, spacing } from '../constants/tokens';
import { ListRow } from './list-row';
import { EmptyCard } from './empty-card';
import { FilledButton } from './filled-button';
import { TextLink } from './text-link';
import { BackLink } from './back-link';
import { useItemProducts } from '../hooks/use-item-products';
import { displayProductName, parseDefaultSize, type GenericItem, type PinnedProduct } from '../lib/onboarding';

interface ProductSheetProps {
  visible: boolean;
  item: GenericItem | null;
  onClose: () => void;
  onPick: (product: PinnedProduct) => void;
}

// Folha "escolher tipo" (onboarding passo 2): the products of a generic item's
// category at its default size — up to 8 — to pin one and turn the generic row
// into an item-product. The artifact draws no sheet; this one is composed only
// from system components (radius 20 is the token for sheet-level containers).
export function ProductSheet({ visible, item, onClose, onPick }: ProductSheetProps) {
  const insets = useSafeAreaInsets();
  const { products, status, retry } = useItemProducts(visible ? item : null);

  // Only claim a size when the list was actually filtered by it ("12 rolos"
  // and "kg" have no counterpart in the catalog's size columns).
  const title = item ? (parseDefaultSize(item.size) ? `${item.label} · ${item.size}` : item.label) : '';
  const showEmpty = status === 'error' || (status === 'ready' && products.length === 0);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Fechar" />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.xl) }]}>
          <View style={styles.header}>
            <BackLink onPress={onClose} />
          </View>
          <Text style={styles.title}>{title}</Text>

          {status === 'loading' || status === 'idle' ? (
            <View style={styles.loading}>
              <ActivityIndicator color={colors.brand} />
            </View>
          ) : null}

          {status === 'ready' && products.length > 0 ? (
            <ScrollView contentContainerStyle={styles.rows} showsVerticalScrollIndicator={false}>
              {products.map((p) => (
                <ListRow
                  key={p.id}
                  title={displayProductName(p.name, p.size)}
                  subtitle={p.size ?? undefined}
                  imageUrl={p.imageUrl}
                  chevron
                  onPress={() => onPick(p)}
                />
              ))}
            </ScrollView>
          ) : null}

          {showEmpty ? (
            <View style={styles.empty}>
              <EmptyCard>
                {status === 'error'
                  ? 'Não conseguimos carregar agora.'
                  : `Não achamos ${title} no catálogo dos 4 mercados de Matão.`}
              </EmptyCard>
              <FilledButton label="Manter genérico ›" onPress={onClose} />
              <View style={styles.centered}>
                <TextLink label="tentar de novo" onPress={retry} />
              </View>
            </View>
          ) : null}
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
  // Ink at 40% over the screen; opacity on an empty view, so no rgba literal.
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
    maxHeight: '85%',
    backgroundColor: colors.background,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    paddingHorizontal: 20,
    paddingTop: spacing.sm,
    gap: spacing.md,
  },
  header: {
    marginLeft: -spacing.sm,
  },
  title: {
    ...typography.phrase,
    color: colors.ink,
  },
  loading: {
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rows: {
    gap: spacing.sm,
    paddingBottom: spacing.xs,
  },
  empty: {
    gap: spacing.sm,
  },
  centered: {
    alignItems: 'center',
  },
});
