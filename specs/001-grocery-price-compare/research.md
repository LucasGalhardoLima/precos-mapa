# Research: Grocery Price Comparison — Consumer App Demo

**Feature**: `001-grocery-price-compare`
**Date**: 2026-02-10

## R1: Expo SDK Version

**Decision**: Expo SDK 52+ (latest stable at time of implementation)
**Rationale**: SDK 52 ships with React Native 0.76+ and has New
Architecture enabled by default. It's the latest stable SDK with
broad library compatibility. SDK 55 beta exists but is not stable
enough for a demo delivery.
**Alternatives considered**:
- SDK 55 beta: Too new, risk of library incompatibilities
- Bare React Native (no Expo): Unnecessary complexity for a demo;
  Expo managed workflow handles native modules via config plugins

## R2: Map Library — react-native-maps

**Decision**: `react-native-maps` via Expo config plugin
**Rationale**: The standard, well-maintained map library for React
Native. Works with Expo managed workflow (no ejecting). Supports
Google Maps on Android and Apple Maps on iOS. Requires a Google Maps
API key configured in `app.json` for Android builds.
**Alternatives considered**:
- Mapbox React Native: More customizable but requires paid API key
  and more complex setup; overkill for a demo with 4 markers
- WebView + Leaflet: Cross-platform but loses native performance
  and gesture integration

## R3: Styling — NativeWind v4

**Decision**: NativeWind v4 with Tailwind CSS 3.4.x
**Rationale**: Brings Tailwind utility classes to React Native,
compiling to RN StyleSheet. Aligns with the admin panel's Tailwind
approach for design token consistency. v4 is stable and compatible
with Expo SDK 52+. Requires `react-native-reanimated` and
`react-native-safe-area-context` (both already needed).
**Important**: NativeWind v4 uses Tailwind CSS 3.4.x (NOT Tailwind
v4.x which is for NativeWind v5). The mobile app's `tailwind.config.ts`
will share color palette and spacing tokens with the web admin but
in Tailwind v3 config format.
**Alternatives considered**:
- StyleSheet directly: Verbose, no design token system
- Tamagui: Full design system but heavy for a demo
- Unistyles: Lighter but less community adoption than NativeWind

## R4: Navigation — Expo Router

**Decision**: Expo Router with file-based routing
**Rationale**: File-based routing (same paradigm as Next.js App Router
in the admin panel). Native tab support via `(tabs)/` directory
convention. Extends React Navigation Bottom Tabs v7. No additional
navigation library needed.
**Alternatives considered**:
- React Navigation directly: Works but requires manual route
  configuration; Expo Router wraps it with file conventions
- React Native Navigation (Wix): Better native performance but
  incompatible with Expo managed workflow

## R5: Icons — lucide-react-native

**Decision**: `lucide-react-native`
**Rationale**: Official Lucide package for React Native. 1,500+ icons,
actively maintained, built on `react-native-svg`. Same icon set as
`lucide-react` used in the admin panel — ensures visual consistency
across platforms. Tree-shakable for bundle size.
**Alternatives considered**:
- @expo/vector-icons: Bundled with Expo but uses bitmap icons;
  less crisp at non-standard sizes
- react-native-vector-icons: Requires native linking; lucide-react-
  native is simpler via SVG

## R6: Bottom Sheet — @gorhom/bottom-sheet

**Decision**: `@gorhom/bottom-sheet` v5
**Rationale**: Industry-standard bottom sheet for React Native.
Performant (uses Reanimated), fully configurable, Expo-compatible,
TypeScript-first. Perfect for the map marker detail sheet (US2).
**Alternatives considered**:
- Custom sheet with Reanimated: More work for equivalent result
- react-native-modal: Not a bottom sheet; different UX pattern
- @expo/bottom-sheet: Does not exist as a separate package

## R7: Animation Library

**Decision**: `react-native-reanimated` (required by NativeWind and
bottom sheet) + `moti` for declarative animations
**Rationale**: Reanimated is already a transitive dependency of
NativeWind v4 and @gorhom/bottom-sheet. Moti provides a
framer-motion-like API for React Native, enabling consistent
animation patterns with the admin panel's motion approach. Both
are Expo-compatible.
**Alternatives considered**:
- Animated (RN built-in): Less capable, no shared worklets
- react-native-animatable: Simpler but less flexible

## R8: Mock Data Architecture

**Decision**: Typed TypeScript modules in `mobile/data/` exporting
arrays of strongly-typed objects. A thin `hooks/use-search.ts` layer
provides filtering/sorting logic that simulates API behavior.
**Rationale**: For a demo, hardcoded data modules are the simplest
approach. TypeScript types ensure the mock data matches the production
data model, making migration to a real API straightforward. Hooks
abstract the data access so swapping to real `fetch` calls later
requires changing only the hook internals.
**Alternatives considered**:
- JSON files: Lose TypeScript type safety
- MSW (Mock Service Worker): Overkill for a demo with no network
- AsyncStorage: Unnecessary persistence layer for hardcoded data

## Dependency Summary

| Package | Purpose | Version |
|---------|---------|---------|
| expo | Managed RN framework | ~52 |
| expo-router | File-based navigation | ~4 |
| react-native-maps | Interactive map | ~2 |
| nativewind | Tailwind CSS for RN | ~4 |
| tailwindcss | Utility CSS engine | ~3.4 |
| @gorhom/bottom-sheet | Map detail sheet | ~5 |
| react-native-reanimated | Animation runtime | ~3 |
| moti | Declarative animations | ~0.30 |
| lucide-react-native | Icon library | latest |
| react-native-svg | SVG rendering (icons) | latest |
| zustand | Client state management | ~5 |
| react-native-safe-area-context | Safe area insets | latest |
| react-native-gesture-handler | Gesture support | latest |
