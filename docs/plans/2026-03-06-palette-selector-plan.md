# Palette Selector + Fonts — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Expand the mobile app's theme system from 2 to 5 palettes with a refined 20-token schema, per-palette display fonts, and an inline palette selector UI.

**Architecture:** Extend the existing Zustand + AsyncStorage theme system. Update the `PaletteTokens` type with semantic names (accent, primaryMuted, etc.), add 3 new palette definitions, load Google Fonts via expo-font, and replace the palette toggle with a scrollable selector list in the Account tab. All 12 component files using old token names get a find-and-replace rename.

**Tech Stack:** React Native, Zustand, expo-font, @expo-google-fonts/{poppins,nunito,inter}

**Design doc:** `docs/plans/2026-03-06-palette-selector-design.md`

---

## Task 1: Install font packages

**Files:**
- Modify: `mobile/package.json`

**Step 1: Install expo-font and Google Font packages**

Run from `mobile/` directory:

```bash
cd mobile && npx expo install expo-font @expo-google-fonts/poppins @expo-google-fonts/nunito @expo-google-fonts/inter
```

**Step 2: Verify installation**

Run: `ls node_modules/@expo-google-fonts/poppins/index.js`
Expected: File exists.

**Step 3: Commit**

```bash
git add mobile/package.json mobile/package-lock.json
git commit -m "chore(mobile): install expo-font and Google Font packages"
```

---

## Task 2: Update PaletteTokens type and all 5 palette definitions

**Files:**
- Modify: `mobile/theme/palettes.ts` (full rewrite)

**Step 1: Rewrite palettes.ts**

Replace the entire file with the new 20-token type, 5 palette definitions, and font token fields.

The `PaletteName` union type is: `'encarte' | 'fintech' | 'economia_verde' | 'encarte_digital' | 'fintech_moderna'`

New token type includes:
- `name: PaletteName`
- `fontDisplay: string` — font family for headings/titles
- `fontBody: string` — font family for body text
- `fontBodyMedium: string` — medium weight body font
- Renamed: `primaryLight` → `primaryMuted`, `discountRed/Active` → `accent`, `discountRedSoft` → `accentSoft`
- New: `primaryHover`, `accent`, `accentSoft`, `success`, `danger`, `warning`, `muted`
- Removed: `gold`, `goldBright`, `goldLight`

```typescript
/**
 * Semantic palette tokens for multi-theme support.
 *
 * Components reference semantic keys (e.g. `tokens.primary`, `tokens.accent`)
 * so they work identically under any visual palette.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PaletteName =
  | 'encarte'
  | 'fintech'
  | 'economia_verde'
  | 'encarte_digital'
  | 'fintech_moderna';

export type PaletteTokens = {
  name: PaletteName;

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
// Shared functional colors (same across all palettes)
// ---------------------------------------------------------------------------

const SHARED = {
  success: '#16A34A',
  danger: '#EF4444',
  warning: '#F59E0B',
  muted: '#64748B',
} as const;

// ---------------------------------------------------------------------------
// Palette: Encarte — warm paper & chalk tones
// ---------------------------------------------------------------------------

export const ENCARTE_TOKENS: PaletteTokens = {
  name: 'encarte',
  fontDisplay: 'Nunito_800ExtraBold',
  fontBody: 'Inter_400Regular',
  fontBodyMedium: 'Inter_500Medium',

  bg: '#FAF7F0',
  surface: '#FFFFFF',
  textPrimary: '#1E2820',
  textSecondary: '#4A5568',
  textHint: '#8A97A8',
  primary: '#2A6041',
  primaryHover: '#3A7A55',
  primaryMuted: '#E2F5EC',
  accent: '#C8392B',
  accentSoft: '#FDEAEC',
  header: '#1E2820',
  headerText: '#FFFFFF',
  border: '#E2E8F0',
  ...SHARED,
  dark: '#1E2820',
  darkSurface: '#2A3530',
  mist: '#F1F5F9',
};

// ---------------------------------------------------------------------------
// Palette: Fintech — cool graphite & deep green
// ---------------------------------------------------------------------------

export const FINTECH_TOKENS: PaletteTokens = {
  name: 'fintech',
  fontDisplay: 'Inter_500Medium',
  fontBody: 'Inter_400Regular',
  fontBodyMedium: 'Inter_500Medium',

  bg: '#FAFBFC',
  surface: '#F2F4F7',
  textPrimary: '#0D1520',
  textSecondary: '#4A5568',
  textHint: '#8A97A8',
  primary: '#0B5E3A',
  primaryHover: '#167A4D',
  primaryMuted: '#E2F5EC',
  accent: '#C8192B',
  accentSoft: '#FDEAEC',
  header: '#0B5E3A',
  headerText: '#FFFFFF',
  border: '#DDE2EA',
  ...SHARED,
  dark: '#0C1829',
  darkSurface: '#162438',
  mist: '#E8EDF5',
};

// ---------------------------------------------------------------------------
// Palette: Economia Verde — teal + golden yellow
// ---------------------------------------------------------------------------

export const ECONOMIA_VERDE_TOKENS: PaletteTokens = {
  name: 'economia_verde',
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

// ---------------------------------------------------------------------------
// Palette: Encarte Digital — green + red promos
// ---------------------------------------------------------------------------

export const ENCARTE_DIGITAL_TOKENS: PaletteTokens = {
  name: 'encarte_digital',
  fontDisplay: 'Nunito_800ExtraBold',
  fontBody: 'Inter_400Regular',
  fontBodyMedium: 'Inter_500Medium',

  bg: '#ECFDF5',
  surface: '#FFFFFF',
  textPrimary: '#1E293B',
  textSecondary: '#4A5568',
  textHint: '#8A97A8',
  primary: '#059669',
  primaryHover: '#10B981',
  primaryMuted: '#D1FAE5',
  accent: '#EF4444',
  accentSoft: '#FEE2E2',
  header: '#059669',
  headerText: '#FFFFFF',
  border: '#E2E8F0',
  ...SHARED,
  dark: '#1E293B',
  darkSurface: '#334155',
  mist: '#ECFDF5',
};

// ---------------------------------------------------------------------------
// Palette: Fintech Moderna — cyan + purple
// ---------------------------------------------------------------------------

export const FINTECH_MODERNA_TOKENS: PaletteTokens = {
  name: 'fintech_moderna',
  fontDisplay: 'Poppins_700Bold',
  fontBody: 'Inter_400Regular',
  fontBodyMedium: 'Inter_500Medium',

  bg: '#F0F9FF',
  surface: '#FFFFFF',
  textPrimary: '#0F172A',
  textSecondary: '#4A5568',
  textHint: '#8A97A8',
  primary: '#0891B2',
  primaryHover: '#22D3EE',
  primaryMuted: '#CFFAFE',
  accent: '#8B5CF6',
  accentSoft: '#EDE9FE',
  header: '#0891B2',
  headerText: '#FFFFFF',
  border: '#E2E8F0',
  ...SHARED,
  dark: '#0F172A',
  darkSurface: '#1E293B',
  mist: '#F0F9FF',
};
```

**Step 2: Verify no TypeScript errors**

Run: `cd mobile && npx tsc --noEmit 2>&1 | head -20`
Expected: Errors about old token names in consumers (expected — fixed in later tasks).

**Step 3: Commit**

```bash
git add mobile/theme/palettes.ts
git commit -m "feat(mobile): rewrite palette tokens with 20-token schema and 5 palettes"
```

---

## Task 3: Update theme store, hook, and provider for 5 palettes

**Files:**
- Modify: `mobile/theme/store.ts`
- Modify: `mobile/theme/use-theme.ts`
- Modify: `mobile/theme/provider.tsx`

**Step 1: Update store.ts**

Replace the palette union type and remove `togglePalette` (replaced by `setPalette`):

```typescript
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PaletteName } from './palettes';

interface ThemeState {
  palette: PaletteName;
  setPalette: (palette: PaletteName) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      palette: 'economia_verde',
      setPalette: (palette) => set({ palette }),
    }),
    {
      name: 'poup-theme',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
```

**Step 2: Update use-theme.ts**

Add all 5 palettes to TOKEN_MAP, return `setPalette` instead of `togglePalette`:

```typescript
import { useThemeStore } from './store';
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
} {
  const palette = useThemeStore((s) => s.palette);
  const setPalette = useThemeStore((s) => s.setPalette);

  return {
    palette,
    tokens: TOKEN_MAP[palette],
    setPalette,
  };
}
```

**Step 3: Update provider.tsx**

Update the context type to use `PaletteName` and `setPalette`:

```typescript
import React, { createContext, useContext } from 'react';
import type { PaletteName, PaletteTokens } from './palettes';
import { useTheme } from './use-theme';

interface ThemeContextValue {
  palette: PaletteName;
  tokens: PaletteTokens;
  setPalette: (palette: PaletteName) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const value = useTheme();
  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
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
git add mobile/theme/store.ts mobile/theme/use-theme.ts mobile/theme/provider.tsx
git commit -m "feat(mobile): update theme store, hook, and provider for 5 palettes"
```

---

## Task 4: Load fonts in root layout

**Files:**
- Modify: `mobile/app/_layout.tsx`

**Step 1: Add font loading with useFonts**

Import the font hooks and add `useFonts` to the root layout. Show loading indicator until fonts are ready. Expo's `useFonts` from `expo-font` accepts a map of font names to `require()` calls. The `@expo-google-fonts/*` packages export individual font names.

```typescript
import '../global.css';
import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import {
  Poppins_700Bold,
  Poppins_800ExtraBold,
} from '@expo-google-fonts/poppins';
import { Nunito_800ExtraBold } from '@expo-google-fonts/nunito';
import {
  Inter_400Regular,
  Inter_500Medium,
} from '@expo-google-fonts/inter';
import { useAuth } from '@/hooks/use-auth';
import { useAuthStore } from '@poup/shared';
import { ActivityIndicator, View } from 'react-native';

export default function RootLayout() {
  const { isLoading } = useAuth();
  const hasSeenOnboarding = useAuthStore((s) => s.hasSeenOnboarding);

  const [fontsLoaded] = useFonts({
    Poppins_700Bold,
    Poppins_800ExtraBold,
    Nunito_800ExtraBold,
    Inter_400Regular,
    Inter_500Medium,
  });

  if (isLoading || !fontsLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color="#22C55E" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <BottomSheetModalProvider>
          <StatusBar style="dark" />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="onboarding" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="(business)" />
          </Stack>
        </BottomSheetModalProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
```

**Step 2: Commit**

```bash
git add mobile/app/_layout.tsx
git commit -m "feat(mobile): load Poppins, Nunito, Inter fonts via expo-font"
```

---

## Task 5: Rename tokens in all 10 consumer component files

**Files to modify (10 files, exact token renames):**

The renames are mechanical find-and-replace within each file:

| Old token | New token |
|-----------|-----------|
| `tokens.discountRed` | `tokens.accent` |
| `tokens.discountRedActive` | `tokens.accent` |
| `tokens.discountRedSoft` | `tokens.accentSoft` |
| `tokens.primaryLight` | `tokens.primaryMuted` |
| `tokens.gold` | `tokens.warning` |
| `tokens.goldBright` | `tokens.warning` |
| `tokens.goldLight` | `tokens.accentSoft` |

**Step 1: Apply renames in each file**

Files and their specific renames:

1. **`mobile/components/search-results.tsx:100`**
   - `tokens.discountRed` → `tokens.accent`

2. **`mobile/components/encarte/stamp-badge.tsx:25-27`**
   - `tokens.discountRed` → `tokens.accent` (2 occurrences)
   - `tokens.discountRedSoft` → `tokens.accentSoft`
   - `tokens.primaryLight` → `tokens.primaryMuted`

3. **`mobile/components/fintech/pill-badge.tsx:20-21`**
   - `tokens.discountRedSoft` → `tokens.accentSoft`
   - `tokens.primaryLight` → `tokens.primaryMuted`
   - `tokens.discountRedActive` → `tokens.accent`

4. **`mobile/components/price-chart.tsx`**
   - `tokens.discountRed` → `tokens.accent` (5 occurrences on lines 176, 251, 257, 292, 340)
   - `tokens.primaryLight` → `tokens.primaryMuted` (1 occurrence on line 349)

5. **`mobile/components/themed/deal-card.tsx:74`**
   - `tokens.discountRed` → `tokens.accent`

6. **`mobile/components/themed/list-item.tsx:80`**
   - `tokens.primaryLight` → `tokens.primaryMuted`

7. **`mobile/components/inline-error.tsx:37`**
   - `tokens.discountRedSoft` → `tokens.accentSoft`

8. **`mobile/components/paywall.tsx:192`**
   - `tokens.goldBright` → `tokens.warning`

9. **`mobile/app/(tabs)/map.tsx:188,344`**
   - `tokens.primaryLight` → `tokens.primaryMuted` (2 occurrences)

10. **`mobile/tailwind.config.ts:66`**
    - Remove `gold` key from `fintech` color block (it's no longer a palette token; Tailwind config is separate from runtime tokens)

**Step 2: Verify no TypeScript errors**

Run: `cd mobile && npx tsc --noEmit 2>&1 | head -20`
Expected: No errors related to token names. Remaining errors may be about `togglePalette` in `account.tsx` (fixed in Task 6).

**Step 3: Commit**

```bash
git add mobile/components/ mobile/app/(tabs)/map.tsx mobile/tailwind.config.ts
git commit -m "refactor(mobile): rename old token names to new semantic tokens"
```

---

## Task 6: Rewrite account.tsx palette selector and token renames

**Files:**
- Modify: `mobile/app/(tabs)/account.tsx`

This file has the most changes: token renames (14 occurrences of old tokens) AND the new palette selector UI replacing the toggle.

**Step 1: Update imports**

Remove `togglePalette` from useTheme destructuring, add `setPalette`. Import `PaletteName` type.

```typescript
import type { PaletteName } from '@/theme/palettes';
```

**Step 2: Apply token renames**

All `tokens.gold` → `tokens.warning`, `tokens.goldBright` → `tokens.warning`, `tokens.goldLight` → `tokens.accentSoft`, `tokens.discountRed` → `tokens.accent`, `tokens.primaryLight` → `tokens.primaryMuted` throughout the file.

**Step 3: Replace palette toggle with selector**

Remove the `handleTogglePalette` callback and the single `SettingsRow` for "Paleta visual".

Add a new `PaletteSelector` inline component and render it in the PREFERÊNCIAS section. The palette metadata (display name, description, colors for swatch) is defined as a constant array:

```typescript
const PALETTE_OPTIONS: {
  value: PaletteName;
  label: string;
  description: string;
  colors: [string, string, string]; // [primary, accent, bg]
}[] = [
  {
    value: 'economia_verde',
    label: 'Economia Verde',
    description: 'Teal e dourado. Confiança e economia.',
    colors: ['#0D9488', '#F59E0B', '#F0FDFA'],
  },
  {
    value: 'encarte',
    label: 'Encarte',
    description: 'Verde floresta e papel. Clássico de mercado.',
    colors: ['#2A6041', '#C8392B', '#FAF7F0'],
  },
  {
    value: 'encarte_digital',
    label: 'Encarte Digital',
    description: 'Verde vibrante e vermelho. Familiar brasileiro.',
    colors: ['#059669', '#EF4444', '#ECFDF5'],
  },
  {
    value: 'fintech',
    label: 'Fintech',
    description: 'Grafite e verde profundo. App financeiro.',
    colors: ['#0B5E3A', '#C8192B', '#FAFBFC'],
  },
  {
    value: 'fintech_moderna',
    label: 'Fintech Moderna',
    description: 'Cyan e roxo. Premium digital.',
    colors: ['#0891B2', '#8B5CF6', '#F0F9FF'],
  },
];
```

Replace the palette SettingsRow with:

```tsx
<SectionHeader title="APARÊNCIA" tokens={tokens} />

{PALETTE_OPTIONS.map((opt) => {
  const isSelected = palette === opt.value;
  return (
    <Pressable
      key={opt.value}
      style={[styles.row, { borderBottomColor: tokens.border }]}
      onPress={() => {
        triggerHaptic(ImpactFeedbackStyle.Medium);
        setPalette(opt.value);
      }}
      android_ripple={{ color: tokens.mist }}
    >
      <View style={styles.rowLeft}>
        <View style={styles.swatchRow}>
          {opt.colors.map((c, i) => (
            <View
              key={i}
              style={[
                styles.swatchCircle,
                { backgroundColor: c, borderColor: tokens.border },
              ]}
            />
          ))}
        </View>
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

**Step 4: Add new styles**

```typescript
swatchRow: {
  flexDirection: 'row',
  gap: 4,
},
swatchCircle: {
  width: 20,
  height: 20,
  borderRadius: 10,
  borderWidth: 1,
},
paletteInfo: {
  flex: 1,
},
paletteDesc: {
  fontSize: 12,
  marginTop: 1,
},
```

**Step 5: Verify no TypeScript errors**

Run: `cd mobile && npx tsc --noEmit`
Expected: PASS

**Step 6: Commit**

```bash
git add mobile/app/(tabs)/account.tsx
git commit -m "feat(mobile): palette selector UI with 5 palettes and token renames"
```

---

## Task 7: Update DealCard palette branching for new palette names

**Files:**
- Modify: `mobile/components/themed/deal-card.tsx`

The current DealCard checks `palette === 'encarte'` to pick PriceTagCard vs CleanCard. With 5 palettes, update the logic so encarte-style palettes use PriceTagCard and fintech-style ones use CleanCard.

**Step 1: Update the card selection logic**

```typescript
const isEncarteStyle = palette === 'encarte' || palette === 'encarte_digital';
const CardComponent = isEncarteStyle ? PriceTagCard : CleanCard;
```

**Step 2: Commit**

```bash
git add mobile/components/themed/deal-card.tsx
git commit -m "feat(mobile): support new palette names in DealCard card selection"
```

---

## Task 8: Update Tailwind config and final TypeScript check

**Files:**
- Modify: `mobile/tailwind.config.ts`

**Step 1: Update Tailwind fontFamily to include loaded fonts**

```typescript
fontFamily: {
  sans: ['Inter_400Regular'],
  'sans-medium': ['Inter_500Medium'],
  display: ['Poppins_700Bold'],
  'display-bold': ['Poppins_800ExtraBold'],
  'display-warm': ['Nunito_800ExtraBold'],
},
```

**Step 2: Clean up old gold references from fintech colors**

Remove the `gold`, `brightGold`, `lightGold` entries from the fintech color block since they're no longer palette tokens.

**Step 3: Run full TypeScript check**

Run: `cd mobile && npx tsc --noEmit`
Expected: PASS with no errors.

**Step 4: Commit**

```bash
git add mobile/tailwind.config.ts
git commit -m "chore(mobile): update Tailwind config with font families and remove old gold tokens"
```
