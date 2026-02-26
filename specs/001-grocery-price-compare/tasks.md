# Tasks: Grocery Price Comparison — Production (Supabase)

**Input**: Design documents from `/specs/001-grocery-price-compare/`
**Prerequisites**: plan.md, spec.md, data-model.md, contracts/supabase-api.md, research.md, quickstart.md

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US0, US1, US2)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Project Infrastructure)

**Purpose**: Initialize Supabase project, install production dependencies, configure environment files, EAS Build profiles, and testing infrastructure.

- [X] T001 Initialize Supabase project by running `supabase init` in repo root to create `supabase/` directory with `config.toml`. Configure project settings (project name: precomapa, db port, API port)
- [X] T002 Install production mobile dependencies in `mobile/`: run `npx expo install @supabase/supabase-js expo-secure-store expo-apple-authentication expo-location expo-notifications expo-device expo-constants expo-dev-client react-native-purchases react-native-purchases-ui` and `npm install @react-native-google-signin/google-signin --legacy-peer-deps`
- [X] T003 [P] Install production admin panel dependencies in repo root: run `npm install stripe @stripe/stripe-js @supabase/supabase-js @supabase/ssr resend zod`
- [X] T004 [P] Create environment files: `.env.local` in repo root (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, RESEND_API_KEY) and `mobile/.env` (EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY, EXPO_PUBLIC_GOOGLE_MAPS_API_KEY, EXPO_PUBLIC_RC_APPLE_KEY, EXPO_PUBLIC_RC_GOOGLE_KEY). Add both to `.gitignore`
- [X] T005 [P] Configure EAS Build in `mobile/eas.json` with three profiles: `development` (developmentClient: true, distribution: internal), `preview` (distribution: internal), `production` (autoIncrement: true). Run `eas build:configure` if EAS CLI is available
- [X] T006 [P] Update `mobile/app.json` for production: add `expo.plugins` for expo-apple-authentication, expo-location (requestAlwaysAuthorization: false), expo-notifications, expo-dev-client, @react-native-google-signin/google-signin. Configure `expo.ios.infoPlist` with NSLocationWhenInUseUsageDescription and NSLocationAlwaysUsageDescription (pt-BR). Set `expo.android.config.googleMaps.apiKey` to `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`
- [X] T007 [P] Configure testing infrastructure: set up Jest + React Native Testing Library for `mobile/` and Jest for `src/`. Create `mobile/jest.config.ts` (preset: jest-expo, transformIgnorePatterns for node_modules), `mobile/jest.setup.ts` with mocks for `@supabase/supabase-js`, `expo-location`, `expo-notifications`, `expo-secure-store`, `react-native-purchases`. Install dev deps: `jest-expo`, `@testing-library/react-native`, `@testing-library/jest-native`. Create `mobile/__tests__/helpers/supabase-mock.ts` with typed mock for Supabase client (from/select/insert/update/delete chain, auth.getSession, auth.signInWithIdToken)

**Checkpoint**: Supabase project initialized, all production dependencies installed, env files configured, EAS ready, test runner works with `npm test` in mobile/. Run `supabase start` to verify local Supabase works.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Database schema, seed data, Supabase clients, TypeScript types, Zod validation schemas, auth infrastructure, realtime hook, Zustand store rewrite, and foundational tests. MUST be complete before any user story work.

**CRITICAL**: No user story work can begin until this phase is complete.

### Database Schema

- [X] T008 Create Supabase migration `supabase/migrations/001_initial_schema.sql` per data-model.md: enable `pg_trgm` extension. Create all tables (profiles, stores, store_members, categories, products, product_synonyms, promotions, user_favorites, user_alerts, testimonials, platform_stats) with columns, constraints, indexes, RLS policies, and database functions (check_promotion_limit, update_search_priority, check_store_limit, check_favorite_limit, check_alert_limit). Add GIN index `ix_products_name_trgm ON products USING gin (name gin_trgm_ops)` for fuzzy search. Include trigger for profile creation on auth.users INSERT, trigger for search_priority on stores b2b_plan change, and enable Realtime on promotions table. Apply with `supabase db push`
- [X] T009 [P] Create seed file `supabase/seed.sql` from existing `mobile/data/*.ts` mock data: INSERT statements for categories (7 rows), products (21 rows), product_synonyms (common brand→product mappings, e.g., "leite moca"→leite condensado, "omo"→sabao em po), stores (4 rows with Matao/SP coordinates), promotions (29 rows with future end_dates), testimonials (3 rows), and platform_stats (1 row with "+3.200" users, "Matao", "R$ 47"). Apply with `supabase db seed`

### Client Libraries

- [X] T010 [P] Create Supabase client for mobile in `mobile/lib/supabase.ts`: initialize `@supabase/supabase-js` with `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` from env. Configure `auth.storage` to use `expo-secure-store` adapter, set `auth.autoRefreshToken: true`, `auth.persistSession: true`, `auth.detectSessionInUrl: false` (critical for React Native). Export typed `supabase` client
- [X] T011 [P] Create Supabase SSR client for admin panel in `src/lib/supabase-server.ts` per contracts/supabase-api.md: use `createServerClient` from `@supabase/ssr` with cookie-based session management via `next/headers`. Export `createClient()` function

### TypeScript Types & Validation

- [X] T012 Update TypeScript types in `mobile/types/index.ts`: add Supabase-aligned types matching data-model.md tables (Profile, Store, StoreMember, Category, Product, ProductSynonym, Promotion, UserFavorite, UserAlert, Testimonial, PlatformStats, ShoppingList, ShoppingListItem, PriceSnapshot). Keep existing computed types (EnrichedPromotion, StoreWithPromotions, SortMode). Add `UserRole = 'consumer' | 'business'`, `B2BPlan`, `B2CPlan`, `PromotionSource` union types
- [X] T013 [P] Create Zod validation schemas in `mobile/lib/schemas.ts`: define schemas for promotion form (`promotionSchema`: product_id uuid, original_price positive, promo_price positive and < original_price, start_date, end_date after start_date), store setup form (`storeSetupSchema`: name min 2 chars, address min 5, city, state 2 chars, latitude -90..90, longitude -180..180), alert creation (`alertSchema`: product_id, optional target_price positive, radius_km 1..50), profile update (`profileUpdateSchema`). Create `src/lib/schemas.ts` for admin: Stripe webhook payload schema, promotion form schema. Export typed infer types

### Core Hooks

- [X] T014 [P] Create auth hook `mobile/hooks/use-auth.ts`: wraps Supabase Auth with `signInWithGoogle()`, `signInWithApple()`, `signOut()`, `getSession()`, `getProfile()`. Returns `{ user, profile, isLoading, isAuthenticated, role, signIn, signOut }`. Listens to `onAuthStateChange` for session changes. Caches profile in Zustand store. Depends on T010
- [X] T015 [P] Create realtime hook `mobile/hooks/use-realtime.ts`: subscribes to Supabase Realtime `postgres_changes` on `promotions` table per contracts/supabase-api.md. Returns callback-driven updates (INSERT/UPDATE/DELETE). Cleans up channel on unmount via `supabase.removeChannel()`. Depends on T010

### State Management

- [X] T016 Rewrite Zustand store `mobile/store/app-store.ts`: replace mock auth with Supabase session state. Store fields: `session: Session | null`, `profile: Profile | null`, `isLoading: boolean`, `selectedCategoryId: string | null`, `sortMode: SortMode`, `searchQuery: string`. Actions: `setSession`, `setProfile`, `setSelectedCategoryId`, `setSortMode`, `setSearchQuery`, `clearAuth`. Persist `hasSeenOnboarding` via `expo-secure-store`. Depends on T012

### Foundational Tests

- [X] T017 Write foundational unit tests in `mobile/__tests__/`: test Supabase client mock setup works (supabase-mock helper returns typed chain), test auth hook (signInWithGoogle calls signInWithIdToken, session change updates state, role detection from profile), test Zustand store (state transitions: setSession, clearAuth, setSortMode), test Zod schemas (valid promotion passes, promo_price > original_price fails, missing required fields fail). Minimum 15 test cases. Depends on T010, T013, T014, T016

**Checkpoint**: `supabase db push` and `supabase db seed` run successfully. Supabase client connects from mobile app. Auth hook can check session. Types compile. Zod schemas validate. `npm test` passes in mobile/. Foundation ready for user story implementation.

---

## Phase 3: US0 — Onboarding & Dual-Role Authentication (Priority: P1)

**Goal**: First-time users see a compelling onboarding screen, authenticate with Google or Apple Sign-In, select a role (consumer or business), and are routed to the correct tab experience.

**Independent Test**: Open app for the first time → see PrecoMapa brand, "Compre com inteligencia. Economize com dados." tagline, social proof stats, testimonials, featured deals, and dual CTAs. Tap "Sou Consumidor" → Google/Apple Sign-In → grant location → land on consumer Home tab. Sign out, reopen → "Sou Lojista" → authenticate → store setup → land on business Dashboard. Returning users skip onboarding.

### Implementation

- [X] T018 [P] [US0] Create social proof component `mobile/components/social-proof.tsx`: display platform_stats from `useSocialProof()` hook (rewritten to query Supabase `platform_stats` and `testimonials` tables per contracts/supabase-api.md). Show animated counters (Moti fade-in) for user count and avg savings. Horizontal scrollable testimonial cards. Depends on T010, T012
- [X] T019 [P] [US0] Create featured deals carousel `mobile/components/featured-deals-carousel.tsx`: horizontal FlatList of top 5 deals. Uses `useFeaturedDeals()` hook (rewritten to query Supabase per contracts/supabase-api.md: active promotions ordered by promo_price, client-side discount sort). Compact deal card showing product name, store name, promoPrice, discountPercent badge. Moti staggered fade-in. Depends on T010, T012
- [X] T020 [P] [US0] Create auth screen component `mobile/components/auth-buttons.tsx`: Google Sign-In button (via `@react-native-google-signin/google-signin`) and Apple Sign-In button (via `expo-apple-authentication`). Both call `supabase.auth.signInWithIdToken()` per contracts/supabase-api.md. Handle first-time Apple name caching. Depends on T010, T014
- [X] T021 [US0] Create store setup flow `mobile/components/store-setup.tsx`: modal/screen for business users after first auth. Collects store name (required), address (required), city/state (required), GPS coordinates (auto-detected via expo-location or manual map pin drop). Validates with `storeSetupSchema` (Zod). Creates store row in Supabase `stores` table and `store_members` entry with role 'owner'. Logo, phone, hours, CNPJ deferred to profile screen. Depends on T010, T013, T014
- [X] T022 [US0] Rewrite root layout `mobile/app/_layout.tsx`: check Supabase session via `use-auth` hook. Three states: (1) no session → show onboarding, (2) session + consumer role → render `(tabs)/` group, (3) session + business role → render `(business)/` group. Wrap app in `GestureHandlerRootView`, `SafeAreaProvider`, `BottomSheetModalProvider`. Import `global.css`. Depends on T014, T016
- [X] T023 [US0] Create onboarding screen `mobile/app/onboarding.tsx`: full screen composed of PrecoMapa logo + tagline ("Compre com inteligencia. Economize com dados."), city context, `<SocialProof />`, `<FeaturedDealsCarousel />`, and two CTA cards — "Sou Consumidor" (primary) and "Sou Lojista" (secondary). Each CTA shows `<AuthButtons />` then sets role in Supabase profiles table. Consumer → location permission → `(tabs)/`. Business → `<StoreSetup />` → `(business)/`. Depends on T018, T019, T020, T021, T022
- [X] T024 [US0] Create consumer tab layout `mobile/app/(tabs)/_layout.tsx`: 4 tabs — Home (house icon), Map (map-pin icon), Favorites (heart icon), Alerts (bell icon) — using lucide-react-native. NativeWind-styled tab bar with brand colors. Home as default tab. Depends on T012
- [X] T025 [US0] Create location permission request flow in `mobile/hooks/use-location.ts`: rewrite to use `expo-location` for real GPS. Request `requestForegroundPermissionsAsync()`. If denied, prompt for manual neighborhood/ZIP input. Store last known location. Keep `calculateDistanceKm()` Haversine utility. Depends on T010

### Tests

- [X] T026 [US0] Write US0 tests in `mobile/__tests__/us0/`: test auth flow (signInWithGoogle mock → profile created with consumer role, signInWithApple mock → profile created with business role), test role routing logic (_layout renders tabs for consumer, business tabs for business), test onboarding screen renders social proof and CTAs, test store setup form validation with Zod (missing name fails, valid input passes). Minimum 10 test cases. Depends on T018-T025

**Checkpoint**: US0 complete — onboarding displays with real Supabase data, Google/Apple auth works, role selection routes to correct tabs, location permission flow works, returning users skip to authenticated experience. Tests pass.

---

## Phase 4: US1 — Search, Browse, and Compare (Priority: P1)

**Goal**: Users search for products, browse by category and filters, and see enriched deal cards — all powered by Supabase queries with paid stores prioritized and fuzzy matching enabled.

**Independent Test**: Open Home tab → see filter chips, category tabs, deal feed with real Supabase data. Search "arroz" → matching deals. Search "leite moca" → fuzzy match returns "leite condensado" promotions. Tap "Bebidas" → filtered. Tap "Mais perto" → re-sorted by distance. Verify deal cards show discount %, "Verificado" badge, "X% abaixo do normal", "Melhor Preco" badge, gamification messages. Verify Premium stores appear above Free stores.

### Implementation

- [X] T027 [P] [US1] Create search bar `mobile/components/search-bar.tsx`: search input with lucide Search icon, debounced text input (300ms), clear button. Dispatches `setSearchQuery` to Zustand. Shows suggestions dropdown from `useSearch()`. Depends on T016
- [X] T028 [P] [US1] Create filter chips `mobile/components/filter-chips.tsx`: horizontal ScrollView of 3 chips — "Mais barato" (cheapest), "Mais perto" (nearest), "Acaba hoje" (expiring). Active chip highlighted. Dispatches `setSortMode` to Zustand. Depends on T016
- [X] T029 [P] [US1] Create category tabs `mobile/components/category-tabs.tsx`: horizontal ScrollView rendering categories from `useCategories()`. "Todos" tab shows all. Active tab underlined. Dispatches `setSelectedCategoryId` to Zustand. Depends on T016
- [X] T030 [US1] Create fuzzy search infrastructure: add `product_synonyms` table entries to seed data (T009), create Supabase RPC function `search_products(query text)` in migration that uses `similarity()` from pg_trgm for fuzzy matching on `products.name` UNION matches from `product_synonyms.term`. Returns product IDs ranked by similarity score. Threshold: similarity > 0.3. Depends on T008
- [X] T031 [US1] Rewrite `mobile/hooks/use-promotions.ts`: replace mock data imports with Supabase query per contracts/supabase-api.md. SELECT promotions with joined product and store, filter by status=active and end_date>now(), apply search query (ilike on product.name), categoryId filter. Order by `store.search_priority DESC` (paid first) then user sort (promo_price/end_date). Compute enrichment fields client-side (discountPercent, belowNormalPercent, gamificationMessage, distanceKm, isExpiringSoon). Compute "Melhor Preco" badge: mark promotion if store has the lowest promo_price for that product among all active promotions. Subscribe to realtime updates via `use-realtime` hook. Depends on T010, T012, T015, T025
- [X] T032 [US1] Rewrite `mobile/hooks/use-search.ts`: replace mock search with Supabase query. For queries >= 3 chars, call `search_products` RPC (pg_trgm fuzzy match + synonym lookup). For shorter queries, use `ilike` on `products.name` and `products.brand`. Return matching promotions and product name suggestions. Depends on T010, T012, T030
- [X] T033 [P] [US1] Rewrite `mobile/hooks/use-categories.ts`: replace mock import with Supabase query `from('categories').select('*').order('sort_order')` per contracts/supabase-api.md. Depends on T010
- [X] T034 [US1] Create deal card `mobile/components/deal-card.tsx`: enriched promotion card showing product name+brand, store logoInitial avatar (colored circle), promoPrice (large, green) + originalPrice (strikethrough), discountPercent badge ("-32%"), "Verificado" badge (if verified), "Melhor Preco" badge (if store has lowest price for this product, green ribbon), "X% abaixo do normal" tag, gamificationMessage, distanceKm, "Acaba hoje!" urgency styling if isExpiringSoon, store b2b_plan badge ("Dados basicos" for Free). Moti fade-in. Depends on T012
- [X] T035 [US1] Create home screen `mobile/app/(tabs)/index.tsx`: compose `<SearchBar />`, `<FilterChips />`, `<CategoryTabs />`, FlatList of `<DealCard />` from `usePromotions()` with Zustand state (searchQuery, selectedCategoryId, sortMode). "Perto de voce" section header when no search active (nearest deals, limit 5). Empty state "Nenhuma oferta encontrada". Skeleton loading during isLoading. Depends on T027-T029, T031, T034

### Tests

- [X] T036 [US1] Write US1 tests in `mobile/__tests__/us1/`: test promotions hook (search filters correctly, category filter, sort modes, enrichment computation — discountPercent, gamificationMessage thresholds, Melhor Preco badge logic), test search hook (fuzzy matching via RPC mock, synonym resolution, short query fallback to ilike), test categories hook (returns sorted), test deal card rendering (badges appear for correct conditions, gamification messages at thresholds). Minimum 15 test cases. Depends on T031-T035

**Checkpoint**: US1 complete — search (including fuzzy), filter, browse, enriched deal cards with Melhor Preco badges, search priority ordering all functional with real Supabase data. Realtime updates reflect admin changes. Tests pass.

---

## Phase 5: US2 — Explore Nearby Stores on Map (Priority: P2)

**Goal**: Interactive map with real GPS location and store markers from Supabase. Tapping a marker opens a bottom sheet with store info and top deals.

**Independent Test**: Open Map tab → map centered on real GPS location with store markers from Supabase. Tap a marker → bottom sheet with store name, address, distance, promotion count, top 3 deals. Pan/zoom loads stores dynamically.

### Implementation

- [X] T037 [US2] Rewrite `mobile/hooks/use-stores.ts`: replace mock imports with Supabase query per contracts/supabase-api.md. SELECT stores with nested active promotions and products. Compute activePromotionCount, top 3 deals by discount, and distanceKm. Depends on T010, T012, T025
- [X] T038 [P] [US2] Create store marker `mobile/components/store-marker.tsx`: custom MapView Marker rendering colored circle with store logoInitial text. Accepts `StoreWithPromotions` and `onPress` callback. Shows b2b_plan badge variant. Depends on T012
- [X] T039 [P] [US2] Create store bottom sheet `mobile/components/store-bottom-sheet.tsx`: `@gorhom/bottom-sheet` showing store name + logo avatar, address, distance, active promotion count, b2b_plan badge, vertical list of top 3 `<DealCard />` (compact variant). Snap points at 40% and 85%. "Navegar" button to open device's native maps app (FR-011). Depends on T034
- [X] T040 [US2] Create map screen `mobile/app/(tabs)/map.tsx`: MapView centered on real GPS from `useLocation()`, renders `<StoreMarker />` for each store from `useStores()`. On marker press, opens `<StoreBottomSheet />`. User location indicator dot. Dynamic loading on pan/zoom if stores are geofiltered. Depends on T025, T037, T038, T039
- [X] T041 [P] [US2] Handle map fallback when location denied: show search/ZIP input at top of map, center on entered location. Display friendly message "Permita acesso a localizacao para ver lojas perto de voce". Depends on T025

### Tests

- [X] T042 [US2] Write US2 tests in `mobile/__tests__/us2/`: test location hook (permission granted returns GPS coords, permission denied triggers manual input flow), test stores hook (Supabase query mock returns stores with promotions, distance calculation correctness), test bottom sheet renders store info and deals. Minimum 8 test cases. Depends on T037-T041

**Checkpoint**: US2 complete — map renders with real GPS, Supabase store markers, bottom sheet with live promotions, location denial handled gracefully. Tests pass.

---

## Phase 6: US3 — Favorites & Alerts with Push Notifications (Priority: P3)

**Goal**: Real favorites persisted in Supabase (Free: max 10, Plus: unlimited). Real alerts with push notifications when new promotions match favorites.

**Independent Test**: Add a product to favorites → verify persisted in Supabase. Hit 10-favorite limit on Free → see upgrade prompt. Create an alert → simulate new matching promotion → receive push notification. Open Alerts tab → see alert feed.

### Implementation

- [X] T043 [US3] Create `mobile/hooks/use-favorites.ts`: Supabase CRUD on `user_favorites` table per contracts/supabase-api.md. `addFavorite(productId)`, `removeFavorite(productId)`, `getFavorites()` with joined product and active promotions. Handles RLS plan limit enforcement (Free: 10). Returns `{ favorites, isLoading, add, remove, isFavorited }`. Depends on T010, T012
- [X] T044 [US3] Create `mobile/hooks/use-alerts.ts`: Supabase CRUD on `user_alerts` table per contracts/supabase-api.md. `createAlert(productId, targetPrice?, radiusKm?)` with Zod validation (`alertSchema`). `disableAlert(alertId)`, `getAlerts()` with joined product. Handles RLS plan limit (Free: 3, Plus/Family: unlimited). Returns `{ alerts, isLoading, create, disable }`. Depends on T010, T012, T013
- [X] T045 [US3] Create favorites screen `mobile/app/(tabs)/favorites.tsx`: FlatList of favorited products from `useFavorites()` showing product name, brand, best current promoPrice, store name, filled heart icon, "Remover" swipe action. Free tier shows count badge "3/10 favoritos" and upgrade banner when approaching limit. Empty state "Nenhum favorito ainda". Depends on T043, T034
- [X] T046 [US3] Create alerts screen `mobile/app/(tabs)/alerts.tsx`: FlatList of active alerts from `useAlerts()` showing product name, target price (if set), radius, toggle to disable. Section for recent notifications (from notification history). Free tier shows "1/3 alertas" count and upgrade banner. Empty state with bell icon and "Receba notificacoes quando seus produtos favoritos entrarem em promocao". Depends on T044
- [X] T047 [US3] Create push notification setup in `mobile/hooks/use-push-notifications.ts`: register for push notifications via `expo-notifications`, get Expo push token, store token in Supabase `profiles.push_token`. Configure `setNotificationHandler` for foreground behavior. Handle notification tap deep linking to specific promotion. Depends on T010, T014
- [X] T048 [US3] Create `supabase/functions/notify-favorite-match/index.ts` Edge Function: triggered by database webhook on `promotions` INSERT. Query `user_favorites` and `user_alerts` for matching product_id within user's radius_km. Send push notification via Expo push API (`https://exp.host/--/api/v2/push/send`) to each matching user's push_token. Include promotion details in notification body (pt-BR)
- [X] T049 [P] [US3] Create `supabase/functions/expire-promotions/index.ts` Edge Function: scheduled cron (every 15 minutes). UPDATE promotions SET status='expired' WHERE status='active' AND end_date < now(). Log count of expired promotions

### Tests

- [X] T050 [US3] Write US3 tests in `mobile/__tests__/us3/`: test favorites hook (add/remove CRUD, isFavorited check, plan limit enforcement — Free user adding 11th triggers error), test alerts hook (create with Zod validation — valid passes, invalid target_price fails, plan limit — Free user creating 4th triggers error), test push notification registration (token stored in profile). Minimum 10 test cases. Depends on T043-T049

**Checkpoint**: US3 complete — favorites persist in Supabase with plan limits enforced, alerts trigger real push notifications, upgrade prompts appear at limits. Tests pass.

---

## Phase 7: US4 — Business Management (Dual-Channel) (Priority: P4)

**Goal**: Business users manage their store via the mobile app (dashboard, offers CRUD, AI importer, store profile) and/or the responsive web admin panel. Both channels share the same Supabase backend. Super admin can review flagged promotions.

**Independent Test**: Log in as business user on mobile → see dashboard with KPIs. Create a promotion for "Coca-Cola 2L" at R$7.99 → visible to consumers immediately (Realtime). Edit and delete promotions. Access admin panel on smartphone browser → verify responsive layout. Log in as super_admin → review flagged promotions in moderation queue.

### Implementation

- [X] T051 [US4] Create business tab layout `mobile/app/(business)/_layout.tsx`: 4 tabs — Dashboard (chart icon), Ofertas (tag icon), Importador (upload icon), Perfil (store icon) — using lucide-react-native. Dashboard as default tab. NativeWind-styled tab bar. Depends on T012
- [X] T052 [US4] Create business dashboard screen `mobile/app/(business)/dashboard.tsx`: display store KPIs from Supabase per contracts/supabase-api.md — active promotions count, total views (placeholder metric in D1), plan name and usage ("3/5 ofertas este mes" for Free, computed by counting promotions with created_at in current month). Show plan-based feature badges. "Upgrade" button for Free users. Depends on T010, T012, T051
- [X] T053 [US4] Create offers management screen `mobile/app/(business)/offers.tsx`: FlatList of store's promotions from Supabase (ordered by created_at DESC). Each item shows product name, promo_price, end_date, status badge. "Nova Oferta" FAB opens creation form — product search/select from catalog, original_price, promo_price, start_date, end_date. Validates with `promotionSchema` (Zod). Edit and delete via swipe actions. Supabase mutations per contracts/supabase-api.md. Monthly limit check (Free: 5/month via row counting). Depends on T010, T012, T013, T051
- [X] T054 [US4] Create AI importer screen `mobile/app/(business)/importer.tsx`: camera/gallery picker for promotional flyer image. Upload to Supabase Storage, send to existing AI extraction endpoint (OpenAI). Display extracted products + prices for review. Bulk insert on confirmation. Plan-gated: Free (disabled, shows upgrade prompt), Premium (4/month), Premium+ (unlimited). Depends on T010, T051
- [X] T055 [US4] Create store profile screen `mobile/app/(business)/profile.tsx`: form showing store name, address, city/state, phone, CNPJ, operating hours, logo (upload to Supabase Storage). GPS coordinates with map preview. Validates with Zod. Supabase UPDATE per contracts/supabase-api.md. Depends on T010, T012, T013, T051
- [X] T056 [US4] Rewrite admin panel auth: update `src/features/auth/session.ts` to use Supabase SSR client (from T011) instead of cookie mock. Update `src/features/auth/actions.ts` with Supabase Auth sign-in/sign-out actions. Update `src/app/painel/acesso/page.tsx` login page to use Supabase email/password auth (business users). Validate inputs with Zod. Depends on T011, T013
- [X] T057 [US4] Rewrite admin offers: update `src/features/offers/offers-store.tsx` to replace localStorage with Supabase queries. Fetch promotions for the business user's store(s), create/update/delete via Supabase mutations. Validate promotion form with Zod. Keep existing UI components, replace data layer. Depends on T011
- [X] T058 [US4] Make admin panel mobile-responsive: update `src/features/panel/components/panel-shell.tsx` for responsive layout — collapsible sidebar on mobile, touch-friendly controls (44px min tap targets), responsive data tables. Add viewport meta tag if missing. Test on 375px viewport (iPhone SE). Depends on T056
- [X] T059 [US4] Create moderation queue page `src/app/painel/(protected)/super/page.tsx` per FR-031: list promotions with `status = 'pending_review'` (price outliers: >80% discount or promo_price < R$0.50). Show product name, store name, original_price, promo_price, discount %, flagging reason. Actions: "Aprovar" (set status to active, verified to true), "Rejeitar" (delete or set status to expired). Only visible to users with super_admin role. Depends on T011

### Tests

- [X] T060 [US4] Write US4 tests in `mobile/__tests__/us4/` and `src/__tests__/us4/`: test business dashboard KPI computation (promotion count in current month), test offers CRUD (create with Zod validation — valid passes, promo_price > original_price fails, monthly limit check), test admin auth (Supabase session management), test promotion limit function logic (Free: 5/month boundary). Minimum 12 test cases. Depends on T051-T059

**Checkpoint**: US4 complete — business mobile app and responsive admin panel both manage the same Supabase data. Promotions created on either channel appear to consumers immediately. Flagged promotions appear in moderation queue. Tests pass.

---

## Phase 8: US5 — B2B Plans & Billing (Priority: P5)

**Goal**: Stripe-powered subscription system for business users. Free → Premium upgrade via Stripe Checkout with 7-day trial. Competitive intelligence and email alerts for Premium. Launch offer (50% off 3 months).

**Independent Test**: Register on Free plan → verify limits (5 promotions/month, no AI). Upgrade to Premium via Stripe Checkout → 7-day trial starts → Premium features unlock immediately (AI importer, competitive dashboard, email alerts). Test annual billing toggle. Apply launch offer coupon. View invoices in Customer Portal.

### Implementation

- [X] T061 [P] [US5] Create Stripe server SDK in `src/lib/stripe.ts`: initialize Stripe with `STRIPE_SECRET_KEY`. Export typed `stripe` instance. Depends on T003
- [X] T062 [US5] Create Stripe webhook handler `src/app/api/webhooks/stripe/route.ts`: verify webhook signature with `STRIPE_WEBHOOK_SECRET` (read body as `req.text()`, NOT `.json()`). Validate payload with Zod schema. Handle events: `checkout.session.completed` (update store b2b_plan + stripe_customer_id + stripe_subscription_id + trial_ends_at in Supabase), `customer.subscription.updated` (plan changes, trial end), `customer.subscription.deleted` (downgrade to free after grace period), `invoice.payment_succeeded` (record payment). Use Supabase service role client for updates. Idempotency checks on event IDs. Depends on T011, T013, T061
- [X] T063 [US5] Create plan management page `src/app/painel/(protected)/plano/page.tsx`: comparison table showing all B2B tiers (Free, Premium, Premium+, Enterprise) with features, limits, pricing per spec.md. Current plan highlighted. Monthly/annual billing toggle with 16% discount callout (Premium: R$3,014/yr). "Upgrade" button → Stripe Checkout. "Manage" button → Stripe Customer Portal. Plan usage section (promotions this month, stores, AI imports). Depends on T011, T061
- [X] T064 [US5] Create checkout and portal server actions in `src/features/billing/actions.ts`: `createCheckoutSession(priceId, storeId)` per contracts/supabase-api.md with 7-day trial, CC required, auto-convert. `redirectToPortal(stripeCustomerId)` for self-service billing. `createCheckoutWithLaunchOffer(priceId, storeId, couponId)` with 50% off coupon. Validate inputs with Zod. Depends on T013, T061
- [X] T065 [P] [US5] Create competitive intelligence hook `mobile/hooks/use-competitive.ts`: calls Supabase RPC `get_competitor_prices(store_id, radius_km)` and `get_store_rankings(store_id, radius_km)` per contracts/supabase-api.md. Returns competitor prices, store ranking, and competitiveness metrics. Plan-gated: Premium only. Depends on T010, T012
- [X] T066 [US5] Create Phase 2 migration `supabase/migrations/002_phase2_features.sql`: add tables for shopping_lists, shopping_list_items, price_snapshots per data-model.md. Create RPC functions get_competitor_prices and get_store_rankings with Haversine distance calculation (no PostGIS). Add RLS policies for new tables. Depends on T008
- [X] T067 [US5] Create daily digest Edge Function `supabase/functions/daily-digest/index.ts`: scheduled daily at 8am BRT. For each Premium store, query competitor prices within 5km, generate digest email with: products where store is 15%+ more expensive, products where store has best price, competitor price drops. Send via Resend API. HTML template with inline styles. Unsubscribe link (LGPD). Depends on T008
- [X] T068 [P] [US5] Create trial reminders Edge Function `supabase/functions/trial-reminders/index.ts`: scheduled daily. Query stores where trial_ends_at is approaching. Send emails via Resend at day 3 ("Voce ja usou metade do seu periodo de teste"), day 5 ("Faltam 2 dias"), day 7 ("Ultimo dia! Assine para nao perder acesso"). Each includes direct link to Stripe Checkout
- [X] T069 [US5] Create competitive intelligence dashboard component for business mobile app. Add a "Inteligencia Competitiva" section to `mobile/app/(business)/dashboard.tsx` using `use-competitive` hook: show product ranking table (my price vs market avg/min), competitiveness score, and price comparison chart. Visible only to Premium+ users, upgrade prompt for Free. Depends on T052, T065
- [X] T070 [P] [US5] Create plan comparison modal `mobile/components/plan-comparison.tsx`: reusable modal showing B2B tier comparison (Free vs Premium vs Premium+ vs Enterprise) with features, limits, and pricing. Used in upgrade prompts throughout business screens. Monthly/annual toggle. "Iniciar teste gratis de 7 dias" CTA. Depends on T012

### Tests

- [X] T071 [US5] Write US5 tests in `src/__tests__/us5/`: test Stripe webhook handler (mock all 4 event types — checkout.session.completed updates store plan, subscription.deleted downgrades to free, idempotency rejects duplicate events), test checkout session creation (valid priceId passes, trial configured correctly), test billing actions (Zod validation on inputs), test competitive intelligence hook (mock RPC returns competitor data). Minimum 12 test cases. Depends on T061-T070

**Checkpoint**: US5 complete — Stripe checkout works with trial, webhook updates plan in Supabase, plan limits enforced, competitive intelligence available for Premium, email alerts sent daily, launch offer coupon applies. Tests pass.

---

## Phase 9: US6 — B2C Subscriptions (Priority: P5)

**Goal**: RevenueCat-powered consumer subscriptions. Free → Plus upgrade via in-app purchase. Smart shopping lists, optimized routes, price history graphs for Plus users. Free tier limits enforced with upgrade prompts.

**Independent Test**: Use app as free consumer → hit 10-favorite limit → see paywall. Subscribe to Plus via in-app purchase → unlimited favorites unlock, ads hidden, smart lists accessible. Create shopping list → see optimization suggestions. View price history graph for a product.

### Implementation

- [X] T072 [US6] Create RevenueCat initialization `mobile/lib/revenue-cat.ts`: configure `Purchases.configure()` with platform-specific API keys (EXPO_PUBLIC_RC_APPLE_KEY, EXPO_PUBLIC_RC_GOOGLE_KEY). Call `Purchases.logIn(supabaseUserId)` after auth to link RevenueCat user. Export initialization function. Depends on T010, T014
- [X] T073 [US6] Create subscription hook `mobile/hooks/use-subscription.ts`: wraps RevenueCat `getCustomerInfo()` and `addCustomerInfoUpdateListener()`. Returns `{ plan, isPlus, isFamily, isLoading, offerings, purchasePackage }`. Syncs entitlements to Supabase `profiles.b2c_plan`. Depends on T072
- [X] T074 [US6] Create paywall component `mobile/components/paywall.tsx`: modal showing Plus and Family tiers with pricing (R$9.90/mes, R$19.90/mes), features list, annual discount (16% — R$99/yr, R$199/yr), and purchase buttons. Uses `react-native-purchases-ui` PaywallView or custom UI with RevenueCat offerings. "Iniciar teste gratis de 7 dias". Depends on T073
- [X] T075 [US6] Create smart shopping list hook `mobile/hooks/use-shopping-list.ts`: Supabase CRUD on `shopping_lists` and `shopping_list_items` per contracts/supabase-api.md. Optimization function: fetch promotions for all list products, run greedy algorithm (per research.md R12) to find cheapest store combination. Calculate estimated savings vs nearest store. Generate Google Maps route URL. Plan-gated: Plus only. Depends on T010, T012, T066
- [X] T076 [US6] Create smart shopping list screen `mobile/components/smart-list.tsx`: create/edit lists, add products (search from catalog), set quantities. "Otimizar" button runs optimization → shows store breakdown (which items at which store), total cost, estimated savings, and "Navegar" button with optimized route. Recurring list templates. Check-off items during shopping. Depends on T075
- [X] T077 [US6] Create price history hook `mobile/hooks/use-price-history.ts`: query `price_snapshots` from Supabase per contracts/supabase-api.md. Returns 30/60/90-day data points (min_promo_price, avg_promo_price, store_count, reference_price). Compute trend analysis and "best time to buy" indicator. Plan-gated: Plus only. Depends on T010, T012, T066
- [X] T078 [US6] Create price history graph component `mobile/components/price-chart.tsx`: line chart showing price trends over selected period (30/60/90 days). Lines for min promo price, avg promo price, and reference price. "Melhor momento para comprar" indicator. Uses `react-native-chart-kit` or Victory Native. Depends on T077
- [X] T079 [US6] Create optimized routes feature: after smart list optimization, build Google Maps Directions API URL with waypoints (user location → stores in optimal order). `optimizeWaypoints: true` for shortest route. Display estimated driving time and distance. Deep link to Google Maps / Apple Maps for turn-by-turn. Depends on T075, T025
- [X] T080 [US6] Create daily-price-snapshot Edge Function `supabase/functions/daily-price-snapshot/index.ts`: scheduled daily at 1am BRT. Query all products with active promotions, aggregate min/avg promo_price and store_count per product. Upsert into `price_snapshots` (unique on product_id + date). Also update `products.reference_price` as rolling 30-day average of min_promo_price from snapshots (FR-014 auto-computation). Clean up snapshots older than 90 days (or 180 for Premium+ B2B, D2). Depends on T066
- [X] T081 [US6] Implement free tier limits and upgrade prompts throughout consumer app: add favorite → check limit (10) → show paywall if exceeded. Create alert → check limit (3) → show paywall. Placeholder ad banners on Free (simple "Upgrade para Plus" cards). Store comparison limit (5 stores). All limit checks use Supabase RLS + client-side guards. Depends on T043, T044, T073, T074

### Tests

- [X] T082 [US6] Write US6 tests in `mobile/__tests__/us6/`: test RevenueCat initialization (configure called with correct keys, logIn links Supabase user), test subscription hook (entitlement check — Plus returns isPlus:true, Free returns isPlus:false), test shopping list optimization algorithm (greedy: single store vs multi-store, savings calculation), test price history hook (90-day range query, trend computation), test free tier limit enforcement (11th favorite triggers paywall). Minimum 12 test cases. Depends on T072-T081

**Checkpoint**: US6 complete — RevenueCat paywall works, Plus features unlock on subscription, smart lists optimize store combinations, price history graphs display, reference price auto-updates, free tier limits enforced with upgrade prompts. Tests pass.

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: Animations, loading states, offline cache, LGPD compliance, consumer settings screen, EAS production builds, and final validation.

- [X] T083 Add Moti stagger animations to deal card lists on Home, Favorites, and business Offers screens. Fade-in + translateY with staggered delay per item. Smooth tab transition animations in both `(tabs)/_layout.tsx` and `(business)/_layout.tsx`
- [X] T084 Add skeleton loading placeholders to all data-fetching screens: Home (3-4 pulsing card shapes), Map (map placeholder), Favorites, Alerts, Dashboard, Offers. Display during Supabase query loading states
- [X] T085 Implement offline cache per FR-010: wrap Supabase queries with AsyncStorage cache layer. On network error, display last-loaded results with "Ultima atualizacao: [timestamp]" banner and retry button. No background sync or local SQLite in D1
- [X] T086 Implement LGPD compliance per FR-027 through FR-030: create privacy policy screen accessible from onboarding and profile settings. Capture consent at sign-up (timestamp + version stored in Supabase). Account deletion flow (remove profile, favorites, alerts, push tokens, disassociate store memberships). Data export (JSON) on request
- [X] T087 Create consumer profile/settings screen `mobile/app/(tabs)/profile.tsx` or settings modal: display name, email, city, search radius slider (1-50 km, default 5 km per FR-002), notification preferences (on/off), B2C plan status, "Exportar meus dados" button, "Excluir conta" button, privacy policy link, sign out. Add 5th tab or gear icon in header. Depends on T014, T086
- [X] T088 Configure EAS Build profiles for production: iOS certificates/provisioning, Android keystore, app signing. Environment variable secrets in EAS. Version management with autoIncrement. Build `preview` profile for internal testing
- [X] T089 Create app store metadata: app name, description (pt-BR), keywords, screenshots (6.7" and 5.5"), privacy policy URL, App Store categories, Google Play content rating. Per quickstart.md requirements
- [X] T090 End-to-end validation: follow quickstart.md demo walkthrough (10 steps) on both iOS and Android. Verify all user stories independently. Verify Stripe webhook processing. Verify push notifications on physical device. Verify admin panel on smartphone browser. Verify fuzzy search returns synonym matches
- [X] T091 Run full test suite (`npm test` in mobile/ and root). Fix any failing tests. Ensure all acceptance scenarios from spec.md are covered by at least one test
- [X] T092 Code cleanup: remove unused imports, ensure consistent NativeWind class naming, verify all pt-BR strings, remove demo-only code paths (mock data fallbacks should remain for dev seed only), run `npm run lint` and fix all issues. Ensure zero ESLint warnings per constitution Principle I

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 — BLOCKS all user stories
- **US0 (Phase 3)**: Depends on Phase 2 — specifically T010, T012, T013, T014, T016
- **US1 (Phase 4)**: Depends on Phase 2 — specifically T010, T012, T015, T016, T025
- **US2 (Phase 5)**: Depends on Phase 2 + T025 (location) + T034 (deal card from US1)
- **US3 (Phase 6)**: Depends on Phase 2 — specifically T010, T012, T013. Uses T034 from US1
- **US4 (Phase 7)**: Depends on Phase 2 — specifically T010, T011, T012, T013. Independent of consumer stories
- **US5 (Phase 8)**: Depends on T003, T008, T011 (admin Supabase), T061 (Stripe SDK). Partially depends on US4 (T052 for dashboard)
- **US6 (Phase 9)**: Depends on T010, T012, T014, T066 (Phase 2 migration). Uses T043/T044 from US3 for limit integration
- **Polish (Phase 10)**: Depends on all user story phases being complete

### User Story Dependencies

- **US0 (P1)**: After Phase 2. Independent of other stories.
- **US1 (P1)**: After Phase 2. Independent of US0 (different screen). Provides `<DealCard />` used by US2, US3.
- **US2 (P2)**: After Phase 2 + US1 `<DealCard />` (T034). Can start map components in parallel.
- **US3 (P3)**: After Phase 2. Reuses `<DealCard />` from US1. Independent otherwise.
- **US4 (P4)**: After Phase 2. Fully independent of consumer stories (different route group + admin panel).
- **US5 (P5)**: After Phase 2 + Phase 8 setup tasks. Partially depends on US4 for business dashboard integration.
- **US6 (P5)**: After Phase 2 + Phase 2 features migration (T066). Depends on US3 for limit integration.

### Parallel Execution Opportunities

```
Phase 1 parallel groups:
  Group A: T001 → T002 (sequential — install needs project)
  Group B: T003, T004, T005, T006, T007 (all [P] after T001)

Phase 2 parallel groups:
  Group A: T008 → T009 (seed after schema)
  Group B: T010, T011 (both [P] after Phase 1)
  Group C: T012 (after Phase 1)
  Group D: T013 (Zod, [P] after Phase 1)
  Group E: T014, T015 (both [P] after T010)
  Group F: T016 (after T012)
  Group G: T017 (tests, after T010, T013, T014, T016)

Phase 3+4 can run in parallel (different route groups):
  US0: T018, T019, T020 (all [P]) → T021 → T022 → T023 → T024, T025 → T026
  US1: T027, T028, T029, T033 (all [P]) → T030 → T031, T032 → T034 → T035 → T036

Phase 5 after T034 (deal card):
  US2: T037 + T038, T039 ([P]) → T040 + T041 → T042

Phase 6 in parallel with Phases 3-5:
  US3: T043, T044 → T045, T046 | T047, T048, T049 ([P] where applicable) → T050

Phase 7 independent of consumer phases:
  US4: T051 → T052-T055 (mobile) | T056 → T057, T058, T059 (admin) → T060

Phase 8 after admin setup:
  US5: T061 ([P]) → T062, T063, T064 | T065 ([P]) | T066 → T067, T068 ([P]) | T069 | T070 ([P]) → T071

Phase 9 after Phase 2 features:
  US6: T072 → T073 → T074 | T075 → T076, T079 | T077 → T078 | T080 | T081 → T082
```

### D1 Phase Mapping

**D1 Phase 1 (MVP, months 1-3)**: Phases 1-7 (T001-T060) — Free plans, all core features, tests
**D1 Phase 2 (Monetization, months 4-6)**: Phases 8-10 (T061-T092) — Premium + Plus, payments, intelligence, polish

---

## Implementation Strategy

### Recommended Sequential Order (Single Developer)

1. **Phase 1**: Setup (T001 → T002 → T003-T007 in parallel)
2. **Phase 2**: Foundational (T008 → T009, T010-T011 in parallel → T012 → T013 → T014-T015 in parallel → T016 → T017)
3. **Phase 3**: US0 Onboarding (T018-T020 in parallel → T021 → T022 → T023 → T024, T025 → T026)
4. **Phase 4**: US1 Search/Browse (T027-T029, T033 in parallel → T030 → T031, T032 → T034 → T035 → T036)
5. **Phase 5**: US2 Map (T037 + T038-T039 in parallel → T040, T041 → T042)
6. **Phase 6**: US3 Favorites/Alerts (T043-T044 in parallel → T045-T049 → T050)
7. **Phase 7**: US4 Business (T051 → T052-T055 | T056 → T057-T059 → T060)
8. **Phase 8**: US5 B2B Billing (T061 → T062-T064 | T065-T070 → T071)
9. **Phase 9**: US6 B2C Subscriptions (T072-T074 → T075-T081 → T082)
10. **Phase 10**: Polish (T083-T092)

### MVP Scope (Minimum Viable Product)

Complete **Phases 1-7 (T001-T060)** for a fully functional app with Free plans, all core consumer features (search with fuzzy matching, map, favorites, alerts), business management (mobile + web + moderation), dual-role auth, and test coverage for all user stories. This is D1 Phase 1 — app store publishable without payments.

### Monetization Scope

Add **Phases 8-10 (T061-T092)** for Premium B2B (Stripe), Plus B2C (RevenueCat), competitive intelligence, smart lists, price history, and production polish. This completes D1 Phase 2.

---

## Notes

- [P] tasks = different files, no dependencies within the same phase
- All UI text MUST be in Portuguese (pt-BR) per FR-008
- NativeWind v4 uses Tailwind CSS 3.4.x syntax (NOT Tailwind v4.x) per constitution amendment v1.1.0
- `--legacy-peer-deps` required for some mobile installs (React 19 conflicts)
- Supabase client MUST use `detectSessionInUrl: false` for React Native
- Apple Sign-In provides name/email only on FIRST sign-in — cache immediately
- RevenueCat requires development builds (NOT Expo Go) for testing
- Monthly limits checked by counting rows with `created_at` in current month (BRT timezone) — no counter columns
- Price snapshots use daily aggregates, not per-event history
- Free stores appear below paid stores via `search_priority` column ordering
- Zod validation MUST be used for all form inputs and webhook payloads per constitution
- Every user story phase includes a test task covering acceptance scenarios per constitution Principle II
- Fuzzy search uses PostgreSQL `pg_trgm` extension + `product_synonyms` table per FR-012
- "Melhor Preco" badge computed by comparing promo_price across stores for same product
- Reference price auto-updated daily via `daily-price-snapshot` Edge Function (rolling 30-day avg)
- Commit after each task or logical group for clean git history
- Stop at any checkpoint to validate independently

---

## Phase 11: D1.5 — Price Intelligence Authority

**Purpose**: Strategic pivot to Regional Price Intelligence Authority. Monthly price index engine, data quality pipeline, public index page, admin management, and landing page rebrand.

**Prerequisites**: Phase 9 complete (daily-price-snapshot functional), Phase 7 complete (admin panel).

### Database & Backend

- [X] T093 Create migration `supabase/migrations/004_price_intelligence.sql`: tables (price_indices, price_index_categories, price_index_products, price_quality_flags), indexes, RLS policies (public read for published indices, admin full access), RPCs (get_latest_index, get_price_movers), add store_id to price_snapshots

- [X] T094 Enhance `supabase/functions/daily-price-snapshot/index.ts`: add outlier detection (flag promo_price <30% or >150% of reference_price), staleness check (7+ days no data), insert flags into price_quality_flags, extend retention from 90 to 365 days for YoY index calculation

- [X] T095 Create `supabase/functions/monthly-price-index/index.ts`: CPI-like methodology — aggregate daily snapshots for prior month per city, compute category-weighted index (base 100), MoM/YoY changes, data quality score (0-100), auto-publish if score >= 70

### Shared Utilities

- [X] T096 [P] Add Price Intelligence types to `src/features/shared/types.ts`: PriceIndex, PriceIndexCategory, PriceIndexProduct, QualityFlag, IndexStatus, QualityFlagType, QualityFlagSeverity

- [X] T097 [P] Create `src/lib/index-calculator.ts`: formatIndexValue, formatChangePercent, getTrend, getTrendColor, getTrendBgColor, formatPeriodLabel, formatShortMonth, getQualityLabel, getIndexSummary, mapDbToIndex, mapDbToCategory utility functions

### Public Index Page

- [X] T098 Create `src/app/(public)/layout.tsx`: institutional public layout with clean header (logo + "Inteligencia Regional de Precos"), nav links, footer ("Plataforma independente de inteligencia de precos")

- [X] T099 Create `src/app/(public)/indice/page.tsx`: SSR main index page with generateMetadata (dynamic OG tags), Schema.org structured data (Dataset type), fetch latest 12 published indices, category breakdown, top movers via get_price_movers RPC

- [X] T100 [P] Create `src/app/(public)/indice/components/index-hero.tsx`: display index value, MoM/YoY trend badges, product/store/data point counts, quality score badge

- [X] T101 [P] Create `src/app/(public)/indice/components/index-chart.tsx`: SVG-based 12-month line chart with area fill, data points, month labels, y-axis ticks

- [X] T102 [P] Create `src/app/(public)/indice/components/category-breakdown.tsx`: table with category name, avg/min/max price, MoM change, weight, product count

- [X] T103 [P] Create `src/app/(public)/indice/components/price-movers.tsx`: dual panel (risers + fallers) with product name, category, avg price, MoM change badge

- [X] T104 [P] Create `src/app/(public)/indice/components/historical-list.tsx`: list of past indices linking to detail pages

- [X] T105 Create `src/app/(public)/indice/[month]/page.tsx`: historical month detail with generateMetadata, index hero, category breakdown, top movers (10 items)

### Admin Pages

- [X] T106 Create `src/app/painel/(protected)/super/indice/page.tsx`: view draft/published/archived indices, quality score detail. Create `index-admin-actions.tsx` (publish/archive buttons) and `index-server-actions.ts` (updateIndexStatus server action)

- [X] T107 Create `src/app/painel/(protected)/super/qualidade/page.tsx`: KPI cards (coverage %, flags count, severity breakdown), flag list with resolve action. Create `quality-actions.tsx` and `quality-server-actions.ts`

- [X] T108 Update `src/features/panel/components/panel-shell.tsx`: add "Indice de Precos" and "Qualidade Dados" nav items to superNavItems array with TrendingUp and AlertTriangle icons

### Landing Page & Metadata

- [X] T109 Rebrand `src/app/page.tsx`: replace demo content with institutional "Inteligencia Regional de Precos" hero, three audience CTAs (consumers, business, public data), trust bar

- [X] T110 Update `src/app/layout.tsx`: metadata title to "PrecoMapa | Inteligencia Regional de Precos", description to institutional positioning

### Spec Updates

- [X] T111 [P] Update spec files: add D1.5 scope to spec.md (strategic positioning section, FR-040 through FR-045), data-model.md (new tables), plan.md (D1.5 phase), tasks.md (Phase 11), contracts/supabase-api.md (new RPCs)

**Checkpoint**: Public index page loads at `/indice` without auth. Monthly index Edge Function produces valid output. Data quality flags insert correctly. Admin can publish/archive indices. OG tags render on share. Landing page reflects institutional positioning. Existing D1 features unaffected.
