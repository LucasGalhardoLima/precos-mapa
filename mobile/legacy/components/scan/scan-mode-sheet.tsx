import React from 'react';
import { View, Text, Pressable, StyleSheet, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import { Barcode, Receipt, X } from 'lucide-react-native';

import { useTheme } from '@/theme/use-theme';

interface ScanModeSheetProps {
  visible: boolean;
  onClose: () => void;
}

// The obvious entry point for both 015-price-scanner modes, which otherwise
// only exist as poup:// deep links with no in-app affordance. One FAB in
// the tab bar opens this, giving a single obvious choice between the two.
export function ScanModeSheet({ visible, onClose }: ScanModeSheetProps) {
  const { tokens } = useTheme();
  const router = useRouter();

  const openScan = (path: '/scan' | '/scan-receipt') => {
    onClose();
    router.push(path);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} accessibilityLabel="Fechar" onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: tokens.surface }]}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={[styles.title, { color: tokens.textPrimary }]}>Como você quer contribuir?</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Fechar" onPress={onClose} hitSlop={12}>
              <X size={20} color={tokens.textHint} />
            </Pressable>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Escanear código de barras"
            onPress={() => openScan('/scan')}
            style={[styles.option, { borderColor: tokens.border }]}
          >
            <View style={[styles.optionIcon, { backgroundColor: tokens.primaryMuted }]}>
              <Barcode size={22} color={tokens.primary} />
            </View>
            <View style={styles.optionText}>
              <Text style={[styles.optionTitle, { color: tokens.textPrimary }]}>Escanear código de barras</Text>
              <Text style={[styles.optionSubtitle, { color: tokens.textSecondary }]}>
                Aponte para o produto e registre o preço
              </Text>
            </View>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Escanear nota fiscal"
            onPress={() => openScan('/scan-receipt')}
            style={[styles.option, { borderColor: tokens.border }]}
          >
            <View style={[styles.optionIcon, { backgroundColor: tokens.primaryMuted }]}>
              <Receipt size={22} color={tokens.primary} />
            </View>
            <View style={styles.optionText}>
              <Text style={[styles.optionTitle, { color: tokens.textPrimary }]}>Escanear nota fiscal</Text>
              <Text style={[styles.optionSubtitle, { color: tokens.textSecondary }]}>
                Leia o QR code da nota e registre a compra inteira
              </Text>
            </View>
          </Pressable>
        </View>
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
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 8,
    paddingBottom: 40,
    paddingHorizontal: 20,
    gap: 12,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
    marginBottom: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
  },
  optionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionText: {
    flex: 1,
    gap: 2,
  },
  optionTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  optionSubtitle: {
    fontSize: 12.5,
    lineHeight: 17,
  },
});
