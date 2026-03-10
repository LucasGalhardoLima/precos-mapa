# iOS 26 Native Features Adoption — Design

**Goal:** Leverage iOS 26 platform features (Liquid Glass, tab bar minimize, zoom transitions, snappier springs) to make the app feel native and modern on iOS 26+, with graceful fallback on older versions.

**Tech:** expo-glass-effect (GlassView/GlassContainer), expo-router NativeTabs minimizeBehavior, Stack zoom animation, Moti spring configs.

---

## Feature 1: Tab bar minimize on scroll

Add `minimizeBehavior="onScrollDown"` to `NativeTabs` in `native-tab-layout.tsx`. One-line change. Tab bar shrinks when user scrolls content down, expands on scroll up.

## Feature 2: Liquid Glass surfaces

Use `GlassView` from `expo-glass-effect` with `isLiquidGlassAvailable()` runtime check. Falls back to current solid styling on older iOS / Android.

Surfaces:
- "Ver minha lista" floating pill (map.tsx) — GlassView with green tintColor
- Search bar (search.tsx) — GlassView background
- Sort/filter pills (search.tsx) — inactive pills get glass, active stays solid primary
- Location permission banner (map.tsx) — GlassView card

## Feature 3: Zoom transition for product detail

Add `animation: 'zoom'` to the `product/[id]` Stack.Screen options in `_layout.tsx`. Native iOS zoom from tapped card into detail screen.

## Feature 4: Glass bottom sheets

On map's bottom sheets (store detail + list panel):
- Set `backgroundStyle={{ backgroundColor: 'transparent' }}`
- Wrap sheet content in `GlassView`
- Falls back to current white bg on non-iOS 26

## Feature 5: iOS 26 spring curves

Update Moti animation configs for snappier feel:
- Springs: higher stiffness (200+), lower damping (12-15)
- Timing: reduce 400-800ms to 250-400ms
- Target: deal cards, list items, carousel, onboarding entrance animations
