import { useState } from 'react';
import { View, Pressable, Text, Platform, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import {
  Home,
  Search,
  MapPin,
  ListChecks,
  Bell,
  ScanLine,
} from 'lucide-react-native';
import { useTheme } from '../theme/use-theme';
import { useAlerts } from '../hooks/use-alerts';
import { ScanModeSheet } from './scan/scan-mode-sheet';

/** Height of the tab bar itself, excluding safe-area insets. */
export const TAB_BAR_HEIGHT = 72;

const TAB_CONFIG: Record<string, { Icon: typeof Home; label: string }> = {
  index: { Icon: Home, label: 'Início' },
  search: { Icon: Search, label: 'Busca' },
  map: { Icon: MapPin, label: 'Mapa' },
  list: { Icon: ListChecks, label: 'Lista' },
  alerts: { Icon: Bell, label: 'Alertas' },
};

export function FloatingTabBar({
  state,
  descriptors,
  navigation,
}: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { tokens } = useTheme();
  const { count: alertCount = 0 } = useAlerts();
  const [scanSheetOpen, setScanSheetOpen] = useState(false);

  const tabButtons = state.routes
    .map((route, index) => {
      const config = TAB_CONFIG[route.name];

      // Hidden routes (favorites, alerts, profile) have no config — skip.
      if (!config) return null;

      const isFocused = state.index === index;
      const color = isFocused ? tokens.primary : tokens.textHint;

      const { Icon, label } = config;

      const onPress = () => {
        const event = navigation.emit({
          type: 'tabPress',
          target: route.key,
          canPreventDefault: true,
        });

        if (!isFocused && !event.defaultPrevented) {
          navigation.navigate(route.name);
        }
      };

      const onLongPress = () => {
        navigation.emit({
          type: 'tabLongPress',
          target: route.key,
        });
      };

      return (
        <Pressable
          key={route.key}
          accessibilityRole="button"
          accessibilityState={isFocused ? { selected: true } : {}}
          accessibilityLabel={label}
          onPress={onPress}
          onLongPress={onLongPress}
          style={styles.tab}
        >
          <Icon size={22} color={color} />
          {route.name === 'alerts' && alertCount > 0 && (
            <View style={styles.alertDot} />
          )}
          <Text
            style={[
              styles.label,
              { color },
            ]}
          >
            {label}
          </Text>
        </Pressable>
      );
    })
    .filter(Boolean);

  return (
    <View
      style={[
        styles.container,
        {
          paddingBottom: insets.bottom,
          backgroundColor: '#FFFFFF',
        },
      ]}
    >
      <View style={styles.tabRow}>{tabButtons}</View>

      {/* True floating FAB above the bar, not a mid-row slot — matches the
          app's existing floating-button convention (e.g. the shopping list's
          "add item" FAB: bottom-right, absolutely positioned, floating clear
          of the tab row) rather than sharing the tabs' flex layout. See
          015-price-scanner: scan.tsx/scan-receipt.tsx existed only as
          poup:// deep links with no in-app affordance until this button. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Escanear preço ou nota fiscal"
        onPress={() => setScanSheetOpen(true)}
        style={[
          styles.scanFab,
          {
            backgroundColor: tokens.primary,
            bottom: TAB_BAR_HEIGHT + insets.bottom + 16,
          },
        ]}
      >
        <ScanLine size={24} color="#FFFFFF" />
      </Pressable>

      <ScanModeSheet visible={scanSheetOpen} onClose={() => setScanSheetOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  tabRow: {
    flexDirection: 'row',
    height: TAB_BAR_HEIGHT,
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },
  alertDot: {
    position: 'absolute',
    top: 2,
    right: '30%',
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },
  scanFab: {
    position: 'absolute',
    right: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },
});
