# Poup App Redesign Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign all five consumer-facing screens, tab bar, and header to match the approved design spec.

**Architecture:** Incremental screen-by-screen refactoring. Foundation changes (theme tokens, header, tab bar, navigation) ship first since every screen depends on them. Each screen task is independent after that. All styling uses `StyleSheet.create()` with theme tokens from `useTheme()` — following the existing pattern, not introducing new patterns.

**Tech Stack:** Expo SDK 54, React Native 0.81, TypeScript 5.9, NativeWind v4, Expo Router v6, Zustand v5, lucide-react-native, @gorhom/bottom-sheet, Moti, react-native-maps

**Design spec:** `docs/superpowers/specs/2026-03-17-app-redesign-design.md`
**Mockups:** `.superpowers/brainstorm/27216-1773737598/` (13-header, 14-alertas, 15-lista, 16-mapa, 17-busca)

---

## Task 1: Extend Theme Tokens

**Files:**
- Modify: `mobile/theme/palettes.ts`

The design spec adds colors not currently in the palette (success green, header gradient stops, purple for badges, text colors). Add them so all screens can reference them via `useTheme()`.

- [ ] **Step 1: Add new color tokens to `palettes.ts`**

Add these tokens to the light palette object:

```typescript
// Header gradient
headerGradientStart: '#115E59',
headerGradientMid: '#0D9488',
headerGradientEnd: '#14B8A6',

// Semantic
success: '#16A34A',
successLight: '#DCFCE7',

// Badge colors
purple: '#7C3AED',
purpleLight: '#F3E8FF',

// Text (design spec uses different shades than existing)
textDark: '#134E4A',
textMuted: '#9CA3AF',

// Background
bgLight: '#CCFBF1',
```

- [ ] **Step 2: Update `PaletteTokens` type in `use-theme.ts`**

Add the new token keys to the type so TypeScript catches missing references.

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd mobile && npx tsc --noEmit`
Expected: no new errors

- [ ] **Step 4: Commit**

```bash
git add mobile/theme/palettes.ts mobile/theme/use-theme.ts
git commit -m "feat: extend theme tokens with redesign colors"
```

---

## Task 2: Create Gradient Header Component

**Files:**
- Create: `mobile/components/gradient-header.tsx`
- Modify: `mobile/app/(tabs)/index.tsx` (integrate header)

New shared header component: teal gradient background, time-based greeting, tappable avatar that navigates to Account.

- [ ] **Step 1: Create `gradient-header.tsx`**

```typescript
// Props: none (reads user from useAuthStore, navigates with router)
// Renders:
//   LinearGradient (expo-linear-gradient) with 3 stops
//   Left: greeting text ("Boa tarde, Lucas") + subtitle
//   Right: circular avatar with user initial, tappable → router.push('/account')
// Greeting logic: getGreeting() helper
//   hour < 12 → "Bom dia"
//   hour < 18 → "Boa tarde"
//   else → "Boa noite"
// User name: profile?.full_name?.split(' ')[0] ?? 'Usuário'
```

Dependencies: `expo-linear-gradient` (check if installed, install if not), `useAuthStore`, `useRouter` from expo-router.

- [ ] **Step 2: Check if `expo-linear-gradient` is installed**

Run: `cd mobile && grep "expo-linear-gradient" package.json`

If missing: `npx expo install expo-linear-gradient`

- [ ] **Step 3: Integrate header into Home screen (`index.tsx`)**

Replace the existing SafeAreaView top edge with the GradientHeader. The header should be outside the ScrollView so it doesn't scroll away.

- [ ] **Step 4: Verify visually**

Run: `cd mobile && npx expo start`
Expected: Home screen shows gradient header with greeting and avatar. Tapping avatar logs navigation intent (Account screen integration comes in Task 4).

- [ ] **Step 5: Commit**

```bash
git add mobile/components/gradient-header.tsx mobile/app/(tabs)/index.tsx
git commit -m "feat: add gradient header with greeting and avatar"
```

---

## Task 3: Restructure Tab Bar (Account → Alertas)

**Files:**
- Modify: `mobile/app/(tabs)/_layout.tsx`
- Modify: `mobile/components/floating-tab-bar.tsx`

Remove Account from the tab bar, add Alertas with Bell icon and red dot badge. Account becomes a hidden screen accessible only via header avatar.

- [ ] **Step 1: Update tab layout (`_layout.tsx`)**

Change the visible tabs:
- `index` (Início) — keep
- `search` (Busca) — keep
- `map` (Mapa) — keep
- `list` (Lista) — keep
- `alerts` (Alertas) — make visible (currently `href: null`)
- `account` — set `href: null` (hide from tab bar)
- `favorites` — keep hidden

- [ ] **Step 2: Update `TAB_CONFIG` in `floating-tab-bar.tsx`**

Replace the `account` entry with `alerts`:

```typescript
alerts: { icon: Bell, label: 'Alertas' },
```

Remove the `account` entry from TAB_CONFIG. Import `Bell` from lucide-react-native.

- [ ] **Step 3: Add red dot badge for unread alerts**

In `floating-tab-bar.tsx`, add a red dot (8px circle, absolute positioned top-right of Bell icon) that shows when `useAlerts().count > 0`. Import and call `useAlerts` hook.

```typescript
// Inside the tab button render for 'alerts':
{route.name === 'alerts' && hasUnreadAlerts && (
  <View style={styles.alertDot} />
)}
// styles.alertDot: { position: 'absolute', top: 2, right: '30%', width: 8, height: 8, borderRadius: 4, backgroundColor: '#EF4444' }
```

- [ ] **Step 4: Verify tabs display correctly**

Run: `cd mobile && npx expo start`
Expected: Tab bar shows Início, Busca, Mapa, Lista, Alertas. No Account tab. Tapping Alertas opens the alerts screen.

- [ ] **Step 5: Commit**

```bash
git add mobile/app/(tabs)/_layout.tsx mobile/components/floating-tab-bar.tsx
git commit -m "feat: replace Account tab with Alertas, add red dot badge"
```

---

## Task 4: Move Account to Stack Screen

**Files:**
- Create: `mobile/app/account.tsx` (new stack screen)
- Modify: `mobile/app/_layout.tsx` (add account to Stack)
- Modify: `mobile/components/gradient-header.tsx` (wire avatar navigation)

Account is no longer a tab. It becomes a stack screen pushed from the header avatar.

- [ ] **Step 1: Create `mobile/app/account.tsx`**

Move the account screen content from `mobile/app/(tabs)/account.tsx` into a new stack screen at `mobile/app/account.tsx`. Keep the (tabs) version as a redirect or remove it.

The stack version should:
- Add a back button / header with "Conta" title
- Or use `Stack.Screen options={{ headerShown: true, title: 'Conta' }}`

- [ ] **Step 2: Register in root layout (`_layout.tsx`)**

Add `<Stack.Screen name="account" options={{ headerShown: true, title: 'Conta', headerBackTitle: 'Voltar' }} />` to the root Stack.

- [ ] **Step 3: Wire avatar navigation in `gradient-header.tsx`**

```typescript
const router = useRouter();
// On avatar press:
onPress={() => router.push('/account')}
```

- [ ] **Step 4: Verify navigation flow**

Run app → tap avatar → Account screen opens with back button → tap back → returns to previous screen.

- [ ] **Step 5: Commit**

```bash
git add mobile/app/account.tsx mobile/app/_layout.tsx mobile/components/gradient-header.tsx
git commit -m "feat: move account to stack screen, wire avatar navigation"
```

---

## Task 5: Redesign Home Screen

**Files:**
- Modify: `mobile/app/(tabs)/index.tsx`
- Modify: `mobile/components/store-ranking.tsx`
- Modify: `mobile/components/themed/deal-card.tsx`
- Create: `mobile/components/store-card.tsx`
- Modify: `mobile/components/skeleton/home-skeleton.tsx`

Rebuild the home screen layout to match the design spec: header → ranking em destaque (top 3 cards) → category pills → ofertas carousel → mercados section.

- [ ] **Step 1: Redesign store ranking as top-3 cards**

Modify `store-ranking.tsx` to render 3 side-by-side cards (flex row) instead of a list. Each card:
- Medal emoji (🥇🥈🥉)
- Store initial avatar (32px, colored background with store-specific color)
- Store name
- Total price
- "Mais barato" badge on 1st place (amber)
- Gold border (2px solid #F59E0B) on 1st place card

- [ ] **Step 2: Update home screen layout (`index.tsx`)**

Restructure the ScrollView content order:
1. `<GradientHeader />` (already added in Task 2)
2. `<StoreRanking />` with section header "🏆 Ranking em Destaque" + "Ver todos →"
3. Category pills (keep existing, restyle if needed)
4. "Ofertas perto de você" section header + horizontal FlatList of DealCard
5. "Mercados perto de você" section header + store cards

- [ ] **Step 3: Create `store-card.tsx` component**

For the "Mercados perto de você" section:
- Store initial avatar (colored, rounded 8px)
- Store name
- Tags: distance, deal count, open/closed status
- No emojis or real logos

- [ ] **Step 4: Update `home-skeleton.tsx`**

Match the new layout: ranking cards row → category pills → deal cards → store cards.

- [ ] **Step 5: Verify home screen visually**

Run app. Compare with mockup `poup-home-v2.html`.

- [ ] **Step 6: Commit**

```bash
git add mobile/app/(tabs)/index.tsx mobile/components/store-ranking.tsx mobile/components/store-card.tsx mobile/components/themed/deal-card.tsx mobile/components/skeleton/home-skeleton.tsx
git commit -m "feat: redesign home screen with ranking cards, store cards"
```

---

## Task 6: Redesign Alertas Screen

**Files:**
- Modify: `mobile/app/(tabs)/alerts.tsx`
- Create: `mobile/components/alert-card.tsx`
- Create: `mobile/components/suggested-product-card.tsx`

Rebuild the alerts screen with empty state (educational + suggestions), novidades/monitorando sections, and upsell card.

- [ ] **Step 1: Build empty state UI**

In `alerts.tsx`, when `alerts.length === 0`:
- Bell icon in teal circle (80px)
- "Receba quando o preço cair" title
- Explanation subtitle
- "Criar primeiro alerta" CTA button
- "Sugestões perto de você" section with `SuggestedProductCard` components

- [ ] **Step 2: Create `suggested-product-card.tsx`**

Card with:
- Emoji icon (40px, colored background)
- Product name + contextual subtitle
- "Criar alerta" outlined teal button

- [ ] **Step 3: Build populated state — Novidades section**

When alerts have triggered items:
- Red dot + "Novidades" header + count badge (red background)
- `AlertCard` with green left border (4px), product info, store + price in green, badge + timestamp + distance

- [ ] **Step 4: Build populated state — Monitorando section**

Active alerts waiting:
- "Monitorando" header + count badge (gray)
- `AlertCard` without colored border, last known price, gray dot indicator

- [ ] **Step 5: Create `alert-card.tsx` component**

Shared card component that handles both triggered and monitoring states via props:
- `variant: 'triggered' | 'monitoring'`
- Product emoji, name, price info, badge, metadata

- [ ] **Step 6: Add upsell card for free tier**

When user is on free tier and near limit:
- Dashed teal border, gradient background
- "Você está usando X de Y alertas"
- "Ver planos" button → opens Paywall

- [ ] **Step 7: Verify alertas screen**

Compare with mockup `14-alertas-screen.html`. Test empty and populated states.

- [ ] **Step 8: Commit**

```bash
git add mobile/app/(tabs)/alerts.tsx mobile/components/alert-card.tsx mobile/components/suggested-product-card.tsx
git commit -m "feat: redesign alertas screen with novidades/monitorando sections"
```

---

## Task 7: Redesign Lista Screen

**Files:**
- Modify: `mobile/app/(tabs)/list.tsx`
- Create: `mobile/components/list-template-card.tsx`
- Create: `mobile/components/optimization-summary.tsx`
- Modify: `mobile/components/themed/list-item.tsx`

Rebuild the shopping list with template cards (empty state), store optimization comparison (single vs split), and redesigned item list.

- [ ] **Step 1: Build empty state with template cards**

When list is empty:
- Edit icon in teal circle
- "Monte sua lista de compras" title + subtitle
- "Adicionar itens" CTA
- Horizontal scroll of `ListTemplateCard` components: "Cesta Básica" (🛒, 15 itens), "Churrasco" (🥩, 12 itens), "Café da Manhã" (☕, 8 itens)

- [ ] **Step 2: Create `list-template-card.tsx`**

Card with:
- Emoji icon (28px)
- Template name (13px bold)
- Item count (11px gray)
- Outlined border, tappable
- `onPress` → creates list from template (requires `useShoppingList().createList` or new template logic)

- [ ] **Step 3: Create `optimization-summary.tsx`**

Shows two comparison cards using data from `useShoppingList().optimizeList`:
- **Single store card**: store avatar + "Tudo no [Store]" + distance + availability + total price
- **Split store card**: overlapping avatars + "Dividir em X lojas" + store names + total price (green) + savings. Green border + "Melhor opção" badge

Props: `optimization: OptimizationResult`, `stores: StoreWithPromotions[]`

- [ ] **Step 4: Redesign list item styling**

Update `list-item.tsx` to match spec:
- Checkbox: 22px, rounded 6px, gray border (unchecked) / teal filled with white check (checked)
- Product name + "R$ X,XX · [Store]" with color-coded store name
- Price right-aligned
- Checked items: strikethrough, opacity 0.5

- [ ] **Step 5: Wire populated state in `list.tsx`**

Layout order:
1. Header: "Minha Lista" + item count + "+" button
2. `<OptimizationSummary />` (when optimization result available)
3. Item list (unchecked first, then checked faded)

- [ ] **Step 6: Verify lista screen**

Compare with mockup `15-lista-screen.html`. Test empty state with templates, populated state with optimization.

- [ ] **Step 7: Commit**

```bash
git add mobile/app/(tabs)/list.tsx mobile/components/list-template-card.tsx mobile/components/optimization-summary.tsx mobile/components/themed/list-item.tsx
git commit -m "feat: redesign lista with templates and store optimization comparison"
```

---

## Task 8: Redesign Mapa Screen

**Files:**
- Modify: `mobile/app/(tabs)/map.tsx`
- Create: `mobile/components/map-legend.tsx`
- Create: `mobile/components/map-store-pin.tsx`
- Create: `mobile/components/map-store-sheet.tsx`

Add color-coded ranking pins, legend, "Minha lista" filter, and redesigned bottom sheet.

- [ ] **Step 1: Create `map-store-pin.tsx`**

Custom marker component:
- Props: `store`, `rank`, `rankColor` ('green' | 'yellow' | 'red'), `isSelected`
- Renders: colored pill with store initials + optional medal emoji for top 3
- Selected state: expanded with full store name, white border, stronger shadow

Color logic:
- Rank 1-2: green (#16A34A)
- Rank 3: yellow (#F59E0B) — or use percentile-based logic
- Bottom half: red (#EF4444)

- [ ] **Step 2: Create `map-legend.tsx`**

Floating card (top-left, absolute positioned):
- "Ranking de preço" label
- Three rows: green dot + "Barato", yellow dot + "Médio", red dot + "Caro"
- White background, rounded, shadow

- [ ] **Step 3: Add "Minha lista" filter pill**

Floating pill (top-right):
- Filter icon + "Minha lista" text
- Tappable toggle: when active, pin colors reflect user's list prices
- Uses `useShoppingList()` to check if list exists

- [ ] **Step 4: Create `map-store-sheet.tsx`**

Bottom sheet content when store is tapped:
- Drag handle
- Store header: large avatar (44px) + name + distance + ranking badge + "Ir ao mapa" button
- Lista total strip (if user has list): item count, availability, total at this store
- "Destaques nesta loja": horizontal scroll of deal cards

- [ ] **Step 5: Integrate into `map.tsx`**

Replace existing store markers with `MapStorePin`. Replace existing bottom sheet content with `MapStoreSheet`. Add legend and filter pill.

- [ ] **Step 6: Verify mapa screen**

Compare with mockup `16-mapa-screen.html`. Test pin colors, tapping a store, bottom sheet content.

- [ ] **Step 7: Commit**

```bash
git add mobile/app/(tabs)/map.tsx mobile/components/map-legend.tsx mobile/components/map-store-pin.tsx mobile/components/map-store-sheet.tsx
git commit -m "feat: redesign mapa with color-coded pins, legend, store sheet"
```

---

## Task 9: Redesign Busca Screen

**Files:**
- Modify: `mobile/app/(tabs)/search.tsx`
- Create: `mobile/components/search-discovery.tsx`
- Create: `mobile/components/search-result-card.tsx`
- Create: `mobile/hooks/use-recent-searches.ts`
- Create: `mobile/hooks/use-trending-products.ts`

Rebuild search as discovery-first with categories grid, trending products, recent searches, and price-range result cards.

- [ ] **Step 1: Create `use-recent-searches.ts` hook**

Stores recent search queries in AsyncStorage:
- `recentSearches: string[]` (max 10)
- `addSearch(query)`, `clearSearches()`
- Load from AsyncStorage on mount

- [ ] **Step 2: Create `use-trending-products.ts` hook**

Fetches trending products near user:
- Uses existing promotions data or a new RPC
- Returns top 3-5 products with most price activity / most searched
- Each item: product name, price range (min-max), store count, discount badge

- [ ] **Step 3: Create `search-discovery.tsx`**

The default view when search bar is not focused:
- "Buscas recentes" pills with clock icon + "Limpar" button
- "Categorias" 4×2 grid with emoji icons
- "Em alta perto de você" numbered list with price ranges

- [ ] **Step 4: Create `search-result-card.tsx`**

Individual result card:
- Left: product emoji icon (48px, colored bg)
- Center: product name → price range (green bold min, gray max) → store count + badge
- Right: "+" button (32px teal outlined square) → adds to shopping list

- [ ] **Step 5: Rebuild `search.tsx` screen**

Two states:
- `query.length === 0`: show `<SearchDiscovery />`
- `query.length > 0`: show result count + list of `<SearchResultCard />`

Search bar: unfocused (gray border) → focused (teal border), placeholder "Buscar produto ou marca...", clear X button.

- [ ] **Step 6: Wire "+" button to shopping list**

Import `useShoppingList()`. On + press, call `addItem` with the product. Show toast confirmation via `burnt`.

- [ ] **Step 7: Verify busca screen**

Compare with mockup `17-busca-screen.html`. Test discovery view, typing a query, result cards, + button.

- [ ] **Step 8: Commit**

```bash
git add mobile/app/(tabs)/search.tsx mobile/components/search-discovery.tsx mobile/components/search-result-card.tsx mobile/hooks/use-recent-searches.ts mobile/hooks/use-trending-products.ts
git commit -m "feat: redesign busca with discovery view and price-range results"
```

---

## Task 10: Final Integration & Cleanup

**Files:**
- Modify: `mobile/app/(tabs)/account.tsx` (cleanup or redirect)
- Modify: various (remove dead code)

Cleanup pass after all screens are done.

- [ ] **Step 1: Clean up `(tabs)/account.tsx`**

Either:
- Remove it entirely (if stack version in `app/account.tsx` is complete)
- Or keep as a minimal redirect: `useEffect(() => router.replace('/account'), [])`

Ensure the hidden tab screen doesn't break navigation.

- [ ] **Step 2: Remove unused imports and dead code**

Search for any components or hooks that were replaced and are no longer referenced.

- [ ] **Step 3: Verify full app flow**

Test complete user flow:
1. App opens → Home with gradient header, ranking, deals
2. Tap avatar → Account screen → back button returns
3. Tap Busca → discovery view → type query → results with + button
4. Tap Mapa → color-coded pins → tap store → bottom sheet
5. Tap Lista → templates (empty) or optimization (populated)
6. Tap Alertas → empty state or novidades/monitorando
7. Red dot appears on Alertas tab when alerts exist

- [ ] **Step 4: TypeScript check**

Run: `cd mobile && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: cleanup dead code and verify full redesign integration"
```

---

## Dependency Graph

```
Task 1 (Theme) ──┐
                  ├──→ Task 2 (Header) ──→ Task 4 (Account Stack) ──┐
Task 3 (Tab Bar) ─┘                                                  │
                                                                      ├──→ Task 10 (Cleanup)
Task 5 (Home) ────────────────────────────────────────────────────────┤
Task 6 (Alertas) ─────────────────────────────────────────────────────┤
Task 7 (Lista) ───────────────────────────────────────────────────────┤
Task 8 (Mapa) ────────────────────────────────────────────────────────┤
Task 9 (Busca) ───────────────────────────────────────────────────────┘
```

**Parallelizable:** Tasks 5–9 (all screen redesigns) can run in parallel after Tasks 1–4 are complete.
**Critical path:** Task 1 → Task 2 → Task 4 → Task 10
