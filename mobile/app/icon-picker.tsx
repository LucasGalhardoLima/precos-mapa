import { useLocalSearchParams, router } from 'expo-router';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Check, ChevronLeft } from 'lucide-react-native';
import { SymbolView } from 'expo-symbols';
import type { SFSymbols7_0 } from 'sf-symbols-typescript';
import { useTheme } from '@/theme/use-theme';
import { useThemeStore, type TabName } from '@/theme/store';
import { triggerHaptic } from '@/hooks/use-haptics';

const TAB_LABELS: Record<TabName, string> = {
  index: 'Início',
  search: 'Busca',
  map: 'Mapa',
  list: 'Lista',
  account: 'Conta',
};

const ICON_OPTIONS: Record<TabName, string[]> = {
  index: ['house.fill', 'house', 'storefront.fill', 'house.circle.fill'],
  search: [
    'magnifyingglass',
    'magnifyingglass.circle.fill',
    'text.magnifyingglass',
    'sparkle.magnifyingglass',
  ],
  map: ['map.fill', 'mappin', 'mappin.and.ellipse', 'mappin.circle.fill', 'location.fill'],
  list: ['cart.fill', 'checklist', 'list.bullet', 'list.clipboard.fill', 'basket.fill'],
  account: ['person.fill', 'person.circle.fill', 'person.crop.circle.fill', 'gearshape.fill'],
};

export default function IconPickerScreen() {
  const { tab } = useLocalSearchParams<{ tab: TabName }>();
  const { tokens } = useTheme();
  const currentIcon = useThemeStore((s) => s.tabIcons[tab]);
  const setTabIcon = useThemeStore((s) => s.setTabIcon);

  const options = ICON_OPTIONS[tab] ?? [];
  const label = TAB_LABELS[tab] ?? tab;

  const handleSelect = (icon: string) => {
    triggerHaptic();
    setTabIcon(tab, icon);
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

      {/* Icon grid */}
      <View style={styles.grid}>
        {options.map((sfName) => {
          const isSelected = sfName === currentIcon;
          return (
            <Pressable
              key={sfName}
              style={[
                styles.option,
                {
                  backgroundColor: isSelected ? tokens.primaryMuted : tokens.surface,
                  borderColor: isSelected ? tokens.primary : tokens.border,
                },
              ]}
              onPress={() => handleSelect(sfName)}
            >
              {Platform.OS === 'ios' ? (
                <SymbolView
                  name={sfName as SFSymbols7_0}
                  size={32}
                  tintColor={isSelected ? tokens.primary : tokens.textSecondary}
                />
              ) : (
                <Text style={[styles.androidIcon, { color: tokens.textSecondary }]}>
                  {sfName}
                </Text>
              )}
              <Text
                style={[styles.iconName, { color: tokens.textHint }]}
                numberOfLines={1}
              >
                {sfName}
              </Text>
              {isSelected && (
                <View style={styles.checkMark}>
                  <Check size={16} color={tokens.primary} />
                </View>
              )}
            </Pressable>
          );
        })}
      </View>
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
    paddingVertical: 12,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 16,
    gap: 12,
  },
  option: {
    width: '47%',
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    position: 'relative',
  },
  androidIcon: {
    fontSize: 11,
    textAlign: 'center',
    marginBottom: 8,
  },
  iconName: {
    fontSize: 11,
    textAlign: 'center',
    marginTop: 8,
  },
  checkMark: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
});
