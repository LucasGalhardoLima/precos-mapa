# Tasks: POUP B2C Consumer UI

**Input**: Design documents from `/specs/002-b2c-consumer-ui/`
**Prerequisites**: plan.md, spec.md, data-model.md, contracts/hooks.md, research.md, quickstart.md

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Project Configuration)

**Purpose**: Extend Tailwind config and color constants with both palette color tokens. No components or hooks yet — just configuration.

- [ ] T001 [P] Update `mobile/tailwind.config.ts` — add both palette color namespaces: `encarte` (paper #FAF7F0, chalk #1E2820, green #2A6041, red #C8392B, mustard #E8A020) and `fintech` (box #FAFBFC, surface #F2F4F7, line #DDE2EA, graphite #0D1520, lead #4A5568, silver #8A97A8, deepGreen #0B5E3A, mediumGreen #167A4D, vividGreen #22A06B, softGreen #E2F5EC, offerRed #C8192B, activeRed #E41E32, softRed #FDEAEC, gold #9A6108, brightGold #CF8B12, lightGold #F9EFD8, night #0C1829, dawn #162438, mist #E8EDF5). Keep existing brand/surface/text/semantic/border tokens for backward compatibility
- [ ] T002 [P] Update `packages/shared/src/constants/colors.ts` — add `encarte` and `fintech` palette objects matching the hex values added to Tailwind config. Add `tab` colors for both palettes (encarte: green #2A6041 active, fintech: deepGreen #0B5E3A active)
- [ ] T003 [P] Create `mobile/theme/palettes.ts` — define two `as const` PaletteTokens objects (`ENCARTE_TOKENS` and `FINTECH_TOKENS`) with all semantic fields: bg, surface, textPrimary, textSecondary, textHint, primary, primaryLight, header, headerText, border, discountRed, discountRedActive, discountRedSoft, gold, goldBright, goldLight, dark, darkSurface, mist. Export `PaletteTokens` type. See `contracts/hooks.md` for the full interface

---

## Phase 2: Foundational (Theme Infrastructure)

**Purpose**: Theme store, context provider, and hooks that ALL screens depend on. Must complete before any user story.

**CRITICAL**: No user story work can begin until this phase is complete.

- [ ] T004 Create `mobile/theme/store.ts` — Zustand store with `persist` middleware using `createJSONStorage(() => AsyncStorage)`. State: `palette: 'encarte' | 'fintech'` (default: `'encarte'`). Actions: `togglePalette()`, `setPalette(palette)`. Store name: `'poup-theme'`. See `contracts/hooks.md` for exact interface
- [ ] T005 [P] Create `mobile/theme/use-theme.ts` — `useTheme()` hook that reads from the theme store and returns `{ palette, tokens: PaletteTokens, togglePalette }`. Selects the correct token set from `palettes.ts` based on active palette
- [ ] T006 [P] Create `mobile/theme/provider.tsx` — `ThemeProvider` React Context component that wraps the app root. Reads from `useTheme()` and provides tokens + palette via context. Export `useThemeContext()` consumer hook
- [ ] T007 Create `mobile/hooks/use-theme-classes.ts` — `useThemeClasses()` hook that returns a `ThemeClasses` object mapping semantic keys to Tailwind class strings for the active palette (e.g., `bg` → `'bg-encarte-paper'` or `'bg-fintech-box'`). Memoized with `useMemo`. See `contracts/hooks.md` for the full `ThemeClasses` interface

**Checkpoint**: Theme infrastructure ready — palette toggle works, all hooks return correct tokens for each palette.

---

## Phase 3: User Story 1 — Design System & Theming Foundation (Priority: P1)

**Goal**: Build all palette-variant visual metaphor components, the floating tab bar, skeleton components, inline error banner, and restructure the tab layout. After this phase, a component gallery can render every primitive in both palettes.

**Independent Test**: Render a gallery screen showing all primitives (price tag card, clean card, barcode divider, rule divider, stamp badge, pill badge, receipt separator, coupon line, floating tab bar, skeleton, inline error) in both palettes, toggled by a switch.

### Encarte Components (Palette A)

- [ ] T008 [P] [US1] Create `mobile/components/encarte/price-tag-card.tsx` — SVG-based price tag shaped card using `react-native-svg`. Rectangular body with rounded bottom corners, circular hole cutout near top-left (filled with background color), thin curved wire line from hole upward. Accepts `children` for card content overlay. Uses encarte palette tokens for colors
- [ ] T009 [P] [US1] Create `mobile/components/encarte/barcode-divider.tsx` — section divider styled as a barcode pattern. Alternating thin/thick vertical lines in a horizontal strip. Height ~20px. Uses encarte palette dark/primary colors
- [ ] T010 [P] [US1] Create `mobile/components/encarte/stamp-badge.tsx` — oval badge with double border (inner + outer stroke), rotated slightly (-3° to -5°) for a stamped effect. Props: `label: string` (e.g., "-23%", "OFERTA", "MELHOR PREÇO"), `variant: 'discount' | 'highlight'`. Discount uses red, highlight uses green
- [ ] T011 [P] [US1] Create `mobile/components/encarte/receipt-separator.tsx` — dotted horizontal line separator mimicking receipt paper. Dashed border style with small gap pattern. Uses encarte border token color

### Fintech Components (Palette B)

- [ ] T012 [P] [US1] Create `mobile/components/fintech/clean-card.tsx` — standard rounded card (`rounded-2xl`) with subtle border (`border border-fintech-line`) and optional shadow. Accepts `children`. Uses fintech surface/border tokens
- [ ] T013 [P] [US1] Create `mobile/components/fintech/rule-divider.tsx` — simple 1px horizontal rule line. Uses fintech line color (#DDE2EA). Props: `spacing?: number` for vertical margin
- [ ] T014 [P] [US1] Create `mobile/components/fintech/pill-badge.tsx` — pill-shaped badge (`rounded-full px-3 py-1`). Props: `label: string`, `variant: 'discount' | 'highlight'`. Discount: red bg/text. Highlight: green bg/text. Clean flat style, no border effects

### Themed Wrappers

- [ ] T015 [US1] Create `mobile/components/themed/deal-card.tsx` — wrapper that delegates to `PriceTagCard` (encarte) or `CleanCard` (fintech) based on `useTheme().palette`. Props: `deal: EnrichedPromotion`, `onPress: () => void`, `compact?: boolean`. Renders product name, store info, promo price, original price (strikethrough), and discount badge (stamp or pill per palette)
- [ ] T016 [P] [US1] Create `mobile/components/themed/section-divider.tsx` — delegates to `BarcodeDivider` (encarte) or `RuleDivider` (fintech)
- [ ] T017 [P] [US1] Create `mobile/components/themed/discount-badge.tsx` — delegates to `StampBadge` (encarte) or `PillBadge` (fintech). Props: `label: string`, `variant: 'discount' | 'highlight'`
- [ ] T018 [P] [US1] Create `mobile/components/themed/list-item.tsx` — shopping list item row. Encarte: receipt-style with dotted separator, checkmark icon, product name + store, price right-aligned. Fintech: clean card row with standard separator. Props: `item: ShoppingListItem`, `onToggle`, `onRemove`, `isLocked: boolean`
- [ ] T019 [P] [US1] Create `mobile/components/themed/coupon-line.tsx` — encarte: scissors emoji + dashed line (✂ - - - -). Fintech: standard spacing divider (just vertical margin). Used between paywall/alert sections

### Shared Components

- [ ] T020 [P] [US1] Create `mobile/components/inline-error.tsx` — inline retry banner: shows "Não foi possível carregar. Tentar novamente?" with a retry button. Scoped to a section, not full-screen. Props: `onRetry: () => void`, `message?: string`. Uses theme-aware text/bg colors
- [ ] T021 [P] [US1] Create `mobile/components/skeleton/home-skeleton.tsx` — skeleton loading placeholder for home screen (economy card shape, deal card row, ranking list). Uses palette-aware colors (encarte paper vs fintech box background)
- [ ] T022 [P] [US1] Create `mobile/components/skeleton/search-skeleton.tsx` — skeleton for search results (search bar, 4 store result rows). Uses palette-aware colors
- [ ] T023 [P] [US1] Create `mobile/components/skeleton/list-skeleton.tsx` — skeleton for shopping list (savings card, 5 item rows with dotted/solid separators per palette)

### Tab Bar & Layout

- [ ] T024 [US1] Create `mobile/components/floating-tab-bar.tsx` — custom tab bar component for Expo Router's `tabBar` prop. Absolutely positioned at bottom, rounded corners (`rounded-t-2xl`), shadow (elevation 8 Android, shadow iOS), background from theme tokens. 5 tabs: Início (Home icon), Busca (Search icon), Mapa (MapPin icon), Lista (List icon), Conta (User icon) — all from lucide-react-native. Uses `useSafeAreaInsets()` for bottom padding. Exports `TAB_BAR_HEIGHT` constant for content padding
- [ ] T025 [US1] Rewrite `mobile/app/(tabs)/_layout.tsx` — wrap root with `ThemeProvider`. Use `<Tabs tabBar={(props) => <FloatingTabBar {...props} />}>`. Define 5 tab screens: `index` (Início), `search` (Busca), `map` (Mapa), `list` (Lista), `account` (Conta). Delete old tab files: `mobile/app/(tabs)/favorites.tsx`, `mobile/app/(tabs)/alerts.tsx`, `mobile/app/(tabs)/profile.tsx`. Create minimal stub files for new tabs (`search.tsx`, `list.tsx`, `account.tsx`) with placeholder content so the app compiles

**Checkpoint**: All visual primitives render in both palettes. Floating tab bar works. App navigates between 5 stub tabs. Component gallery (dev screen) shows every themed component.

---

## Phase 4: User Story 2 — Home Dashboard with Economy Summary (Priority: P2)

**Goal**: Home screen shows economy summary card, horizontal deal cards carousel, search bar with category chips, and weekly store ranking. Users see their potential savings immediately on launch.

**Independent Test**: Load home screen with seed data (promotions, stores, products). Verify economy card shows savings amount and cheapest store, deal cards scroll horizontally with discount stamps/pills, category chips filter deals, ranking shows top 3 stores. Toggle palette and verify all elements update.

- [ ] T026 [US2] Create `mobile/hooks/use-economy-summary.ts` — hybrid savings calculation per `contracts/hooks.md`. If user has shopping list items: savings = Σ(reference_price − cheapest_promo_price) per item; cheapest store = store with lowest total. If list empty: savings = total nearby deals discount; cheapest store = store with highest total discount. Params: `{ userLatitude, userLongitude, radiusKm? }`. Returns `{ summary: EconomySummary, isLoading }`. Uses existing `useShoppingList()` and Supabase queries on `promotions`, `reference_prices` tables
- [ ] T027 [P] [US2] Create `mobile/hooks/use-store-ranking.ts` — queries stores within radius, computes total basket price per store using reference basket (arroz, feijão, óleo, açúcar, leite, café, farinha, sal). Returns top 3 sorted by ascending total. Caches for 1 hour. Returns `{ ranking: StoreRanking | null, isLoading }`
- [ ] T028 [P] [US2] Create `mobile/components/economy-card.tsx` — dark background card (palette dark token). Large savings amount (e.g., "R$ 42,30") in white/chalk text. Cheapest store name + savings percentage below. "Comparar lista" button. Uses themed section divider at bottom
- [ ] T029 [P] [US2] Create `mobile/components/store-ranking.tsx` — "Ranking da semana" section header + "mais baratos · [city]" subheader. Vertical list of 3 `StoreRankEntry` rows: position number (1º, 2º, 3º), store name, "total lista base" label, total price, savings percentage in themed discount badge
- [ ] T030 [US2] Rewrite `mobile/app/(tabs)/index.tsx` — Home dashboard layout: (1) economy card at top, (2) search bar input, (3) category filter chips as horizontal ScrollView (Todos, Carnes, Hortifruti, Laticínios, etc. — driven by `useCategories()`), (4) "Ofertas perto de você" header + "Ver todas" link + horizontal FlatList of themed deal cards, (5) themed section divider, (6) store ranking component. Uses `usePromotions()` for deals, `useEconomySummary()` for card, `useStoreRanking()` for ranking. Shows `HomeSkeleton` while loading. Shows `InlineError` on failures. Add `contentContainerStyle={{ paddingBottom: TAB_BAR_HEIGHT }}` for floating tab bar clearance

**Checkpoint**: Home screen renders with real data in both palettes. Economy card shows savings, deals scroll, ranking displays top 3 stores.

---

## Phase 5: User Story 3 — Product Search & Store Comparison (Priority: P3)

**Goal**: Users search for a product by name and see which stores sell it, sorted by price/distance/discount. Free users see top 3 results; additional stores are locked behind Plus upsell.

**Independent Test**: Search for a product (e.g., "Arroz 5kg"). Verify results show stores with prices, sorting works across all 3 tabs, cheapest store has "Melhor preço" badge, 4th+ results are blurred for free users.

- [ ] T031 [US3] Modify `mobile/hooks/use-promotions.ts` — add `productQuery?: string` param that groups results by store (one promotion per store for the queried product). Add `'discount'` to `SortMode` type (sorts by `discountPercent` descending). Add `isLocked: boolean` enrichment to `EnrichedPromotion`: for free-plan users, set `isLocked: true` on promotions beyond rank 3 (sorted by active sort mode). Check user plan via `useAuthStore` profile's `b2c_plan`
- [ ] T032 [P] [US3] Create `mobile/components/search-results.tsx` — FlatList of store results for a searched product. Each row: store name, distance (X.X km), open status ("Aberto agora" / "Fechado"), promo price (green), original price (strikethrough), discount badge (themed stamp/pill). Cheapest store gets a "Melhor preço" themed badge. Locked results (4th+): semi-transparent overlay (`bg-white/80`) with lock icon and "Assine Plus para ver" text, onPress opens paywall. Props: `promotions: EnrichedPromotion[]`, `onPressItem`, `onPressLocked`
- [ ] T033 [US3] Create `mobile/app/(tabs)/search.tsx` — search input at top with clear button (X icon). Three sort tabs below: "Menor preço", "Distância", "Desconto" (styled as horizontal pills, active uses primary color). SearchResults component below. Empty state: "Nenhum resultado encontrado" with suggestion text. Initial state (no query): show category browse or recent searches. Uses `usePromotions({ productQuery, sortMode })` for results. Shows `SearchSkeleton` while loading, `InlineError` on failure. `paddingBottom: TAB_BAR_HEIGHT`

**Checkpoint**: Search screen works end-to-end. Sorting, badges, and Plus gating all function in both palettes.

---

## Phase 6: User Story 4 — Shopping List as Receipt (Priority: P4)

**Goal**: Users manage a shopping list styled as a receipt (Encarte) or clean card list (Fintech). They see total estimated savings, check items off, and navigate to stores.

**Independent Test**: Add items to list, verify receipt/clean layout renders per palette, savings card shows correct totals, items toggle on check, excess items locked for free users, skeleton loads, Ver rota opens native maps.

- [ ] T034 [US4] Create `mobile/app/(tabs)/list.tsx` — list screen layout: (1) "Minha Lista" header + themed "+ Item" button (opens search/add flow), (2) economy savings card (dark bg, total savings, item count, store count, "Ver rota" button that opens Google Maps/Apple Maps via `Linking.openURL`), (3) FlatList of themed list items with check-off toggle, product name + weight, store attribution, price — separated by receipt-separator (encarte) or standard separator (fintech). Free-plan: items beyond limit show locked with "Assine Plus · listas ilimitadas" upsell and coupon-line divider above. Uses `useShoppingList()` for data + mutations. Shows `ListSkeleton` while loading, `InlineError` on failure. `paddingBottom: TAB_BAR_HEIGHT`

**Checkpoint**: List screen manages items in both palettes. Receipt layout for encarte, clean layout for fintech. Savings calculation, item toggle, plan limits all work.

---

## Phase 7: User Story 5 — Product Detail with Price Intelligence (Priority: P5)

**Goal**: Users view a product's details, price history chart, set price alerts, compare prices across stores, and add to their shopping list.

**Independent Test**: Navigate to a product with 8+ weeks of history. Verify image carousel, metadata, SVG line chart with markers, alert toggle saves, store comparison sorts by price, "Adicionar à lista" adds to list.

- [ ] T035 [US5] Rewrite `mobile/components/price-chart.tsx` — replace View-based bars with SVG line chart using `react-native-svg`. Render `<Polyline>` for price line, `<Circle>` for data point markers (larger circles for min and current price, labeled with price values), `<Text>` for week labels (S1–S8) on x-axis. Use `onLayout` for responsive width. Period selector pills (30d/60d/90d) above chart. "Bom momento para comprar" banner when `trend.bestTimeToBuy`. Theme-aware colors: line uses primary, markers use discountRed (min) and dark (current). Empty state: "Dados insuficientes" message when `dataPoints.length < 2`
- [ ] T036 [US5] Create `mobile/app/product/[id].tsx` — stack route with back navigation ("< Voltar" header + "Alertas" link). Layout: (1) product image placeholder with "Imagem ilustrativa" label, (2) product name, category, type, weight metadata row, (3) themed section divider, (4) PriceChart component, (5) themed section divider, (6) price alert card: "Alerta de queda de preço" + threshold input + "Ativar" toggle (uses `useAlerts().create()`), (7) themed section divider, (8) "Comparar mercados" header + store comparison list (each row: store name, "Aberto"/"Fechado" status, promo price, discount badge), (9) fixed bottom CTA: "+ Adicionar à lista" button (uses `useShoppingList().addItem()`). Fetches product via `supabase.from('products').select().eq('id', id)`, promotions via `usePromotions({ productQuery: productName })`, price history via `usePriceHistory(id)`. Shows `InlineError` on failures

**Checkpoint**: Product detail screen renders with chart, alert, comparison, and add-to-list action in both palettes.

---

## Phase 8: User Story 6 — Map with List-Aware Store Routing (Priority: P6)

**Goal**: Map shows store markers with list-relevant prices. A bottom panel groups the user's list items by store with subtotals and route buttons.

**Independent Test**: Create a list with items available at 3+ stores. Verify map markers show prices, cheapest marker highlighted, bottom panel groups correctly with subtotals, route button opens turn-by-turn navigation.

- [ ] T037 [US6] Modify `mobile/app/(tabs)/map.tsx` — enhance the existing map screen: (1) add "Ver minha lista" floating button (top-right, pill-shaped) that scrolls bottom panel into view, (2) modify store markers to show list-relevant pricing when user has shopping list items (subtotal for that store's available items, or generic deal count if no list). Highlight cheapest store marker with "mais barato" label and distinct color (primary green). (3) Add BottomSheet panel "Itens da lista por mercado": FlatList of store groups, each row shows store name, item count, subtotal price, and "rota" button. Rota opens `Linking.openURL('https://www.google.com/maps/dir/?api=1&destination=LAT,LNG')`. (4) If user has no list: markers show store names with general active deal counts. Uses `useShoppingList()`, `useStores()`, `useLocation()`. `paddingBottom: TAB_BAR_HEIGHT` for content under floating tab bar. Theme-aware marker colors and bottom panel styling

**Checkpoint**: Map shows list-aware markers, bottom panel groups items by store, routing works. Both palettes render correctly.

---

## Phase 9: User Story 7 — Onboarding Flow (Priority: P7)

**Goal**: First-time users see a themed onboarding screen that explains POUP's value and directs them to sign up or sign in.

**Independent Test**: Clear `hasSeenOnboarding` from SecureStore. Launch app. Verify dark-themed onboarding shows hero area, 3 value props, Começar leads to auth (sign up), "já tenho conta" leads to auth (sign in). After completion, onboarding is skipped on relaunch.

- [ ] T038 [US7] Rewrite `mobile/app/onboarding.tsx` — themed dark background: chalkboard (#1E2820) for Encarte, night (#0C1829) for Fintech. Layout: (1) pagination dots at top indicating carousel position, (2) hero illustration area — price tag icons on a stylized map with different prices (can use SVG illustration or placeholder image), (3) app name "POUP" in large chalk-white/white text, (4) tagline: "Descubra o mercado mais barato perto de você", (5) 3 value proposition rows with icons: "Escolha seus mercados" (Store icon), "Permita a localização" (MapPin icon), "Comece a economizar" (TrendingDown icon), (6) "Começar" CTA button (primary color, full width), (7) "já tenho conta" text link below. Começar → navigate to auth flow (sign up mode). "já tenho conta" → navigate to auth flow (sign in mode). After auth success, set `hasSeenOnboarding: true` in auth store. Remove hardcoded "Matao, SP" location — use dynamic city from `useLocation()` or omit if unavailable

**Checkpoint**: Onboarding displays correctly in both palettes. Navigation to auth works. Returning users skip onboarding.

---

## Phase 10: User Story 8 — Account, Preferences & Paywall (Priority: P8)

**Goal**: Users manage their profile, configure preferences, and upgrade to Plus via a paywall modal with feature comparison.

**Independent Test**: Navigate to Conta tab. Verify profile info, plan badge, preferences sections render. Tap upgrade → paywall modal opens with comparison table and pricing. Toggle palette and verify both render correctly.

- [ ] T039 [US8] Create `mobile/app/(tabs)/account.tsx` — account screen layout using themed components. Sections: (1) user header: avatar circle with initial letter, name, email, plan badge ("FREE" green outline or "PLUS" gold fill), (2) "Upgrade para Plus" CTA card (coupon-line separator above, gold background, benefit highlights, "7 dias grátis →" teaser, onPress opens paywall), (3) "PREFERÊNCIAS" section header + rows: "Alertas de oferta" → configure (chevron), "Localização" → city display, "Meus mercados" → selected count, (4) "CONTA" section header + rows: "Alterar senha", "Histórico de buscas", "Excluir conta" (red text, confirmation Alert dialog before `supabase.rpc('delete_user_account')`), (5) "ASSINATURA" section header + rows: "Plano atual" → plan name, "Termos de uso" → external link. For Plus users: replace upgrade CTA with plan management info. Uses `useAuthStore()` for profile data, `useFavorites()` for market count, `useAlerts()` for alert count. `paddingBottom: TAB_BAR_HEIGHT`
- [ ] T040 [US8] Rewrite `mobile/components/paywall.tsx` — modal with dark background (palette dark token). Layout: (1) close X button top-right, (2) large savings number (e.g., "R$ 120") in white bold text — derived from user's actual economy summary or static value, (3) "+ POUP PLUS" branding text, (4) "Economize mais. Sem limites." tagline, (5) feature comparison table — two columns (Free / Plus) with rows: Comparar mercados (limitado / Todos), Lista de compras (limitada / Ilimitada), Histórico de preços (— / 90 dias), Alertas de preço (— / check), Análise de economia (— / check). Check marks in green, dashes in gray. (6) Pricing row: two cards side by side — "Mensal R$ 9,90" and "Anual R$ 6,90" with "-30%" discount badge (themed stamp/pill). Annual card has primary border highlight. (7) "Experimentar 7 dias grátis" CTA button (primary color, full width). Uses `useSubscription()` for RevenueCat purchase flow. Dismiss modal on successful subscription

**Checkpoint**: Account screen renders all sections. Paywall modal opens with comparison table and pricing. Subscription flow triggers RevenueCat. Both palettes render correctly.

---

## Phase 11: Polish & Enhancement (Should-Have)

**Purpose**: Animations, haptics, transitions, and cross-platform verification. These are enhancement priority — implement after all core screens are complete.

- [ ] T041 [P] Add physics-based spring animations to tab transitions in `mobile/components/floating-tab-bar.tsx` — use `react-native-reanimated` `withSpring()` for icon scale and indicator position changes
- [ ] T042 [P] Add haptic feedback to interactive elements across all screens — use `expo-haptics` (`Haptics.impactAsync(ImpactFeedbackStyle.Light)`) on: add to list, toggle alert, check item, toggle palette, tap CTA buttons. Import `expo-haptics` (already in Expo SDK, no install needed)
- [ ] T043 Add shared element transition from themed deal card to product detail screen — use `react-native-reanimated` shared transition API or Expo Router's `sharedTransitionTag` prop on the card image/container
- [ ] T044 Add optimistic UI to data mutations — update UI immediately before server confirms in: `useShoppingList` (addItem, toggleItem, removeItem), `useAlerts` (create, disable), `useFavorites` (add, remove). Rollback on error with toast notification
- [ ] T045 Add list item check-off animation in `mobile/components/themed/list-item.tsx` — use Moti for checkmark scale-in + text strikethrough slide. Satisfying completion motion when toggling checked state
- [ ] T046 Cross-platform visual audit — run all 8 screens (Onboarding, Home, Search, Map, List, Detail, Account, Paywall) in both palettes on iOS Simulator and Android Emulator. Verify: no layout breaks, no color mismatches, shadows render correctly on both platforms, floating tab bar works with safe area on both, SVG chart renders identically, all metaphor components (price tag, barcode, stamps) render correctly on both platforms

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup (T001–T003) — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Foundational (T004–T007) — foundational for visual components
- **US2–US8 (Phases 4–10)**: All depend on US1 (Phase 3) for themed components and tab layout
- **Polish (Phase 11)**: Depends on all core screens being complete (Phases 3–10)

### User Story Dependencies

- **US1 (P1)**: Depends on Foundational only. BLOCKS all other stories (provides themed components + tab layout)
- **US2 (P2)**: Depends on US1. Can start after US1 checkpoint
- **US3 (P3)**: Depends on US1. Can start in parallel with US2
- **US4 (P4)**: Depends on US1. Can start in parallel with US2/US3
- **US5 (P5)**: Depends on US1. Can start in parallel with US2/US3/US4
- **US6 (P6)**: Depends on US1. Soft dependency on US4 (list-aware features use shopping list data, but map works without a list)
- **US7 (P7)**: Depends on US1. Can start in parallel with any other story
- **US8 (P8)**: Depends on US1. Can start in parallel with any other story

### Within Each User Story

- Hooks before components (hooks provide data)
- Components before screen files (screens compose components)
- Screen complete before moving to next priority (sequential execution)

### Parallel Opportunities

**Phase 1**: All 3 tasks (T001–T003) run in parallel
**Phase 2**: T005 and T006 run in parallel (both depend on T004)
**Phase 3**: T008–T014 (all encarte + fintech components) run in parallel. T016–T023 (themed wrappers + shared components) run in parallel after encarte/fintech are done
**Phase 4**: T027–T029 run in parallel (hooks and components for different files)
**Phase 5**: T032 runs in parallel with T031 (different files, but T033 depends on both)
**Phases 4–10**: US2–US8 can run in parallel after US1 completes (if team capacity allows)

---

## Parallel Example: User Story 1

```bash
# Launch all Encarte + Fintech primitive components together (7 files, no dependencies):
Task: "Create mobile/components/encarte/price-tag-card.tsx"
Task: "Create mobile/components/encarte/barcode-divider.tsx"
Task: "Create mobile/components/encarte/stamp-badge.tsx"
Task: "Create mobile/components/encarte/receipt-separator.tsx"
Task: "Create mobile/components/fintech/clean-card.tsx"
Task: "Create mobile/components/fintech/rule-divider.tsx"
Task: "Create mobile/components/fintech/pill-badge.tsx"

# Then launch all themed wrappers + shared components together (9 files):
Task: "Create mobile/components/themed/section-divider.tsx"
Task: "Create mobile/components/themed/discount-badge.tsx"
Task: "Create mobile/components/themed/list-item.tsx"
Task: "Create mobile/components/themed/coupon-line.tsx"
Task: "Create mobile/components/inline-error.tsx"
Task: "Create mobile/components/skeleton/home-skeleton.tsx"
Task: "Create mobile/components/skeleton/search-skeleton.tsx"
Task: "Create mobile/components/skeleton/list-skeleton.tsx"
```

## Parallel Example: User Stories 2–4

```bash
# After US1 completes, launch hooks for US2 and US3 in parallel:
Task: "Create mobile/hooks/use-economy-summary.ts"       # US2
Task: "Create mobile/hooks/use-store-ranking.ts"          # US2
Task: "Modify mobile/hooks/use-promotions.ts"             # US3

# Launch US2 and US3 components in parallel:
Task: "Create mobile/components/economy-card.tsx"         # US2
Task: "Create mobile/components/store-ranking.tsx"        # US2
Task: "Create mobile/components/search-results.tsx"       # US3
```

---

## Implementation Strategy

### MVP First (US1 Only)

1. Complete Phase 1: Setup (3 tasks)
2. Complete Phase 2: Foundational (4 tasks)
3. Complete Phase 3: US1 — Design System (18 tasks)
4. **STOP and VALIDATE**: Toggle palette, verify all components render correctly
5. Demo-ready: themed component gallery + floating tab bar + new tab structure

### Incremental Delivery

1. Setup + Foundational + US1 → Component gallery + tab structure (MVP!)
2. Add US2 → Home dashboard with economy card → Demo
3. Add US3 → Search + comparison → Demo
4. Add US4 → Shopping list → Demo
5. Add US5 → Product detail + chart → Demo
6. Add US6 → Map with routing → Demo
7. Add US7 → Onboarding → Demo
8. Add US8 → Account + paywall → Demo
9. Polish → Animations, haptics, transitions → Final release

---

## Notes

- [P] tasks = different files, no dependencies between them
- [Story] label maps each task to its user story for traceability
- All UI text in Portuguese (pt-BR)
- All colors from Tailwind config tokens — no inline hex values
- All icons from lucide-react-native — no additional icon libraries
- All ScrollViews/FlatLists in tab screens need `paddingBottom: TAB_BAR_HEIGHT` for floating tab bar clearance
- Existing hooks (useShoppingList, useFavorites, useAlerts, usePriceHistory, useLocation, useSubscription) are reused without modification unless explicitly noted
- The old tab files (favorites.tsx, alerts.tsx, profile.tsx) are deleted in T025 — their functionality moves to account.tsx and product detail
