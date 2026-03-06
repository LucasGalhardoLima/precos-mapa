# Liquid Glass Tab Bar with Dev Toggle

Date: 2026-03-06
Branch: 002-b2c-ux-refinements

## Summary

Add iOS 26 Liquid Glass support to the tab bar with a dev toggle to compare two implementations: custom GlassView pill vs native Expo Router tabs.

## Option A: GlassView Custom Pill

Replace `BlurView` (expo-blur) with `GlassView` (expo-glass-effect) in the existing floating pill tab bar. On iOS 26+ this renders real Liquid Glass material via native UIVisualEffectView. On older iOS/Android it falls back to a regular View with semi-transparent overlay.

- Keep our custom pill shape, margins, border radius, icon scale animation
- `glassEffectStyle="regular"` for the standard glass material
- Fallback: detect with `isLiquidGlassAvailable()`, render tintOverlay when false

## Option B: Native Tabs (Expo Router)

Replace the entire tab layout with `NativeTabs` from `expo-router/unstable-native-tabs`. Gets Liquid Glass for free on iOS 26, plus native behaviors (scroll-to-top, pop-to-root, minimize-on-scroll).

- SF Symbol icons: house.fill, magnifyingglass, mappin, checklist, person
- Standard iOS tab bar layout (full width, system-managed, no pill shape)
- Hidden routes handled via `hidden` prop instead of `href: null`
- API is unstable but functional in SDK 54

## Dev Toggle

- New `tabStyle` setting in theme store: `'glass-pill' | 'native'` (default: 'glass-pill')
- `_layout.tsx` conditionally renders `Tabs` + `FloatingTabBar` or `NativeTabs`
- Toggle in Account screen under "Aparencia" section labeled "Estilo da Barra"
- Switching causes navigator remount (acceptable for evaluation)

## Files Changed

- `mobile/package.json` — add expo-glass-effect
- `mobile/components/floating-tab-bar.tsx` — BlurView -> GlassView with fallback
- `mobile/app/(tabs)/_layout.tsx` — conditional rendering based on tabStyle
- `mobile/theme/store.ts` — add tabStyle to theme store
- `mobile/app/(tabs)/account.tsx` — add tab style picker UI
