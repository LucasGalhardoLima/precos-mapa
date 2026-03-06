import { useLocalSearchParams, router } from 'expo-router';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Check, ChevronLeft } from 'lucide-react-native';
import { useTheme } from '@/theme/use-theme';
import { useThemeStore, type TabName } from '@/theme/store';
import { triggerHaptic } from '@/hooks/use-haptics';
import { ImpactFeedbackStyle } from 'expo-haptics';

const TAB_LABELS: Record<TabName, string> = {
  index: 'Início',
  search: 'Busca',
  map: 'Mapa',
  list: 'Lista',
  account: 'Conta',
};

const ICON_OPTIONS: Record<TabName, { sf: string; label: string }[]> = {
  index: [
    { sf: 'house.fill', label: 'Casa (preenchida)' },
    { sf: 'house', label: 'Casa' },
    { sf: 'storefront.fill', label: 'Loja' },
    { sf: 'house.circle.fill', label: 'Casa (círculo)' },
  ],
  search: [
    { sf: 'magnifyingglass', label: 'Lupa' },
    { sf: 'magnifyingglass.circle.fill', label: 'Lupa (círculo)' },
    { sf: 'text.magnifyingglass', label: 'Busca texto' },
    { sf: 'sparkle.magnifyingglass', label: 'Busca mágica' },
  ],
  map: [
    { sf: 'mappin', label: 'Alfinete' },
    { sf: 'map.fill', label: 'Mapa' },
    { sf: 'mappin.and.ellipse', label: 'Alfinete (sombra)' },
    { sf: 'mappin.circle.fill', label: 'Alfinete (círculo)' },
    { sf: 'location.fill', label: 'Localização' },
  ],
  list: [
    { sf: 'checklist', label: 'Checklist' },
    { sf: 'list.bullet', label: 'Lista' },
    { sf: 'list.clipboard.fill', label: 'Prancheta' },
    { sf: 'cart.fill', label: 'Carrinho' },
    { sf: 'basket.fill', label: 'Cesta' },
  ],
  account: [
    { sf: 'person.fill', label: 'Pessoa' },
    { sf: 'person.circle.fill', label: 'Pessoa (círculo)' },
    { sf: 'person.crop.circle.fill', label: 'Pessoa (recorte)' },
    { sf: 'gearshape.fill', label: 'Engrenagem' },
  ],
};

export default function IconPickerScreen() {
  const { tab } = useLocalSearchParams<{ tab: TabName }>();
  const { tokens } = useTheme();
  const currentIcon = useThemeStore((s) => s.tabIcons[tab]);
  const setTabIcon = useThemeStore((s) => s.setTabIcon);

  const options = ICON_OPTIONS[tab] ?? [];
  const label = TAB_LABELS[tab] ?? tab;

  const handleSelect = (sf: string) => {
    triggerHaptic(ImpactFeedbackStyle.Medium);
    setTabIcon(tab, sf);
    router.back();
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: tokens.bg }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <ChevronLeft size={24} color={tokens.primary} />
        </Pressable>
        <Text style={[styles.title, { color: tokens.textPrimary }]}>
          Ícone — {label}
        </Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Options list */}
      <ScrollView style={styles.list}>
        {options.map((opt) => {
          const isSelected = opt.sf === currentIcon;
          return (
            <Pressable
              key={opt.sf}
              style={[
                styles.option,
                { borderBottomColor: tokens.border },
                isSelected && { backgroundColor: tokens.primaryMuted },
              ]}
              onPress={() => handleSelect(opt.sf)}
            >
              <View style={styles.optionLeft}>
                <Text style={[styles.optionLabel, { color: tokens.textPrimary }]}>
                  {opt.label}
                </Text>
                <Text style={[styles.sfName, { color: tokens.textHint }]}>
                  {opt.sf}
                </Text>
              </View>
              {isSelected && <Check size={20} color={tokens.primary} />}
            </Pressable>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
  },
  list: {
    flex: 1,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  optionLeft: {
    flex: 1,
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  sfName: {
    fontSize: 12,
    marginTop: 2,
  },
});
