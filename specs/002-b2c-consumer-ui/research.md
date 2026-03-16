# Research: POUP B2C Consumer UI

**Branch**: `002-b2c-consumer-ui` | **Date**: 2026-03-02

## R1: NativeWind v4 Theming Approach (Runtime Palette Switching)

**Decision**: Zustand store + React Context with conditional Tailwind class names.

**Rationale**: NativeWind v4 compiles Tailwind CSS to React Native StyleSheet objects at build time via the Metro bundler. Unlike web Tailwind, CSS custom properties (`var(--color)`) are NOT supported at runtime in React Native. The `darkMode: 'class'` strategy also does not work in NativeWind v4 for arbitrary theme switching beyond dark/light mode.

Therefore, the only viable runtime theming approach is:
1. Define all palette colors in `tailwind.config.ts` under namespaced keys (`encarte-*`, `fintech-*`)
2. Use a Zustand store (persisted to AsyncStorage) to track the active palette
3. Provide a `useThemeClasses()` hook that maps semantic keys to the correct Tailwind class strings for the active palette
4. Components reference `t.bg`, `t.card`, `t.textPrimary` etc. instead of hardcoded class names

**Alternatives considered**:
- **Tailwind CSS v4 with `@theme`**: Not compatible with NativeWind v4 (requires Tailwind CSS 3.4.x)
- **React Native `Appearance` API**: Only supports system light/dark mode, not custom palettes
- **`tintColor` prop on NativeWind components**: Only affects a single color, not full palette
- **Two separate Tailwind configs with dynamic Metro resolution**: Over-engineered, fragile build setup

## R2: SVG-Based Line Chart for Price History

**Decision**: Custom SVG chart using `react-native-svg` (already installed at v15.12.1).

**Rationale**: The current price chart uses View-based bars, but the wireframe shows a smooth line chart with min/current markers. `react-native-svg` provides `Polyline`, `Circle`, `Text`, and `Line` primitives sufficient for a clean chart. No additional charting library needed.

**Implementation pattern**:
- Calculate x/y coordinates from price data points mapped to chart dimensions
- Render `<Polyline>` for the line, `<Circle>` for data point markers
- Render `<Text>` for week labels (S1–S8) and price labels
- Highlight min and current price with distinct colored markers
- Responsive to container width via `onLayout` measurement

**Alternatives considered**:
- **Victory Native**: Heavy dependency (~500KB), overkill for a single line chart
- **react-native-chart-kit**: Outdated, last updated 2022, doesn't support React Native 0.81
- **Skia (react-native-skia)**: High performance but heavy dependency, not justified for one chart
- **Recharts**: Web-only, does not work in React Native

## R3: Custom Floating Tab Bar in Expo Router v6

**Decision**: Custom tab bar component via `<Tabs tabBar={FloatingTabBar}>` prop.

**Rationale**: Expo Router v6's `<Tabs>` component accepts a `tabBar` prop that receives a custom component as a render function. This component gets `state`, `descriptors`, and `navigation` props from React Navigation, allowing full control over rendering.

**Implementation pattern**:
```
<Tabs tabBar={(props) => <FloatingTabBar {...props} />}>
```
The `FloatingTabBar` component:
- Absolutely positioned at bottom with `position: 'absolute'`
- Rounded corners, shadow, background blur (if supported)
- Reads theme tokens for colors
- Safe area inset padding via `useSafeAreaInsets()`
- Content in tab screens gets extra `paddingBottom` via a shared constant to prevent overlap

**Key constraint**: All tab screen ScrollViews/FlatLists must include `contentContainerStyle={{ paddingBottom: TAB_BAR_HEIGHT }}` to ensure content isn't hidden behind the floating bar. This is exported as a constant from the tab bar module.

## R4: Economy Summary — Savings Calculation Query

**Decision**: Two separate Supabase queries based on whether the user has a shopping list.

**List-based calculation (user has items)**:
```sql
-- For each list item, find the cheapest active promotion
SELECT
  sli.product_id,
  rp.price AS reference_price,
  MIN(p.promo_price) AS cheapest_promo
FROM shopping_list_items sli
JOIN shopping_lists sl ON sli.list_id = sl.id
LEFT JOIN reference_prices rp ON rp.product_id = sli.product_id
JOIN promotions p ON p.product_id = sli.product_id
  AND p.status = 'active'
  AND p.end_date > NOW()
WHERE sl.user_id = $1
GROUP BY sli.product_id, rp.price
```
`savings = Σ (reference_price - cheapest_promo)` where `cheapest_promo < reference_price`
`cheapestStore` = store appearing most frequently as cheapest across list items

**Deals-based fallback (empty list)**:
```sql
SELECT
  s.id, s.name,
  SUM(p.original_price - p.promo_price) AS total_discount
FROM promotions p
JOIN stores s ON p.store_id = s.id
WHERE p.status = 'active'
  AND p.end_date > NOW()
  AND ST_DWithin(s.location, ST_MakePoint($lng, $lat)::geography, $radius_m)
GROUP BY s.id, s.name
ORDER BY total_discount DESC
LIMIT 1
```
`savings` = total discount of the top store
`cheapestStore` = the store with highest total discount

**Alternatives considered**:
- Supabase RPC function: Possible but adds migration complexity for a UI-focused feature. Prefer client-side aggregation with the existing hooks for now.
- Pre-computed materialized view: Over-engineered for current scale (<10k users)

## R5: Visual Metaphor Implementation — Price Tag Shape

**Decision**: SVG-based component using `react-native-svg` for the price tag shape, rendered as a card wrapper.

**Rationale**: The price tag shape requires:
- A rectangular card body with rounded bottom corners
- A small circular hole near the top-left corner
- A thin "wire" line extending from the hole to a hanging point above

Pure View-based approaches cannot create the circular hole cutout. SVG with a clip path or mask provides the shape.

**Implementation pattern** (Palette A — Encarte):
- `<Svg>` container sized to card dimensions
- `<Rect>` for card body with `rx` for rounded corners
- `<Circle>` positioned top-left as the punch hole (filled with background color to simulate cutout)
- `<Path>` for the hanging wire (curved line from hole upward)
- Card content rendered as a regular `<View>` overlaid on the SVG background

**Palette B** (Fintech) uses a standard `<View>` with `rounded-2xl border border-fintech-line` — no SVG needed.

## R6: Plus-Gated Search Results — Blur Effect

**Decision**: Use `blurRadius` on React Native's `<Image>` or a semi-transparent overlay + `filter: blur()` via Expo's BlurView.

**Rationale**: The 4th+ search results for free users must appear blurred. Options:
- **`expo-blur` (`BlurView`)**: Wraps content with native blur. Works on iOS (UIVisualEffectView) and Android (RenderScript). Already available via Expo SDK 54.
- **Overlay approach**: Semi-transparent white View over the content with reduced opacity + "Assine Plus para ver" text centered. Simpler, works everywhere, no additional import needed.

**Decision**: Use the overlay approach (simpler, lighter, cross-platform consistent). A semi-transparent overlay (`bg-white/80`) with "Assine Plus para ver" text and a lock icon is sufficient and avoids BlurView performance concerns in lists.

## R7: Tab Structure Migration

**Decision**: Rename tabs from `Home/Mapa/Favoritos/Alertas/Perfil` to `Início/Busca/Mapa/Lista/Conta`.

**Impact analysis**:
- `(tabs)/index.tsx` → stays as `index.tsx` but title changes to "Início"
- `(tabs)/map.tsx` → stays, title stays "Mapa"
- `(tabs)/favorites.tsx` → **DELETE** (favorites accessible from Account)
- `(tabs)/alerts.tsx` → **DELETE** (alerts accessible from Account + product detail)
- `(tabs)/profile.tsx` → **DELETE** (replaced by `account.tsx`)
- **NEW**: `(tabs)/search.tsx` — new Search/Busca tab
- **NEW**: `(tabs)/list.tsx` — new Lista tab
- **NEW**: `(tabs)/account.tsx` — new Conta tab

The `useFavorites` and `useAlerts` hooks remain unchanged — they're still called from account screen sections and product detail.
