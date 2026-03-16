# Tab Icon Customization + Theme Simplification Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove glass-pill tab bar and multi-palette system; keep only Economia Verde + native iOS tabs; add per-tab SF Symbol icon customization with drill-down selector.

**Architecture:** Simplify the Zustand theme store to hold only `tabIcons` (persisted). Remove all palette branching from themed components. Add a new `icon-picker` modal screen navigable from the account page's ÍCONES section.

**Tech Stack:** Expo Router v6, Zustand v5 + AsyncStorage, expo-router/unstable-native-tabs (NativeTabs), SF Symbols, react-native-reanimated

---

### Task 1: Simplify theme store

**Files:**
- Modify: `mobile/theme/store.ts`

**Step 1: Rewrite store.ts**

Replace the entire file. Remove `palette`, `setPalette`, `tabStyle`, `setTabStyle`. Add `tabIcons` and `setTabIcon`.

```typescript
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type TabName = 'index' | 'search' | 'map' | 'list' | 'account';

export const DEFAULT_TAB_ICONS: Record<TabName, string> = {
  index: 'house.fill',
  search: 'magnifyingglass',
  map: 'mappin',
  list: 'checklist',
  account: 'person.fill',
};

interface ThemeState {
  tabIcons: Record<TabName, string>;
  setTabIcon: (tab: TabName, icon: string) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      tabIcons: { ...DEFAULT_TAB_ICONS },
      setTabIcon: (tab, icon) =>
        set((state) => ({
          tabIcons: { ...state.tabIcons, [tab]: icon },
        })),
    }),
    {
      name: 'poup-theme',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
```

**Step 2: Commit**

```bash
git add mobile/theme/store.ts
git commit -m "refactor(mobile): simplify theme store — remove palette/tabStyle, add tabIcons"
```

---

### Task 2: Simplify palettes and useTheme hook

**Files:**
- Modify: `mobile/theme/palettes.ts`
- Modify: `mobile/theme/use-theme.ts`
- Modify: `mobile/theme/provider.tsx`

**Step 1: Simplify palettes.ts**

Keep only the `PaletteTokens` type, `SHARED` constants, and `ECONOMIA_VERDE_TOKENS`. Remove `PaletteName` type and all other palette exports (`ENCARTE_TOKENS`, `FINTECH_TOKENS`, `ENCARTE_DIGITAL_TOKENS`, `FINTECH_MODERNA_TOKENS`).

```typescript
/**
 * Semantic palette tokens — Economia Verde theme.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PaletteTokens = {
  /** Font family for display text (headings, titles) */
  fontDisplay: string;
  /** Font family for body text (regular weight) */
  fontBody: string;
  /** Font family for body text (medium weight) */
  fontBodyMedium: string;

  /** Screen background */
  bg: string;
  /** Card / elevated surface background */
  surface: string;

  /** Primary body text */
  textPrimary: string;
  /** Secondary / supporting text */
  textSecondary: string;
  /** Hint / metadata text */
  textHint: string;

  /** Brand primary action color */
  primary: string;
  /** Lighter primary for press/hover states */
  primaryHover: string;
  /** Very light primary tint (badges, soft backgrounds) */
  primaryMuted: string;

  /** Discount/promo highlight color (badges, strikethrough prices) */
  accent: string;
  /** Light accent tint for badge backgrounds */
  accentSoft: string;

  /** Header / app-bar background */
  header: string;
  /** Header text color */
  headerText: string;

  /** Default border / divider */
  border: string;

  /** Success indicator (low price, savings) */
  success: string;
  /** Danger indicator (errors, alerts) */
  danger: string;
  /** Warning indicator (attention, promos) */
  warning: string;
  /** Neutral secondary text */
  muted: string;

  /** Dark surface for overlays / headers */
  dark: string;
  /** Slightly lighter dark surface */
  darkSurface: string;
  /** Subtle mist / wash background */
  mist: string;
};

// ---------------------------------------------------------------------------
// Shared functional colors
// ---------------------------------------------------------------------------

const SHARED = {
  success: '#16A34A',
  danger: '#EF4444',
  warning: '#F59E0B',
  muted: '#64748B',
} as const;

// ---------------------------------------------------------------------------
// Economia Verde — teal + golden yellow
// ---------------------------------------------------------------------------

export const TOKENS: PaletteTokens = {
  fontDisplay: 'Poppins_700Bold',
  fontBody: 'Inter_400Regular',
  fontBodyMedium: 'Inter_500Medium',

  bg: '#F0FDFA',
  surface: '#FFFFFF',
  textPrimary: '#1A1A2E',
  textSecondary: '#4A5568',
  textHint: '#8A97A8',
  primary: '#0D9488',
  primaryHover: '#14B8A6',
  primaryMuted: '#CCFBF1',
  accent: '#F59E0B',
  accentSoft: '#FEF3C7',
  header: '#0D9488',
  headerText: '#FFFFFF',
  border: '#E2E8F0',
  ...SHARED,
  dark: '#1A1A2E',
  darkSurface: '#2D2D44',
  mist: '#F0FDFA',
};
```

**Step 2: Simplify use-theme.ts**

Remove palette switching, always return the single set of tokens. Expose `tabIcons` and `setTabIcon`.

```typescript
import { useThemeStore, type TabName } from './store';
import { TOKENS, type PaletteTokens } from './palettes';

export function useTheme(): {
  tokens: PaletteTokens;
  tabIcons: Record<TabName, string>;
  setTabIcon: (tab: TabName, icon: string) => void;
} {
  const tabIcons = useThemeStore((s) => s.tabIcons);
  const setTabIcon = useThemeStore((s) => s.setTabIcon);

  return {
    tokens: TOKENS,
    tabIcons,
    setTabIcon,
  };
}
```

**Step 3: Simplify provider.tsx**

Remove palette from context. Components that use `useThemeContext()` only need tokens.

```typescript
import React, { createContext, useContext } from 'react';
import type { PaletteTokens } from './palettes';
import { useTheme } from './use-theme';

interface ThemeContextValue {
  tokens: PaletteTokens;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { tokens } = useTheme();
  return (
    <ThemeContext.Provider value={{ tokens }}>{children}</ThemeContext.Provider>
  );
}

export function useThemeContext(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (ctx === null) {
    throw new Error(
      'useThemeContext must be used within a <ThemeProvider>. ' +
        'Wrap your app root with <ThemeProvider> to fix this.',
    );
  }
  return ctx;
}
```

**Step 4: Commit**

```bash
git add mobile/theme/palettes.ts mobile/theme/use-theme.ts mobile/theme/provider.tsx
git commit -m "refactor(mobile): simplify palette to single Economia Verde theme"
```

---

### Task 3: Remove glass-pill tab bar and simplify layout

**Files:**
- Delete: `mobile/components/floating-tab-bar.tsx`
- Modify: `mobile/app/(tabs)/_layout.tsx`

**Step 1: Delete floating-tab-bar.tsx**

```bash
rm mobile/components/floating-tab-bar.tsx
```

**Step 2: Rewrite (tabs)/_layout.tsx**

Always render `NativeTabLayout`. Remove `Tabs`, `FloatingTabBar`, and `useThemeStore` imports.

```typescript
import { useEffect } from 'react';
import { router } from 'expo-router';
import { useAuthStore } from '@poup/shared';
import { ThemeProvider } from '../../theme/provider';
import { NativeTabLayout } from '../../components/native-tab-layout';

export default function TabLayout() {
  const session = useAuthStore((s) => s.session);

  useEffect(() => {
    if (session === null) {
      router.replace('/onboarding');
    }
  }, [session]);

  return (
    <ThemeProvider>
      <NativeTabLayout />
    </ThemeProvider>
  );
}
```

**Step 3: Commit**

```bash
git add mobile/app/(tabs)/_layout.tsx
git rm mobile/components/floating-tab-bar.tsx
git commit -m "refactor(mobile): remove glass-pill tab bar, always use native tabs"
```

---

### Task 4: Update NativeTabLayout with dynamic icons

**Files:**
- Modify: `mobile/components/native-tab-layout.tsx`

**Step 1: Rewrite native-tab-layout.tsx**

Read `tabIcons` from the theme store and pass dynamic SF symbols. Include tintColor from tokens.

```typescript
import { NativeTabs, Icon, Label } from 'expo-router/unstable-native-tabs';
import { useTheme } from '../theme/use-theme';

export function NativeTabLayout() {
  const { tokens, tabIcons } = useTheme();

  return (
    <NativeTabs tintColor={tokens.primary}>
      <NativeTabs.Trigger name="index">
        <Icon sf={tabIcons.index} />
        <Label>Início</Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="search">
        <Icon sf={tabIcons.search} />
        <Label>Busca</Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="map">
        <Icon sf={tabIcons.map} />
        <Label>Mapa</Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="list">
        <Icon sf={tabIcons.list} />
        <Label>Lista</Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="account">
        <Icon sf={tabIcons.account} />
        <Label>Conta</Label>
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
git add mobile/components/native-tab-layout.tsx
git commit -m "feat(mobile): dynamic SF Symbol icons in native tab bar from store"
```

---

### Task 5: Remove TAB_BAR_HEIGHT from screens

The floating tab bar had a custom height constant used by screens for scroll padding. Native tabs handle safe area automatically, so remove all `TAB_BAR_HEIGHT` imports and usages.

**Files:**
- Modify: `mobile/app/(tabs)/index.tsx` — remove import, replace `paddingBottom: TAB_BAR_HEIGHT + insets.bottom` with `paddingBottom: insets.bottom`
- Modify: `mobile/app/(tabs)/search.tsx` — same
- Modify: `mobile/app/(tabs)/list.tsx` — same
- Modify: `mobile/app/(tabs)/map.tsx` — remove import, replace `paddingBottom: TAB_BAR_HEIGHT + 16` with `paddingBottom: 16`
- Modify: `mobile/app/(tabs)/account.tsx` — remove import (will be fully reworked in Task 7)

**Step 1: In each file, remove the import line:**
```typescript
// DELETE this line:
import { TAB_BAR_HEIGHT } from '@/components/floating-tab-bar';
```

**Step 2: In each file, update paddingBottom:**

For index.tsx, search.tsx, list.tsx — change:
```typescript
paddingBottom: TAB_BAR_HEIGHT + insets.bottom,
```
to:
```typescript
paddingBottom: insets.bottom,
```

For map.tsx — change:
```typescript
paddingBottom: TAB_BAR_HEIGHT + 16,
```
to:
```typescript
paddingBottom: 16,
```

For account.tsx — change:
```typescript
paddingBottom: TAB_BAR_HEIGHT + insets.bottom,
```
to:
```typescript
paddingBottom: insets.bottom,
```

**Step 3: Commit**

```bash
git add mobile/app/(tabs)/index.tsx mobile/app/(tabs)/search.tsx mobile/app/(tabs)/list.tsx mobile/app/(tabs)/map.tsx mobile/app/(tabs)/account.tsx
git commit -m "refactor(mobile): remove TAB_BAR_HEIGHT — native tabs handle safe area"
```

---

### Task 6: Clean account.tsx — remove palette/tab-style selectors

**Files:**
- Modify: `mobile/app/(tabs)/account.tsx`

**Step 1: Remove these imports:**
- `import type { PaletteName } from '@/theme/palettes';`
- `import type { TabStyle } from '@/theme/store';`
- `import { TAB_BAR_HEIGHT } from '@/components/floating-tab-bar';` (already done in Task 5)

**Step 2: Remove these constants (lines 56-109):**
- `PALETTE_OPTIONS` array
- `TAB_STYLE_OPTIONS` array

**Step 3: Simplify the useTheme destructure (line 208):**

Change:
```typescript
const { tokens, palette, setPalette, tabStyle, setTabStyle } = useTheme();
```
to:
```typescript
const { tokens } = useTheme();
```

**Step 4: Remove the APARÊNCIA section (lines 436-504):**

Delete the entire `SectionHeader title="APARÊNCIA"` block, the `PALETTE_OPTIONS.map(...)` block, the `SectionHeader title="ESTILO DA BARRA"` block, and the `TAB_STYLE_OPTIONS.map(...)` block.

**Step 5: Commit**

```bash
git add mobile/app/(tabs)/account.tsx
git commit -m "refactor(mobile): remove palette and tab-style selectors from account"
```

---

### Task 7: Create icon-picker modal screen

**Files:**
- Create: `mobile/app/icon-picker.tsx`
- Modify: `mobile/app/_layout.tsx`

**Step 1: Create `mobile/app/icon-picker.tsx`**

This is a full-screen modal. It receives `tab` as a search param, shows a grid of SF Symbol options for that tab, and navigates back on selection.

```typescript
import { useLocalSearchParams, router } from 'expo-router';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Check, ChevronLeft } from 'lucide-react-native';
import { useTheme } from '@/theme/use-theme';
import { useThemeStore, type TabName } from '@/theme/store';
import { triggerHaptic } from '@/hooks/use-haptics';
import { ImpactFeedbackStyle } from 'expo-haptics';
import { Icon } from 'expo-router/unstable-native-tabs';

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
  map: ['mappin', 'map.fill', 'mappin.and.ellipse', 'mappin.circle.fill', 'location.fill'],
  list: ['checklist', 'list.bullet', 'list.clipboard.fill', 'cart.fill', 'basket.fill'],
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
    triggerHaptic(ImpactFeedbackStyle.Medium);
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
              <View style={styles.iconPreview}>
                <Icon sf={sfName} style={{ width: 32, height: 32 }} />
              </View>
              <Text
                style={[styles.iconName, { color: tokens.textSecondary }]}
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
  iconPreview: {
    marginBottom: 8,
  },
  iconName: {
    fontSize: 11,
    textAlign: 'center',
  },
  checkMark: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
});
```

**Note:** The `Icon` component from `expo-router/unstable-native-tabs` renders SF Symbols natively on iOS. If it doesn't work outside of `NativeTabs` context, we'll need to use `expo-symbols` or `@expo/vector-icons` instead. Test this during implementation — if `Icon` doesn't render standalone, install `expo-symbols` and use `SymbolView` from it:

```typescript
import { SymbolView } from 'expo-symbols';
// Then replace <Icon sf={sfName} ... /> with:
<SymbolView name={sfName} size={32} tintColor={tokens.primary} />
```

**Step 2: Register icon-picker in root layout**

In `mobile/app/_layout.tsx`, add:

```typescript
<Stack.Screen name="icon-picker" options={{ presentation: 'modal', headerShown: false }} />
```

After the existing `<Stack.Screen name="(business)" />` line.

**Step 3: Commit**

```bash
git add mobile/app/icon-picker.tsx mobile/app/_layout.tsx
git commit -m "feat(mobile): add icon-picker modal screen for tab icon customization"
```

---

### Task 8: Add ÍCONES section to account screen

**Files:**
- Modify: `mobile/app/(tabs)/account.tsx`

**Step 1: Add imports at top**

Add `router` to the expo-router import (if not already imported). The `useTheme` import already exists.

**Step 2: Add TAB_ICON_ROWS constant after PLUS_HIGHLIGHTS**

```typescript
import type { TabName } from '@/theme/store';

const TAB_ICON_ROWS: { tab: TabName; label: string }[] = [
  { tab: 'index', label: 'Início' },
  { tab: 'search', label: 'Busca' },
  { tab: 'map', label: 'Mapa' },
  { tab: 'list', label: 'Lista' },
  { tab: 'account', label: 'Conta' },
];
```

**Step 3: Destructure tabIcons from useTheme**

```typescript
const { tokens, tabIcons } = useTheme();
```

**Step 4: Add ÍCONES section in JSX**

Place this between the PREFERÊNCIAS section divider and the CONTA section. Replace the old APARÊNCIA section location:

```tsx
<SectionDivider style={{ marginVertical: 8 }} />

<SectionHeader title="ÍCONES" tokens={tokens} />

{TAB_ICON_ROWS.map((row) => (
  <Pressable
    key={row.tab}
    style={[styles.row, { borderBottomColor: tokens.border }]}
    onPress={() => {
      triggerHaptic(ImpactFeedbackStyle.Medium);
      router.push({ pathname: '/icon-picker', params: { tab: row.tab } });
    }}
    android_ripple={{ color: tokens.mist }}
  >
    <View style={styles.rowLeft}>
      <Text style={[styles.rowLabel, { color: tokens.textPrimary }]}>
        {row.label}
      </Text>
    </View>
    <View style={styles.rowRight}>
      <Text style={[styles.rowValue, { color: tokens.textHint }]}>
        {tabIcons[row.tab]}
      </Text>
      <ChevronRight size={18} color={tokens.textHint} />
    </View>
  </Pressable>
))}
```

**Step 5: Clean up unused imports and styles**

Remove these if no longer used:
- `Sparkles` from lucide (check if used in upgrade CTA — it is, keep it)
- Styles: `swatchRow`, `swatchCircle`, `paletteInfo`, `paletteDesc` — delete if no longer referenced

**Step 6: Commit**

```bash
git add mobile/app/(tabs)/account.tsx
git commit -m "feat(mobile): add ÍCONES section to account with per-tab drill-down"
```

---

### Task 9: Simplify themed components

Remove palette branching from components that checked `palette === 'encarte'` etc. Since only economia_verde remains, always use the default (non-encarte) path.

**Files:**
- Modify: `mobile/components/themed/discount-badge.tsx`
- Modify: `mobile/components/themed/deal-card.tsx`
- Modify: `mobile/components/themed/list-item.tsx`
- Modify: `mobile/components/themed/coupon-line.tsx`
- Modify: `mobile/hooks/use-theme-classes.ts`

**Step 1: Simplify discount-badge.tsx**

Remove palette check, always render `PillBadge`. Remove `StampBadge` import and `useTheme` import.

```typescript
import React from 'react';
import { PillBadge } from '../fintech/pill-badge';

interface DiscountBadgeProps {
  label: string;
  variant: 'discount' | 'highlight';
}

export function DiscountBadge({ label, variant }: DiscountBadgeProps) {
  return <PillBadge label={label} variant={variant} />;
}
```

**Step 2: Simplify deal-card.tsx**

Remove palette check, always use `CleanCard`. Remove `PriceTagCard` import. Remove `palette` from `useTheme()`.

Change line 45-46 from:
```typescript
const isEncarteStyle = palette === 'encarte' || palette === 'encarte_digital';
const CardComponent = isEncarteStyle ? PriceTagCard : CleanCard;
```
to:
```typescript
const CardComponent = CleanCard;
```

Remove `PriceTagCard` import. Change `const { palette, tokens } = useTheme()` to `const { tokens } = useTheme()`.

**Step 3: Simplify list-item.tsx**

Remove palette check, always use `RuleDivider`. Remove `ReceiptSeparator` import. Change `const { palette, tokens } = useTheme()` to `const { tokens } = useTheme()`.

Change lines 62-63 from:
```typescript
const isEncarte = palette === 'encarte' || palette === 'encarte_digital';
```
Remove this line.

Change lines 178-182 from:
```tsx
{isEncarte ? (
  <ReceiptSeparator style={styles.separator} />
) : (
  <RuleDivider spacing={0} />
)}
```
to:
```tsx
<RuleDivider spacing={0} />
```

**Step 4: Simplify coupon-line.tsx**

Remove palette check. For economia_verde, the scissors + dashed line is shown (not the fintech spacer). Change `const { palette, tokens } = useTheme()` to `const { tokens } = useTheme()`.

Remove lines 27-29:
```typescript
if (palette === 'fintech') {
  return <View style={[styles.fintechSpacer, style]} />;
}
```

Remove the `fintechSpacer` style definition.

**Step 5: Simplify use-theme-classes.ts**

Keep only `ECONOMIA_VERDE_CLASSES`. Remove all other class maps. Remove `PaletteName` import. The hook always returns the one set of classes.

```typescript
import { useMemo } from 'react';
import { useTheme } from '../theme/use-theme';

// ---------------------------------------------------------------------------
// Type
// ---------------------------------------------------------------------------

export interface ThemeClasses {
  bg: string;
  surface: string;
  headerBg: string;
  headerText: string;
  discountBg: string;
  textPrimary: string;
  textSecondary: string;
  textHint: string;
  border: string;
  separator: string;
  primaryButton: string;
  primaryButtonText: string;
  discountText: string;
  savingsText: string;
  goldText: string;
  goldBg: string;
  tabBarBg: string;
  tabBarActive: string;
  tabBarInactive: string;
}

// ---------------------------------------------------------------------------
// Economia Verde classes
// ---------------------------------------------------------------------------

const THEME_CLASSES: ThemeClasses = {
  bg: 'bg-[#F0FDFA]',
  surface: 'bg-white',
  headerBg: 'bg-[#0D9488]',
  headerText: 'text-white',
  discountBg: 'bg-[#FEF3C7]',
  textPrimary: 'text-[#1A1A2E]',
  textSecondary: 'text-[#475569]',
  textHint: 'text-[#94A3B8]',
  border: 'border-[#D1D5DB]',
  separator: 'border-solid border-[#D1D5DB]',
  primaryButton: 'bg-[#0D9488]',
  primaryButtonText: 'text-white',
  discountText: 'text-[#F59E0B]',
  savingsText: 'text-[#0D9488]',
  goldText: 'text-[#F59E0B]',
  goldBg: 'bg-[#FEF3C7]',
  tabBarBg: 'bg-white',
  tabBarActive: 'text-[#0D9488]',
  tabBarInactive: 'text-[#94A3B8]',
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useThemeClasses(): ThemeClasses {
  return THEME_CLASSES;
}
```

**Step 6: Commit**

```bash
git add mobile/components/themed/discount-badge.tsx mobile/components/themed/deal-card.tsx mobile/components/themed/list-item.tsx mobile/components/themed/coupon-line.tsx mobile/hooks/use-theme-classes.ts
git commit -m "refactor(mobile): remove palette branching — always Economia Verde"
```

---

### Task 10: Remove unused font imports (optional cleanup)

Since we kept only Economia Verde (which uses Poppins + Inter), the `Nunito_800ExtraBold` font was only used by encarte/encarte_digital palettes.

**Files:**
- Modify: `mobile/app/_layout.tsx`

**Step 1: Remove Nunito import and usage**

Remove:
```typescript
import { Nunito_800ExtraBold } from '@expo-google-fonts/nunito';
```

Remove `Nunito_800ExtraBold` from the `useFonts` call. Also remove `Poppins_800ExtraBold` if it's only referenced by removed palettes (check first — it may be used elsewhere).

**Step 2: Commit**

```bash
git add mobile/app/_layout.tsx
git commit -m "chore(mobile): remove unused Nunito font import"
```

---

### Task 11: Final verification

**Step 1: Run TypeScript check**

```bash
cd mobile && npx tsc --noEmit
```

Fix any type errors from removed exports (`PaletteName`, `TabStyle`, etc.). Common fixes:
- Any file importing `PaletteName` — remove the import
- Any file importing `TabStyle` — remove the import
- Any file destructuring `palette` from `useTheme()` — update destructure

**Step 2: Run lint**

```bash
cd mobile && npx expo lint
```

**Step 3: Commit any fixes**

```bash
git add -A
git commit -m "fix(mobile): resolve type errors from theme simplification"
```
