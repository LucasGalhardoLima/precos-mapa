# Tasks: Grocery Price Comparison — Consumer App Demo

**Input**: Design documents from `/specs/001-grocery-price-compare/`
**Prerequisites**: plan.md, spec.md, data-model.md, contracts/mock-data-api.md, research.md

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US0, US1, US2)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Initialize the Expo project, install dependencies, and configure build tooling

- [x] T001 Initialize Expo project in `mobile/` with `npx create-expo-app` using Expo SDK 52+ and TypeScript template. Configure `mobile/app.json` with app name "PrecoMapa", slug, iOS/Android bundle IDs, and Google Maps API key placeholder under `expo.android.config.googleMaps.apiKey`
- [x] T002 Install all project dependencies per research.md: `react-native-maps`, `nativewind@~4`, `tailwindcss@~3.4`, `@gorhom/bottom-sheet@~5`, `react-native-reanimated@~3`, `moti@~0.30`, `lucide-react-native`, `react-native-svg`, `zustand@~5`, `react-native-safe-area-context`, `react-native-gesture-handler`. Add dev dependencies: `typescript`, `@types/react`
- [x] T003 [P] Configure NativeWind v4: create `mobile/tailwind.config.ts` with content paths (`./app/**/*.tsx`, `./components/**/*.tsx`), shared color palette (matching admin panel tokens), and spacing scale. Update `mobile/babel.config.js` to include NativeWind preset. Create `mobile/global.css` with Tailwind directives
- [x] T004 [P] Configure TypeScript: update `mobile/tsconfig.json` with strict mode, path aliases (`@/*` → `./`), and Expo Router type references

**Checkpoint**: Expo project boots with `npx expo start`, NativeWind styles apply, all dependencies resolve

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core types, mock data, shared hooks, UI primitives, state management, and root navigation layout. MUST be complete before any user story work.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Type Definitions

- [x] T005 [P] Define all TypeScript types in `mobile/types/index.ts`: `Product` (id, name, category, brand, referencePrice, imageUrl), `Promotion` (id, productId, storeId, originalPrice, promoPrice, startDate, endDate, status, verified, source), `Store` (id, name, chain, address, city, state, latitude, longitude, logoInitial, logoColor, plan, activeOfferCount), `Category` (id, name, icon, sortOrder), `Testimonial` (id, userName, text, savingsAmount), `SocialProofStats` (userCount, cityName, avgMonthlySavings), `EnrichedPromotion` (extends Promotion with product, store, discountPercent, belowNormalPercent, gamificationMessage, distanceKm, isExpiringSoon), `StoreWithPromotions`, `SortMode` ("cheapest" | "nearest" | "expiring")

### Mock Data Modules

- [x] T006 [P] Create `mobile/data/categories.ts`: export typed array of 7 categories (cat_todos, cat_bebidas, cat_limpeza, cat_alimentos, cat_hortifruti, cat_padaria, cat_higiene) with Lucide icon names and sort order per data-model.md
- [x] T007 [P] Create `mobile/data/stores.ts`: export typed array of 4 stores (Carol Supermercado at -21.6033/-48.3658, Mais Barato Araraquara at -21.7946/-48.1756, Bom Dia Ribeirao at -21.1704/-47.8103, Santa Fe Sao Carlos at -22.0174/-47.8908) with logoInitial, logoColor, plan, and activeOfferCount
- [x] T008 [P] Create `mobile/data/products.ts`: export typed array of ~20 products spread across 6 real categories (Bebidas: Coca-Cola 2L, Suco Del Valle, Cerveja Skol, Leite Integral; Limpeza: Detergente Ype, Sabao em Po, Desinfetante; Alimentos: Arroz 5kg, Feijao, Macarrao, Oleo de Soja; Hortifruti: Banana, Tomate, Batata, Cebola; Padaria: Pao Frances, Bolo, Biscoito; Higiene: Sabonete, Shampoo, Pasta de Dente) each with referencePrice in BRL
- [x] T009 Create `mobile/data/promotions.ts`: export typed array of ~25-30 active promotions linking products to stores with originalPrice, promoPrice, future endDate (some within 24h for "Acaba hoje" filter), verified status, and source. Ensure variety: multiple stores per popular product, range of discount percentages (8%-55%) to exercise gamification thresholds. Depends on T007, T008
- [x] T010 [P] Create `mobile/data/testimonials.ts`: export typed array of 3 testimonials (Maria Silva/R$120 saved, Carlos Santos/R$85 saved, Ana Costa/R$200 saved) and `SocialProofStats` singleton ({userCount: "+3.200", cityName: "Matao", avgMonthlySavings: "R$ 47"})

### Constants

- [x] T011 [P] Create `mobile/constants/colors.ts`: export color palette matching admin panel design tokens (brand green, brand orange, semantic colors for success/warning/error, neutral grays, background/surface/text colors)
- [x] T012 [P] Create `mobile/constants/messages.ts`: export gamification message thresholds per data-model.md (>=40%: "Voce evitou pagar caro!", >=25%: "Boa economia!", >=10%: "Vale a pena conferir", <10%: null) and demo user location constant `DEMO_USER_LOCATION = { latitude: -21.6033, longitude: -48.3658 }`
- [x] T013 [P] Create `mobile/constants/animations.ts`: export shared Moti/Reanimated animation configs (fade-in duration, spring config for bottom sheet, stagger delay for list items)

### Shared Hooks

- [x] T014 Create `mobile/hooks/use-location.ts`: export `useLocation()` hook returning `DEMO_USER_LOCATION` coordinates and a Haversine distance calculation utility function `calculateDistanceKm(lat1, lon1, lat2, lon2)`. Depends on T012
- [x] T015 Create `mobile/hooks/use-promotions.ts`: implement `usePromotions(params: UsePromotionsParams)` per contracts/mock-data-api.md. Joins promotions with products and stores, computes enrichment fields (discountPercent, belowNormalPercent, gamificationMessage, distanceKm, isExpiringSoon), applies query filter (case-insensitive substring on name/brand), categoryId filter, and sorting (cheapest: promoPrice ASC then distanceKm ASC; nearest: distanceKm ASC then promoPrice ASC; expiring: endDate ASC then promoPrice ASC). Returns simulated 300ms loading state. Depends on T005, T006-T010, T014
- [x] T016 Create `mobile/hooks/use-stores.ts`: implement `useStores(params)` per contracts/mock-data-api.md. Returns `StoreWithPromotions[]` with activePromotionCount, top 3 deals by discount %, and distanceKm. Depends on T005, T007, T009, T014
- [x] T017 [P] Create `mobile/hooks/use-categories.ts`: implement `useCategories()` returning sorted category list from mock data. Depends on T006
- [x] T018 Create `mobile/hooks/use-featured-deals.ts`: implement `useFeaturedDeals()` returning top 5 promotions by discount % for the onboarding carousel. Depends on T015
- [x] T019 Create `mobile/hooks/use-search.ts`: implement `useSearch(query)` per contracts/mock-data-api.md with case-insensitive substring matching on product.name and product.brand, returning results and product name suggestions. Simulated 200ms searching delay. Depends on T015
- [x] T020 [P] Create `mobile/hooks/use-social-proof.ts`: implement `useSocialProof()` returning hardcoded stats and testimonials from mock data. Depends on T010

### State Management

- [x] T021 [P] Create `mobile/store/app-store.ts`: Zustand store with: `hasSeenOnboarding: boolean` (persisted to AsyncStorage), `isAuthenticated: boolean` (simulated), `selectedCategoryId: string | null`, `sortMode: SortMode` (default "cheapest"), `searchQuery: string`, and actions to update each

### UI Primitives

- [x] T022 [P] Create `mobile/components/ui/text.tsx`: styled Text component with NativeWind variants for heading, subheading, body, caption, and price text
- [x] T023 [P] Create `mobile/components/ui/button.tsx`: styled Pressable with primary (brand green), secondary (outline), and ghost variants using NativeWind
- [x] T024 [P] Create `mobile/components/ui/badge.tsx`: small inline badge component for "Verificado", discount %, "Acaba hoje" tags using NativeWind

### Root Navigation Layout

- [x] T025 Create `mobile/app/_layout.tsx`: root Expo Router layout wrapping app in `GestureHandlerRootView`, `SafeAreaProvider`, and `BottomSheetModalProvider`. Reads `hasSeenOnboarding` and `isAuthenticated` from Zustand store to conditionally render onboarding or tab navigator. Import `global.css` for NativeWind. Depends on T021
- [x] T026 Create `mobile/app/index.tsx`: redirect entry point — checks Zustand store state and routes to `/onboarding` or `/(tabs)` accordingly. Depends on T025
- [x] T027 Create `mobile/app/(tabs)/_layout.tsx`: tab navigator layout with 4 tabs — Home (house icon), Map (map-pin icon), Favorites (heart icon), Alerts (bell icon) — using lucide-react-native icons, NativeWind-styled tab bar with brand colors, Home as default tab. Depends on T011

**Checkpoint**: Foundation ready — all types defined, mock data loads, hooks return enriched data, navigation skeleton renders 4 empty tabs. User story implementation can begin.

---

## Phase 3: US0 — Onboarding and Audience Routing (Priority: P1) 🎯 MVP

**Goal**: First-time users see a compelling onboarding screen with social proof, testimonials, featured deals preview, and dual CTAs to enter as consumer or supermarket admin.

**Independent Test**: Open app for the first time → see PrecoMapa brand, "Matao/SP" location, social proof stats, testimonials carousel, featured deals preview, "Sou Consumidor" and "Tenho um Mercado" CTAs. Tap "Sou Consumidor" → land on Home tab. Reopen app → skip onboarding.

### Implementation

- [x] T028 [P] [US0] Create `mobile/components/social-proof.tsx`: component displaying social proof stats ("+3.200 usuarios em Matao", "R$ 47 economia media/mes") with animated counters (Moti fade-in), and a horizontal scrollable testimonial card list showing userName, text, and savingsAmount. Uses `useSocialProof()` hook
- [x] T029 [P] [US0] Create `mobile/components/featured-deals-carousel.tsx`: horizontal FlatList carousel of top 5 deal cards (compact variant of deal-card showing product name, store name, promoPrice, discountPercent badge). Uses `useFeaturedDeals()` hook. Each card uses Moti for staggered fade-in
- [x] T030 [US0] Create `mobile/app/onboarding.tsx`: full onboarding screen composed of: PrecoMapa logo/tagline header, city context ("Matao, SP"), `<SocialProof />` section, `<FeaturedDealsCarousel />` section, and two CTA cards at bottom — "Sou Consumidor" (primary green, taps sets `isAuthenticated: true` in Zustand and navigates to `/(tabs)`) and "Tenho um Mercado" (secondary outline, shows toast/alert that admin panel is web-only). On load, sets `hasSeenOnboarding: true`. Depends on T025, T028, T029

**Checkpoint**: US0 complete — onboarding displays, CTAs work, returning users skip to tabs

---

## Phase 4: US1 — Search, Browse, and Compare (Priority: P1) 🎯 MVP

**Goal**: Users can search for products, browse by category and filters, and see enriched deal cards with discount %, verified badges, below-normal indicators, and gamification messages.

**Independent Test**: Open Home tab → see filter chips, category tabs, deal feed, "Perto de voce" section. Search "arroz" → see matching deals. Tap "Bebidas" category → see only Bebidas deals. Tap "Mais perto" → deals re-sort by distance. Verify deal cards show discount %, "Verificado" badge, "X% abaixo do normal" tag, gamification message for high-discount items.

### Implementation

- [x] T031 [P] [US1] Create `mobile/components/search-bar.tsx`: search input with magnifying glass icon (lucide Search), debounced text input (300ms), clear button, NativeWind styling. Dispatches `setSearchQuery` to Zustand store. Shows search suggestions dropdown from `useSearch()` when query length >= 2
- [x] T032 [P] [US1] Create `mobile/components/filter-chips.tsx`: horizontal ScrollView row of 3 chip buttons — "Mais barato" (sortMode: cheapest), "Mais perto" (sortMode: nearest), "Acaba hoje" (sortMode: expiring). Active chip highlighted with brand color. Dispatches `setSortMode` to Zustand store
- [x] T033 [P] [US1] Create `mobile/components/category-tabs.tsx`: horizontal ScrollView tab bar rendering category icons and names from `useCategories()`. "Todos" tab shows all. Active tab underlined with brand color. Dispatches `setSelectedCategoryId` to Zustand store
- [x] T034 [US1] Create `mobile/components/deal-card.tsx`: enriched promotion card displaying: product name and brand, store name with logoInitial avatar (colored circle), promoPrice (large, green) and originalPrice (strikethrough), discountPercent badge (e.g., "-32%"), "Verificado" badge (if promotion.verified, using badge component), "X% abaixo do normal" tag (if belowNormalPercent > 0), gamificationMessage (if non-null, displayed as motivational text), distanceKm ("1.2 km"), endDate with "Acaba hoje!" urgency styling if isExpiringSoon. Uses Moti for fade-in on mount. Depends on T024
- [x] T035 [US1] Create `mobile/app/(tabs)/index.tsx` (Home tab): composes full home screen with `<SearchBar />` at top, `<FilterChips />` row below, `<CategoryTabs />` horizontal bar, then a FlatList of `<DealCard />` items from `usePromotions()` (passing searchQuery, selectedCategoryId, sortMode from Zustand store and DEMO_USER_LOCATION). Includes a "Perto de voce" section header before the list when no search query is active, showing nearest deals (sortMode: nearest, limit 5). Shows empty state message "Nenhuma oferta encontrada" with suggestion to try another category when isEmpty is true. Shows skeleton loading placeholders during isLoading. Depends on T031, T032, T033, T034, T015

**Checkpoint**: US1 complete — search, filter, browse, and enriched deal cards all functional on Home tab

---

## Phase 5: US2 — Explore Nearby Stores on Map (Priority: P2)

**Goal**: Users see an interactive map centered on Matao/SP with 4 store markers. Tapping a marker opens a bottom sheet with store info and top 3 deals.

**Independent Test**: Open Map tab → see map centered on Matao/SP with 4 markers. Tap Carol Supermercado marker → bottom sheet slides up showing store name, address, distance, active promotion count, and 3 best deals as compact deal cards.

### Implementation

- [x] T036 [P] [US2] Create `mobile/components/store-marker.tsx`: custom MapView Marker component rendering a colored circle with store logoInitial text inside (matching store.logoColor). Accepts `StoreWithPromotions` and an `onPress` callback
- [x] T037 [US2] Create `mobile/components/store-bottom-sheet.tsx`: `@gorhom/bottom-sheet` component showing: store name and logoInitial avatar, address, distance ("1.2 km de voce"), active promotion count, and a vertical list of top 3 `<DealCard />` components (compact variant). Includes a snap point at 40% and 85% screen height. Depends on T034
- [x] T038 [US2] Create `mobile/app/(tabs)/map.tsx`: MapView (react-native-maps) centered on DEMO_USER_LOCATION with appropriate zoom to show all 4 stores. Renders `<StoreMarker />` for each store from `useStores()`. On marker press, opens `<StoreBottomSheet />` with the selected store's data. Includes user location indicator dot. Depends on T016, T036, T037

**Checkpoint**: US2 complete — map renders with markers, bottom sheet shows store details and deals

---

## Phase 6: US3 — Favorites & Alerts Static Mockups (Priority: P3)

**Goal**: Static mockup screens for Favorites and Alerts tabs to complete the 4-tab navigation for the demo.

**Independent Test**: Open Favorites tab → see pre-populated list of ~5 saved products with best prices. Open Alerts tab → see placeholder content explaining deal alerts.

### Implementation

- [x] T039 [P] [US3] Create `mobile/app/(tabs)/favorites.tsx`: static favorites screen with a hardcoded FlatList of ~5 products from mock data, each showing product name, brand, best current promoPrice, store name offering it, and a filled heart icon. Header text: "Seus Favoritos". No real persistence — purely visual mockup
- [x] T040 [P] [US3] Create `mobile/app/(tabs)/alerts.tsx`: static alerts placeholder screen with a bell icon illustration, header "Alertas de Ofertas", description text explaining the feature ("Receba notificacoes quando seus produtos favoritos entrarem em promocao perto de voce"), and 2-3 hardcoded example alert cards showing what notifications would look like (product name, store, price, "Há 2 horas")

**Checkpoint**: All 4 tabs populated — demo navigation is complete

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Animations, loading states, visual refinements, and demo validation

- [x] T041 [P] Add Moti stagger animations to deal card lists on Home and Favorites screens (fade-in + translateY with staggered delay per item)
- [x] T042 [P] Add skeleton loading placeholders to Home screen (3-4 gray pulsing card shapes) displayed during simulated loading from `usePromotions()`
- [x] T043 [P] Add smooth tab transition animations in `(tabs)/_layout.tsx`
- [x] T044 Validate quickstart.md end-to-end: clone fresh, `cd mobile && npm install && npx expo start`, verify all 4 tabs render correctly on iOS Simulator and/or Expo Go
- [x] T045 Code cleanup: remove any unused imports, ensure consistent NativeWind class naming, verify all pt-BR strings are correct

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 — BLOCKS all user stories
- **US0 (Phase 3)**: Depends on Phase 2 — specifically T020 (social proof hook), T018 (featured deals hook), T025 (root layout)
- **US1 (Phase 4)**: Depends on Phase 2 — specifically T015 (promotions hook), T019 (search hook), T021 (Zustand store), T017 (categories hook)
- **US2 (Phase 5)**: Depends on Phase 2 — specifically T016 (stores hook), T034 (deal card from US1)
- **US3 (Phase 6)**: Depends on Phase 2 — can run in parallel with US0/US1/US2
- **Polish (Phase 7)**: Depends on all user story phases being complete

### User Story Dependencies

- **US0 (P1)**: Can start after Phase 2. Independent of other stories.
- **US1 (P1)**: Can start after Phase 2. Independent of US0 (different screen).
- **US2 (P2)**: Can start after Phase 2, but reuses `<DealCard />` from US1 (T034). If building sequentially, implement US1 first.
- **US3 (P3)**: Can start after Phase 2. Independent of other stories (static mockups).

### Within Each Phase

- Tasks marked [P] within the same phase can run in parallel
- Mock data modules (T006-T010) can run in parallel except T009 (promotions) which depends on T007 (stores) and T008 (products)
- Hooks (T014-T020) depend on types (T005) and their respective data modules
- UI components can be built in parallel, but screens depend on their constituent components

### Parallel Opportunities

```
Phase 2 parallel groups:
  Group A: T005, T006, T007, T008, T010, T011, T012, T013 (all [P])
  Group B: T009 (after T007, T008)
  Group C: T014, T017, T020, T021, T022, T023, T024 (after Group A)
  Group D: T015, T016 (after T009, T014)
  Group E: T018, T019 (after T015)
  Group F: T025, T026, T027 (navigation layout, after T021)

Phase 3+4 can run in parallel:
  US0: T028, T029 → T030
  US1: T031, T032, T033 → T034 → T035

Phase 5 after T034:
  US2: T036 → T037 → T038

Phase 6 in parallel with Phase 3-5:
  US3: T039, T040 (both [P], independent)
```

---

## Implementation Strategy

### Recommended Sequential Order (Single Developer)

1. Phase 1: Setup (T001 → T002 → T003, T004 in parallel)
2. Phase 2: Foundational (follow dependency groups A → B → C → D → E → F)
3. Phase 3: US0 Onboarding (T028, T029 in parallel → T030)
4. Phase 4: US1 Search/Browse (T031, T032, T033 in parallel → T034 → T035)
5. Phase 5: US2 Map (T036 → T037 → T038)
6. Phase 6: US3 Static Mockups (T039, T040 in parallel)
7. Phase 7: Polish (T041-T045)

### MVP Demo (Minimum Viable Demo)

Complete Phases 1-4 for a functional demo with onboarding and home screen search/browse. The map and static tabs can be added incrementally.

---

## Notes

- [P] tasks = different files, no dependencies within the same phase
- All UI text MUST be in Portuguese (pt-BR) per FR-008
- NativeWind v4 uses Tailwind CSS 3.4.x syntax (NOT Tailwind v4.x)
- Mock data dates should use future endDates relative to demo date
- Commit after each task or logical group
- Stop at any checkpoint to validate the demo independently
