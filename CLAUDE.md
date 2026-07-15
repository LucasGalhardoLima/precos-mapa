# Poup Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-02-11

## Active Technologies
- TypeScript 5.9 (strict mode) (001-grocery-price-compare)
- Supabase PostgreSQL with Row Level Security (001-grocery-price-compare)
- Expo SDK 54, React Native 0.81, NativeWind v4 (001-grocery-price-compare)
- TypeScript 5.9 (strict mode) + Expo SDK 54, React Native 0.81, NativeWind v4 (Tailwind CSS 3.4.x), Expo Router v6, Zustand v5, Moti 0.30, react-native-reanimated 4.1, react-native-svg 15.12, react-native-maps 1.20, @gorhom/bottom-sheet 5.2, lucide-react-native 0.563, react-native-purchases 9.8 (002-b2c-consumer-ui)
- Supabase PostgreSQL (existing), AsyncStorage for theme persistence (002-b2c-consumer-ui)
- TypeScript 5.9 (strict mode) across mobile (React Native) and admin (Next.js) + Next.js 16 (App Router) + React 19 for the admin panel; Expo SDK 54 / React Native 0.81 / Expo Router v6 for mobile; `@supabase/supabase-js` (existing client) for all data access; Zod for any new input validation; Zustand only if new client state is genuinely needed (not expected — this is server-data-driven) (014-usage-hotzones)
- Supabase PostgreSQL — extends the existing `analytics_events` table (adds a nullable `region` column) and adds two new views/RPCs (`product_engagement_summary`, a geo-grouped view/RPC) alongside the existing `store_engagement_summary` (014-usage-hotzones)

## Project Structure

```text
src/                    # Next.js admin panel
mobile/                 # Expo consumer + business app
supabase/               # Supabase migrations, edge functions, seed
specs/                  # Feature specifications
```

## Commands

npm test && npm run lint

## Code Style

TypeScript 5.9 (strict mode): Follow standard conventions

## Recent Changes
- 014-usage-hotzones: Added TypeScript 5.9 (strict mode) across mobile (React Native) and admin (Next.js) + Next.js 16 (App Router) + React 19 for the admin panel; Expo SDK 54 / React Native 0.81 / Expo Router v6 for mobile; `@supabase/supabase-js` (existing client) for all data access; Zod for any new input validation; Zustand only if new client state is genuinely needed (not expected — this is server-data-driven)
- 002-b2c-consumer-ui: Added TypeScript 5.9 (strict mode) + Expo SDK 54, React Native 0.81, NativeWind v4 (Tailwind CSS 3.4.x), Expo Router v6, Zustand v5, Moti 0.30, react-native-reanimated 4.1, react-native-svg 15.12, react-native-maps 1.20, @gorhom/bottom-sheet 5.2, lucide-react-native 0.563, react-native-purchases 9.8
- 001-grocery-price-compare: Added TypeScript 5.9 (strict mode)

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
