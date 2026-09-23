import { Modal, View, Text, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, typography, radii, spacing } from '../constants/tokens';
import { ListRow } from './list-row';
import { BackLink } from './back-link';
import type { NearbyStore } from '../hooks/use-stores';

interface StorePickerSheetProps {
  visible: boolean;
  stores: NearbyStore[];
  isLoading: boolean;
  onClose: () => void;
  onPick: (chainLabel: string) => void;
}

// Folha "trocar" (Resposta, ONDE) — os 4 mercados, mesmo padrão de Modal +
// backdrop já usado em product-sheet.tsx (onboarding), não @gorhom/bottom-
// sheet (instalado mas não usado em nenhuma tela nova ainda).
export function StorePickerSheet({ visible, stores, isLoading, onClose, onPick }: StorePickerSheetProps) {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Fechar" />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.xl) }]}>
          <View style={styles.header}>
            <BackLink onPress={onClose} />
          </View>
          <Text style={styles.title}>Trocar mercado</Text>

          {isLoading ? (
            <View style={styles.loading}>
              <ActivityIndicator color={colors.brand} />
            </View>
          ) : (
            <View style={styles.rows}>
              {stores.map((s) => (
                <ListRow
                  key={s.chainLabel}
                  title={s.chainLabel}
                  subtitle={s.distanceKm != null ? `${s.distanceKm.toFixed(1).replace('.', ',')} km` : undefined}
                  chevron
                  onPress={() => onPick(s.chainLabel)}
                />
              ))}
            </View>
          )}
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
});
