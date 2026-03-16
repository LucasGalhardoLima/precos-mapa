# Implementation Plan: POUP B2C Consumer UI

**Branch**: `002-b2c-consumer-ui` | **Date**: 2026-03-02 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-b2c-consumer-ui/spec.md`

## Summary

Redesign the B2C consumer mobile app with a dual-palette theming system (Encarte supermarket vs Fintech clean), themed visual metaphor components, floating navbar, and 8 redesigned screens (Onboarding, Home, Search, Map, List, Detail, Account, Paywall). Reuses existing Supabase data layer and hooks; adds new hooks for economy summary and store ranking. Animation/haptics are enhancement priority, implemented after core screens.

## Technical Context

**Language/Version**: TypeScript 5.9 (strict mode)
**Primary Dependencies**: Expo SDK 54, React Native 0.81, NativeWind v4 (Tailwind CSS 3.4.x), Expo Router v6, Zustand v5, Moti 0.30, react-native-reanimated 4.1, react-native-svg 15.12, react-native-maps 1.20, @gorhom/bottom-sheet 5.2, lucide-react-native 0.563, react-native-purchases 9.8
**Storage**: Supabase PostgreSQL (existing), AsyncStorage for theme persistence
**Testing**: Vitest (unit), Expo dev build (manual E2E)
**Target Platform**: iOS 15+ / Android 8+ (Expo managed)
**Project Type**: Mobile (Expo + shared packages)
**Performance Goals**: 60fps scroll, skeleton within 200ms of navigation, palette switch under 1s
**Constraints**: NativeWind v4 with Tailwind CSS 3.4.x (NOT v4); no CSS custom properties in RN; `--legacy-peer-deps` for NativeWind installs
**Scale/Scope**: 8 screens, ~30 components (12 new themed, 18 modified existing), 3 new hooks, 2 palette definitions

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Type-Safe Clean Code | PASS | All new code in strict TypeScript. Theme tokens as `as const` objects. No `any`. |
| II. Testing Discipline | PASS | Unit tests for theme store, economy calculation, hook logic. Component tests deferred (no RN component test infra currently). |
| III. User Experience First | PASS | All text in pt-BR. Skeleton loading, optimistic UI, inline error banners. 60fps target. |
| IV. Interface Consistency | PASS | All colors from Tailwind config tokens. Icons from lucide-react-native only. Animations via Moti + Reanimated. |
| V. Simplicity & YAGNI | PASS | Theme system is Context + Zustand (no Redux). Palette-variant components use simple conditional rendering, not abstract factory. No new dependencies needed. |
| Technology Constraints | PASS | NativeWind v4 + Tailwind CSS 3.4.x. Zustand for client state. Zod for validation. |

No violations. No complexity tracking needed.

## Project Structure

### Documentation (this feature)

```text
specs/002-b2c-consumer-ui/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── hooks.md         # Hook interface contracts
└── tasks.md             # Phase 2 output (via /speckit.tasks)
```

### Source Code (repository root)

```text
mobile/
├── app/
│   ├── (tabs)/
│   │   ├── _layout.tsx          # MODIFY: floating navbar, 5 new tabs
│   │   ├── index.tsx            # REWRITE: Home dashboard
│   │   ├── search.tsx           # NEW: replaces filter-based index browsing
│   │   ├── map.tsx              # MODIFY: list-aware markers + bottom panel
│   │   ├── list.tsx             # NEW: receipt-style shopping list
│   │   └── account.tsx          # NEW: profile + preferences + paywall trigger
│   ├── onboarding.tsx           # REWRITE: themed chalkboard/dark onboarding
│   └── product/
│       └── [id].tsx             # NEW: product detail screen
├── components/
│   ├── themed/                  # NEW: theme-switching wrapper components
│   │   ├── deal-card.tsx        # Delegates to encarte/fintech variant
│   │   ├── section-divider.tsx
│   │   ├── discount-badge.tsx
│   │   ├── list-item.tsx
│   │   └── coupon-line.tsx
│   ├── encarte/                 # NEW: Palette A visual metaphors
│   │   ├── price-tag-card.tsx
│   │   ├── barcode-divider.tsx
│   │   ├── stamp-badge.tsx
│   │   └── receipt-separator.tsx
│   ├── fintech/                 # NEW: Palette B clean equivalents
│   │   ├── clean-card.tsx
│   │   ├── rule-divider.tsx
│   │   └── pill-badge.tsx
│   ├── economy-card.tsx         # NEW: dark economy summary card
│   ├── store-ranking.tsx        # NEW: top 3 store ranking list
│   ├── search-results.tsx       # NEW: store comparison list with Plus gating
│   ├── paywall.tsx              # REWRITE: new layout per wireframe
│   ├── price-chart.tsx          # MODIFY: SVG line chart with min/current markers
│   ├── floating-tab-bar.tsx     # NEW: custom floating tab bar component
│   ├── inline-error.tsx         # NEW: inline retry banner
│   └── skeleton/                # NEW: palette-aware skeleton components
│       ├── home-skeleton.tsx
│       ├── search-skeleton.tsx
│       └── list-skeleton.tsx
├── theme/                       # NEW: theming system
│   ├── provider.tsx             # ThemeContext + ThemeProvider wrapping app
│   ├── store.ts                 # Zustand store: palette selection (persisted)
│   ├── palettes.ts              # Encarte + Fintech token definitions
│   └── use-theme.ts             # useTheme() hook → active tokens + palette name
├── hooks/
│   ├── use-economy-summary.ts   # NEW: hybrid savings calculation
│   ├── use-store-ranking.ts     # NEW: weekly top 3 cheapest stores
│   └── use-theme-classes.ts     # NEW: semantic Tailwind class mapper
└── tailwind.config.ts           # MODIFY: add both palette color tokens

packages/shared/src/
└── constants/
    └── colors.ts                # MODIFY: add both palette color sets
```

**Structure Decision**: Extends existing `mobile/components/` and `mobile/hooks/` structure. New `mobile/theme/` directory for the theming system (context, store, tokens). Palette-specific visual metaphors live in `mobile/components/encarte/` and `mobile/components/fintech/`, with `mobile/components/themed/` wrappers that delegate based on active palette. This avoids over-abstraction while keeping palette-specific SVG/shapes isolated.

## Design Decisions

### DD-1: Theming Architecture

**Decision**: Zustand store (persisted via AsyncStorage) + React Context + conditional Tailwind classes.

**Rationale**: NativeWind v4 with Tailwind CSS 3.4.x does NOT support CSS custom properties at runtime in React Native. Therefore, dynamic theming via CSS variables is not possible. Instead:

1. **`mobile/theme/palettes.ts`** — Two `as const` objects defining all color tokens for each palette
2. **`mobile/theme/store.ts`** — Zustand store with `palette: 'encarte' | 'fintech'` persisted to AsyncStorage
3. **`mobile/theme/provider.tsx`** — React Context that reads the Zustand store and provides the active palette tokens + a `togglePalette()` function
4. **`mobile/hooks/use-theme-classes.ts`** — Hook that returns a flat object of semantic Tailwind class strings mapped to the active palette (e.g., `{ bg: 'bg-encarte-paper', cardBg: 'bg-white', ... }`)
5. **Components** consume `useTheme()` for tokens and `useThemeClasses()` for pre-mapped class names

**Alternatives rejected**:
- `twMerge` + dynamic class concatenation: Too complex, no tree-shaking benefit in RN
- Single set of CSS variables toggled by data attribute: Not supported by NativeWind in RN
- StyleSheet.create per palette: Loses NativeWind benefits, double maintenance

### DD-2: Visual Metaphor Components

**Decision**: Palette-variant components in `encarte/` and `fintech/` directories, with `themed/` wrappers that delegate.

**Rationale**: The visual metaphors (price tag shape vs clean card, barcode vs rule line, stamp vs pill) are fundamentally different component structures, not just color swaps. A price tag card needs an SVG hole + wire element; a clean card is just a rounded View. Keeping them as separate components with a thin wrapper is simpler than a single component with extensive conditional rendering.

```
themed/deal-card.tsx:
  const { palette } = useTheme();
  return palette === 'encarte'
    ? <PriceTagCard {...props} />
    : <CleanCard {...props} />;
```

### DD-3: Floating Tab Bar

**Decision**: Custom tab bar component passed to Expo Router's `<Tabs tabBar={...}>` prop.

**Rationale**: The default Expo Router tab bar cannot float with shadow over content. The custom `FloatingTabBar` component:
- Uses absolute positioning with `bottom` offset
- Applies shadow (elevation on Android, shadowX on iOS)
- Consumes theme tokens for colors
- Tab icons: Início (Home), Busca (Search), Mapa (MapPin), Lista (List), Conta (User) — all from lucide-react-native

The tab content area needs extra bottom padding equal to the tab bar height to prevent content from being hidden behind the floating bar.

### DD-4: Economy Summary Calculation

**Decision**: New `useEconomySummary` hook with hybrid logic.

**When user has a shopping list**:
```
savings = Σ (reference_price - min(promo_price across all stores)) for each list item
cheapestStore = store with lowest total for all list items
```

**When list is empty**:
```
savings = Σ (original_price - promo_price) for all active promotions within search radius
cheapestStore = store with highest total discount value
```

Uses existing `promotions`, `products`, `reference_prices`, `shopping_lists`, `shopping_list_items` tables. No new DB tables or RPCs needed.

### DD-5: Tab Restructure

**Decision**: Change tabs from `Home / Mapa / Favoritos / Alertas / Perfil` to `Início / Busca / Mapa / Lista / Conta`.

**Rationale**: The wireframe defines 5 specific tabs. Favoritos and Alertas are absorbed into the Account/Conta screen as preference sections. The shopping List becomes a first-class tab. Search gets its own tab instead of living inside the home screen.

**Migration**: Rename/replace existing tab files. Favorites and alerts functionality remains accessible from Conta and from contextual actions (heart icon on products, alert toggle on product detail).

### DD-6: Product Detail as Stack Route

**Decision**: Product detail lives at `mobile/app/product/[id].tsx` as a stack route, not a tab.

**Rationale**: Product detail is reached by tapping a deal card from Home, Search, or Map. It pushes onto the navigation stack with a back button. This matches the wireframe's "< Voltar" navigation pattern.

### DD-7: Price Chart Upgrade

**Decision**: Replace the hand-rolled View-based bar chart with an SVG path-based line chart using `react-native-svg` (already installed).

**Rationale**: The wireframe shows a smooth line chart with min/current markers. The current implementation uses View heights as bars. SVG Polyline/Path gives smooth lines, dots for data points, and label positioning — all with the existing `react-native-svg` dependency.

## Implementation Phases

### Phase A: Theme Foundation (P1)
1. Create `mobile/theme/` — palettes, store, provider, hooks
2. Extend `tailwind.config.ts` with both palette color tokens
3. Update `colors.ts` in shared package
4. Build `FloatingTabBar` component
5. Update `(tabs)/_layout.tsx` — new tabs, custom tab bar, theme provider wrapping
6. Build palette-variant primitive components: `encarte/` and `fintech/` directories
7. Build `themed/` wrapper components
8. Build `skeleton/` components
9. Build `inline-error.tsx` component
10. Test: palette toggle renders all primitives in component gallery

### Phase B: Core Screens (P2–P4)
11. Build `useEconomySummary` hook
12. Build `useStoreRanking` hook
13. Rewrite `(tabs)/index.tsx` — Home dashboard with economy card, deals carousel, ranking
14. Build `(tabs)/search.tsx` — search input, sort tabs, results with Plus gating
15. Build `(tabs)/list.tsx` — receipt/clean list, savings card, item management
16. Test: home/search/list render with seed data in both palettes

### Phase C: Detail & Map (P5–P6)
17. Build `product/[id].tsx` — product detail with SVG chart, alert toggle, store comparison
18. Upgrade `price-chart.tsx` — SVG line chart with markers
19. Modify `(tabs)/map.tsx` — list-aware markers, bottom panel, routing
20. Test: product detail, chart, and map in both palettes

### Phase D: Onboarding & Account (P7–P8)
21. Rewrite `onboarding.tsx` — themed dark background, value props, CTA
22. Build `(tabs)/account.tsx` — profile, preferences, subscription sections
23. Rewrite `paywall.tsx` — new layout with comparison table, pricing, trial CTA
24. Test: full user flow from onboarding → home → search → detail → list → map

### Phase E: Enhancement Polish (should-have)
25. Add physics-based spring animations to tab transitions
26. Add haptic feedback to interactive elements
27. Add shared element transitions (deal card → product detail)
28. Add optimistic UI to data mutations
29. Add list item check-off animation
30. Final cross-platform visual audit (iOS + Android)
