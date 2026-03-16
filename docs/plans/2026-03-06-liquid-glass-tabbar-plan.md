# Liquid Glass Tab Bar Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add iOS 26 Liquid Glass to the tab bar with a dev toggle to compare GlassView pill vs native Expo Router tabs.

**Architecture:** Two tab bar implementations behind a single `tabStyle` setting in the Zustand theme store. `_layout.tsx` conditionally renders either `Tabs` + custom `FloatingTabBar` (with `GlassView`) or `NativeTabs` (Expo Router native tabs). Account screen shows a picker to switch.

**Tech Stack:** expo-glass-effect, expo-router/unstable-native-tabs, Zustand (existing), react-native-reanimated (existing)

---

### Task 1: Install expo-glass-effect

**Files:**
- Modify: `mobile/package.json`

**Step 1: Install the package**

Run: `cd /Users/lucasgalhardo/Documents/Projects/precos-mapa/mobile && npx expo install expo-glass-effect`

Expected: Package added to dependencies.

**Step 2: Verify**

Run: `grep expo-glass-effect /Users/lucasgalhardo/Documents/Projects/precos-mapa/mobile/package.json`

Expected: `"expo-glass-effect": "~X.X.X"` appears.

**Step 3: Commit**

```bash
cd /Users/lucasgalhardo/Documents/Projects/precos-mapa
git add mobile/package.json mobile/package-lock.json
git commit -m "feat(mobile): install expo-glass-effect for Liquid Glass tab bar"
```

---

### Task 2: Add tabStyle to theme store

**Files:**
- Modify: `mobile/theme/store.ts`
- Modify: `mobile/theme/use-theme.ts`

**Step 1: Update store.ts**

Replace the entire file with:

```ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PaletteName } from './palettes';

export type TabStyle = 'glass-pill' | 'native';

interface ThemeState {
  palette: PaletteName;
  setPalette: (palette: PaletteName) => void;
  tabStyle: TabStyle;
  setTabStyle: (tabStyle: TabStyle) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      palette: 'economia_verde',
      setPalette: (palette) => set({ palette }),
      tabStyle: 'glass-pill',
      setTabStyle: (tabStyle) => set({ tabStyle }),
    }),
    {
      name: 'poup-theme',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
```

**Step 2: Update use-theme.ts**

Replace the entire file with:

```ts
import { useThemeStore } from './store';
import type { TabStyle } from './store';
import {
  ENCARTE_TOKENS,
  FINTECH_TOKENS,
  ECONOMIA_VERDE_TOKENS,
  ENCARTE_DIGITAL_TOKENS,
  FINTECH_MODERNA_TOKENS,
  type PaletteName,
  type PaletteTokens,
} from './palettes';

const TOKEN_MAP: Record<PaletteName, PaletteTokens> = {
  encarte: ENCARTE_TOKENS,
  fintech: FINTECH_TOKENS,
  economia_verde: ECONOMIA_VERDE_TOKENS,
  encarte_digital: ENCARTE_DIGITAL_TOKENS,
  fintech_moderna: FINTECH_MODERNA_TOKENS,
};

export function useTheme(): {
  palette: PaletteName;
  tokens: PaletteTokens;
  setPalette: (palette: PaletteName) => void;
  tabStyle: TabStyle;
  setTabStyle: (tabStyle: TabStyle) => void;
} {
  const palette = useThemeStore((s) => s.palette);
  const setPalette = useThemeStore((s) => s.setPalette);
  const tabStyle = useThemeStore((s) => s.tabStyle);
  const setTabStyle = useThemeStore((s) => s.setTabStyle);

  return {
    palette,
    tokens: TOKEN_MAP[palette],
    setPalette,
    tabStyle,
    setTabStyle,
  };
}
```

**Step 3: Commit**

```bash
cd /Users/lucasgalhardo/Documents/Projects/precos-mapa
git add mobile/theme/store.ts mobile/theme/use-theme.ts
git commit -m "feat(mobile): add tabStyle setting to theme store"
```

---

### Task 3: Replace BlurView with GlassView in FloatingTabBar

**Files:**
- Modify: `mobile/components/floating-tab-bar.tsx`

**Step 1: Update imports and glass wrapper**

Replace the entire file with:

```tsx
import { useEffect } from 'react';
import { View, Pressable, Text, Platform, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import {
  Home,
  Search,
  MapPin,
  ListChecks,
  User,
} from 'lucide-react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { useTheme } from '../theme/use-theme';
import { triggerHaptic } from '@/hooks/use-haptics';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PILL_HEIGHT = 60;
const PILL_MARGIN_BOTTOM = 8;
const PILL_MARGIN_TOP = 8;
const PILL_MARGIN_HORIZONTAL = 16;

/** Total vertical space occupied by the pill above the safe-area insets.
 *  Screens use `TAB_BAR_HEIGHT + insets.bottom` for scroll padding. */
export const TAB_BAR_HEIGHT = PILL_HEIGHT + PILL_MARGIN_BOTTOM + PILL_MARGIN_TOP;

/** Gentle spring for icon scale — smooth, minimal bounce. */
const SPRING_CONFIG = { damping: 20, stiffness: 120 };

const HAS_LIQUID_GLASS = isLiquidGlassAvailable();

// ---------------------------------------------------------------------------
// Tab metadata
// ---------------------------------------------------------------------------

const TAB_CONFIG: Record<string, { Icon: typeof Home; label: string }> = {
  index: { Icon: Home, label: 'Início' },
  search: { Icon: Search, label: 'Busca' },
  map: { Icon: MapPin, label: 'Mapa' },
  list: { Icon: ListChecks, label: 'Lista' },
  account: { Icon: User, label: 'Conta' },
};

// ---------------------------------------------------------------------------
// TabItem
// ---------------------------------------------------------------------------

interface TabItemProps {
  Icon: typeof Home;
  label: string;
  isFocused: boolean;
  color: string;
  onPress: () => void;
  onLongPress: () => void;
  accessibilityLabel: string;
}

function TabItem({
  Icon,
  label,
  isFocused,
  color,
  onPress,
  onLongPress,
  accessibilityLabel,
}: TabItemProps) {
  const scale = useSharedValue(isFocused ? 1.1 : 1);

  useEffect(() => {
    scale.value = withSpring(isFocused ? 1.1 : 1, SPRING_CONFIG);
  }, [isFocused, scale]);

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={isFocused ? { selected: true } : {}}
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      onLongPress={onLongPress}
      style={styles.tab}
    >
      <Animated.View style={iconStyle}>
        <Icon size={22} color={color} />
      </Animated.View>
      <Text style={[styles.label, { color }]}>{label}</Text>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// FloatingTabBar
// ---------------------------------------------------------------------------

export function FloatingTabBar({
  state,
  descriptors,
  navigation,
}: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { tokens } = useTheme();

  const tabRow = (
    <View style={styles.tabRow}>
      {state.routes.map((route, index) => {
        const config = TAB_CONFIG[route.name];

        // Hidden routes (favorites, alerts, profile) have no config — skip.
        if (!config) return null;

        const isFocused = state.index === index;
        const color = isFocused ? tokens.primary : tokens.textHint;

        const { Icon, label } = config;

        const onPress = () => {
          triggerHaptic();
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
          <TabItem
            key={route.key}
            Icon={Icon}
            label={label}
            isFocused={isFocused}
            color={color}
            onPress={onPress}
            onLongPress={onLongPress}
            accessibilityLabel={label}
          />
        );
      })}
    </View>
  );

  return (
    <View
      style={[
        styles.outerContainer,
        { bottom: insets.bottom + PILL_MARGIN_BOTTOM },
      ]}
    >
      {HAS_LIQUID_GLASS ? (
        <GlassView glassEffectStyle="regular" style={styles.glassContainer}>
          {tabRow}
        </GlassView>
      ) : (
        <View style={styles.fallbackContainer}>
          <View style={styles.tintOverlay} />
          {tabRow}
        </View>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  outerContainer: {
    position: 'absolute',
    left: PILL_MARGIN_HORIZONTAL,
    right: PILL_MARGIN_HORIZONTAL,
    borderRadius: 28,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  glassContainer: {
    borderRadius: 28,
    overflow: 'hidden',
  },
  fallbackContainer: {
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
  },
  tintOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
  },
  tabRow: {
    flexDirection: 'row',
    height: PILL_HEIGHT,
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
});
```

Key changes:
- Import `GlassView` and `isLiquidGlassAvailable` from `expo-glass-effect` (replaces `BlurView` from `expo-blur`)
- `HAS_LIQUID_GLASS` evaluated once at module level
- If Liquid Glass available: `GlassView` with `glassEffectStyle="regular"`
- If not: fallback `View` with semi-transparent white background + tint overlay

**Step 2: Commit**

```bash
cd /Users/lucasgalhardo/Documents/Projects/precos-mapa
git add mobile/components/floating-tab-bar.tsx
git commit -m "feat(mobile): replace BlurView with GlassView for Liquid Glass

Uses expo-glass-effect GlassView on iOS 26+, falls back to
semi-transparent white on older iOS/Android."
```

---

### Task 4: Create Native Tabs layout

**Files:**
- Create: `mobile/components/native-tab-layout.tsx`

**Step 1: Create the native tabs component**

Create `mobile/components/native-tab-layout.tsx`:

```tsx
import { NativeTabs } from 'expo-router/unstable-native-tabs';

export function NativeTabLayout() {
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Icon sf="house.fill" md="home" />
        <NativeTabs.Trigger.Label>Início</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="search">
        <NativeTabs.Trigger.Icon sf="magnifyingglass" md="search" />
        <NativeTabs.Trigger.Label>Busca</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="map">
        <NativeTabs.Trigger.Icon sf="mappin" md="location_on" />
        <NativeTabs.Trigger.Label>Mapa</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="list">
        <NativeTabs.Trigger.Icon sf="checklist" md="checklist" />
        <NativeTabs.Trigger.Label>Lista</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="account">
        <NativeTabs.Trigger.Icon sf="person.fill" md="person" />
        <NativeTabs.Trigger.Label>Conta</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      {/* Hidden legacy routes */}
      <NativeTabs.Trigger name="favorites" hidden />
      <NativeTabs.Trigger name="alerts" hidden />
      <NativeTabs.Trigger name="profile" hidden />
    </NativeTabs>
  );
}
```

**Step 2: Commit**

```bash
cd /Users/lucasgalhardo/Documents/Projects/precos-mapa
git add mobile/components/native-tab-layout.tsx
git commit -m "feat(mobile): add NativeTabLayout with Liquid Glass native tabs"
```

---

### Task 5: Wire up conditional rendering in _layout.tsx

**Files:**
- Modify: `mobile/app/(tabs)/_layout.tsx`

**Step 1: Update layout to use tabStyle toggle**

Replace the entire file with:

```tsx
import { useEffect } from 'react';
import { Tabs, router } from 'expo-router';
import { useAuthStore } from '@poup/shared';
import { ThemeProvider } from '../../theme/provider';
import { FloatingTabBar } from '../../components/floating-tab-bar';
import { NativeTabLayout } from '../../components/native-tab-layout';
import { useThemeStore } from '../../theme/store';

export default function TabLayout() {
  const session = useAuthStore((s) => s.session);
  const tabStyle = useThemeStore((s) => s.tabStyle);

  useEffect(() => {
    if (session === null) {
      router.replace('/onboarding');
    }
  }, [session]);

  return (
    <ThemeProvider>
      {tabStyle === 'native' ? (
        <NativeTabLayout />
      ) : (
        <Tabs
          tabBar={(props) => <FloatingTabBar {...props} />}
          screenOptions={{
            headerShown: false,
          }}
        >
          {/* ---- Visible tabs ---- */}
          <Tabs.Screen name="index" />
          <Tabs.Screen name="search" />
          <Tabs.Screen name="map" />
          <Tabs.Screen name="list" />
          <Tabs.Screen name="account" />

          {/* ---- Hidden (legacy) screens ---- */}
          <Tabs.Screen name="favorites" options={{ href: null }} />
          <Tabs.Screen name="alerts" options={{ href: null }} />
          <Tabs.Screen name="profile" options={{ href: null }} />
        </Tabs>
      )}
    </ThemeProvider>
  );
}
```

**Step 2: Commit**

```bash
cd /Users/lucasgalhardo/Documents/Projects/precos-mapa
git add mobile/app/\(tabs\)/_layout.tsx
git commit -m "feat(mobile): conditional tab bar rendering based on tabStyle setting"
```

---

### Task 6: Add tab style picker in Account screen

**Files:**
- Modify: `mobile/app/(tabs)/account.tsx`

**Step 1: Add TabStyle import and options constant**

After line 28 (`import type { PaletteName } from '@/theme/palettes';`), add:

```tsx
import type { TabStyle } from '@/theme/store';
```

After the `PALETTE_OPTIONS` array (after line 91), add:

```tsx
const TAB_STYLE_OPTIONS: {
  value: TabStyle;
  label: string;
  description: string;
}[] = [
  {
    value: 'glass-pill',
    label: 'Glass Pill',
    description: 'Pílula flutuante com Liquid Glass.',
  },
  {
    value: 'native',
    label: 'Nativa iOS',
    description: 'Barra nativa com Liquid Glass automático.',
  },
];
```

**Step 2: Destructure setTabStyle from useTheme**

On line 190, change:

```tsx
const { tokens, palette, setPalette } = useTheme();
```

To:

```tsx
const { tokens, palette, setPalette, tabStyle, setTabStyle } = useTheme();
```

**Step 3: Add the tab style picker UI**

After the palette selector section (after line 456, the closing `})`), and before the `<SectionDivider style={{ marginVertical: 8 }} />` on line 458, add:

```tsx
        {/* Tab style picker */}
        <SectionHeader title="ESTILO DA BARRA" tokens={tokens} />

        {TAB_STYLE_OPTIONS.map((opt) => {
          const isSelected = tabStyle === opt.value;
          return (
            <Pressable
              key={opt.value}
              style={[styles.row, { borderBottomColor: tokens.border }]}
              onPress={() => {
                triggerHaptic(ImpactFeedbackStyle.Medium);
                setTabStyle(opt.value);
              }}
              android_ripple={{ color: tokens.mist }}
            >
              <View style={styles.rowLeft}>
                <View style={styles.paletteInfo}>
                  <Text style={[styles.rowLabel, { color: tokens.textPrimary }]}>
                    {opt.label}
                  </Text>
                  <Text style={[styles.paletteDesc, { color: tokens.textHint }]}>
                    {opt.description}
                  </Text>
                </View>
              </View>
              {isSelected && <Check size={20} color={tokens.primary} />}
            </Pressable>
          );
        })}
```

**Step 4: Commit**

```bash
cd /Users/lucasgalhardo/Documents/Projects/precos-mapa
git add mobile/app/\(tabs\)/account.tsx
git commit -m "feat(mobile): add tab style picker in Account screen

Toggle between Glass Pill and Native iOS tab bar under Aparencia section."
```

---

### Task 7: Rebuild and verify

**Step 1: Rebuild native iOS project**

Run: `cd /Users/lucasgalhardo/Documents/Projects/precos-mapa/mobile && npx expo prebuild --clean && npx expo run:ios`

Expected: App builds and runs on iOS simulator.

**Step 2: Verify Glass Pill mode**

- Navigate all 5 tabs — icons scale, colors change
- On iOS 26: Liquid Glass material visible (especially on map tab with content behind)
- On older iOS / Expo Go: fallback semi-transparent white background

**Step 3: Verify Native Tabs mode**

- Open Account > scroll to "Estilo da Barra" > tap "Nativa iOS"
- Tab bar remounts as native iOS tab bar
- All 5 tabs visible with SF Symbols
- Liquid Glass effect applied automatically by iOS 26
- Navigate all tabs, verify they load correctly

**Step 4: Switch back to Glass Pill**

- Go back to Account > "Estilo da Barra" > tap "Glass Pill"
- Custom pill tab bar returns
