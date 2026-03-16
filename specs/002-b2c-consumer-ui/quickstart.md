# Quickstart: POUP B2C Consumer UI

**Branch**: `002-b2c-consumer-ui` | **Date**: 2026-03-02

## Prerequisites

- Node.js 20+
- Expo CLI (`npx expo`)
- iOS Simulator (Xcode 16+) or Android Emulator (API 26+)
- Supabase local instance running (`supabase start` from repo root)

## Setup

```bash
# 1. Switch to feature branch
git checkout 002-b2c-consumer-ui

# 2. Install root dependencies
npm install

# 3. Install mobile dependencies
cd mobile && npm install --legacy-peer-deps

# 4. Start Supabase (from repo root)
cd .. && supabase start

# 5. Seed database with test data
supabase db reset

# 6. Start Expo dev server
cd mobile && npx expo start
```

## Development Workflow

### Running on iOS Simulator
```bash
cd mobile && npx expo run:ios
```

### Running on Android Emulator
```bash
cd mobile && npx expo run:android
```

### Running Tests
```bash
# From repo root
npm test

# Specific test file
npx vitest run mobile/theme/__tests__/store.test.ts
```

### Type Checking
```bash
npx tsc --noEmit
```

## Key File Locations

| What | Where |
|------|-------|
| Theme tokens (both palettes) | `mobile/theme/palettes.ts` |
| Theme store (Zustand) | `mobile/theme/store.ts` |
| Theme provider (Context) | `mobile/theme/provider.tsx` |
| useTheme hook | `mobile/theme/use-theme.ts` |
| useThemeClasses hook | `mobile/hooks/use-theme-classes.ts` |
| Tailwind config (colors) | `mobile/tailwind.config.ts` |
| Shared color constants | `packages/shared/src/constants/colors.ts` |
| Floating tab bar | `mobile/components/floating-tab-bar.tsx` |
| Tab layout | `mobile/app/(tabs)/_layout.tsx` |
| Encarte components | `mobile/components/encarte/` |
| Fintech components | `mobile/components/fintech/` |
| Themed wrappers | `mobile/components/themed/` |

## Testing Theme Switch

1. Open the app in a simulator
2. Navigate to the Conta (Account) tab
3. Find the palette toggle in developer settings (or use the toggle in the component gallery during development)
4. Toggle between "Encarte" and "Fintech"
5. Navigate to each tab and verify colors, backgrounds, and visual metaphors update correctly

## Architecture Notes

### Theming

The theming system has 3 layers:
1. **Store** (`theme/store.ts`): Zustand with AsyncStorage persistence. Holds `palette: 'encarte' | 'fintech'`
2. **Context** (`theme/provider.tsx`): Wraps the app root. Provides `tokens` (hex values) and `palette` name via React Context
3. **Class hook** (`hooks/use-theme-classes.ts`): Maps semantic keys to Tailwind class strings for the active palette

Components use whichever layer they need:
- NativeWind components: `useThemeClasses()` for class names
- StyleSheet components: `useTheme()` for hex values
- SVG components: `useTheme()` for hex values

### Visual Metaphors

Palette-specific visual elements (price tag cards, barcode dividers, stamp badges) live in separate directories:
- `components/encarte/` — SVG-based decorative shapes
- `components/fintech/` — Clean View-based equivalents

The `components/themed/` directory contains wrapper components that delegate to the correct variant based on the active palette:

```tsx
// components/themed/deal-card.tsx
const { palette } = useTheme();
return palette === 'encarte'
  ? <PriceTagCard {...props} />
  : <CleanCard {...props} />;
```

### Tab Bar

The floating tab bar is a custom component passed to Expo Router's `<Tabs tabBar={...}>`. Content in tab screens must include bottom padding equal to `TAB_BAR_HEIGHT` (exported from `floating-tab-bar.tsx`) to prevent content from being hidden.

### Economy Summary

The `useEconomySummary` hook uses a hybrid calculation:
- If the user has shopping list items → savings = Σ (reference − cheapest promo per item)
- If the list is empty → savings = total discount from nearby active deals
