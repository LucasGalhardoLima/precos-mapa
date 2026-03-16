# Feature Specification: POUP B2C Consumer UI

**Feature Branch**: `002-b2c-consumer-ui`
**Created**: 2026-03-02
**Status**: Draft
**Input**: Wireframe v0.5 (8 screens) + dual-palette design system with supermarket visual metaphors

## Clarifications

### Session 2026-03-02

- Q: Should visual metaphors (price tag cards, barcode dividers, stamp badges, coupon lines) appear in both palettes or only Palette A? → A: Palette A keeps all metaphors; Palette B replaces them with clean cards, simple rule lines, pill badges, and standard separators.
- Q: How should the economy summary savings number be calculated? → A: Hybrid — use list-based savings (sum of reference price minus cheapest promo price per item) when the user has a list; fall back to aggregate nearby deals discount total when the list is empty.
- Q: Should animations, haptics, and shared element transitions be included as requirements? → A: Should-have (enhancement priority) — specify the patterns but implement after core screens are complete. Not launch-blocking.
- Q: What determines which search result stores are Plus-gated for free users? → A: Free users see the top 3 results; remaining stores are blurred with Plus upsell.
- Q: How should network/API errors be presented to the user? → A: Inline retry banner within the failing section ("Não foi possível carregar. Tentar novamente?"), preserving any cached/stale data underneath. No full-screen error pages.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Design System & Theming Foundation (Priority: P1)

As the product team, we need a cohesive design system with two switchable visual palettes so that we can A/B test which visual identity resonates more with Brazilian grocery shoppers.

**Palette A — "Encarte" (Supermarket Flyer)**:
- Background: warm receipt paper (#FAF7F0) with subtle horizontal lines and dotted separators
- Header: chalkboard dark (#1E2820) with chalk-white text
- Primary: fresh market green (#2A6041)
- Accent: price tag red (#C8392B), flyer mustard (#E8A020)
- Visual metaphors: price tag shaped cards with hole + hanging wire, barcode section dividers, ✂ coupon cut lines, oval stamp badges with double border ("OFERTA", "LIQUIDAÇÃO")

**Palette B — "Fintech" (Clean Financial)**:
- Background: cool box white (#FAFBFC) with surface cards (#F2F4F7) and rule lines (#DDE2EA)
- Text: graphite (#0D1520) primary, lead (#4A5568) secondary, silver (#8A97A8) hints
- Primary spectrum: deep green (#0B5E3A) → medium green (#167A4D) → vivid green (#22A06B) → soft green (#E2F5EC)
- Discount red (exclusive to promotions): offer red (#C8192B), active red (#E41E32), soft red (#FDEAEC)
- Gold (scarce, achievement-only): gold (#9A6108), bright gold (#CF8B12), light gold (#F9EFD8)
- Dark (financial gravity): night (#0C1829), dawn (#162438), mist (#E8EDF5)

**Semantic color rules (both palettes)**:
- Red appears ONLY when there is a discount — never on generic buttons, headers, or errors
- Gold appears ONLY for achievements, Plus features, and triggered alerts
- Green = savings, economy, positive outcomes
- Dark backgrounds = financial data, economy dashboards, headers

**Floating bottom navbar**: The tab bar floats above content with a shadow, allowing content to scroll behind it. 5 tabs: Início, Busca, Mapa, Lista, Conta.

**Why this priority**: Every screen depends on the design tokens, visual metaphors, and navbar. Without this foundation, no other story can deliver the intended visual identity.

**Independent Test**: Can be tested by rendering a component gallery screen that displays all primitives (price tag card, barcode divider, stamp badge, coupon line, receipt background, floating navbar) in both palettes, toggled by a developer switch.

**Acceptance Scenarios**:

1. **Given** the app is loaded, **When** the user (or developer) toggles the palette switch, **Then** all colors, backgrounds, and visual metaphors update to the selected palette without restarting the app
2. **Given** Palette A is active, **When** viewing any screen, **Then** backgrounds show warm receipt paper texture with dotted separators and product cards have price tag shapes
3. **Given** Palette B is active, **When** viewing any screen, **Then** backgrounds show cool white with card surfaces and clean rule lines
4. **Given** either palette, **When** a discount badge appears, **Then** it uses the red color family exclusively; red does not appear anywhere else
5. **Given** either palette, **When** the user scrolls content, **Then** the bottom navbar remains floating with a visible shadow and content passes behind it

---

### User Story 2 — Home Dashboard with Economy Summary (Priority: P2)

As a consumer, I want to see how much I can save today, the best deals near me, and which stores are cheapest this week, so I can decide where to shop.

The home screen has three sections:
1. **Economy summary card** — dark background card at the top showing total potential savings (e.g., "R$ 42,30"), the cheapest store, and a "Comparar lista" button
2. **Ofertas perto de você** — horizontal-scrolling row of deal cards showing product name, promo price, original price (crossed out), and a discount percentage stamp badge. Each card is a price tag shape. A "Ver todas" link leads to the full search
3. **Ranking da semana** — vertical list of the 3 cheapest stores for a base basket, showing store name, total basket price, and percentage saved. Labeled by city (e.g., "mais baratos · SP")

A search bar sits below the economy card with category filter chips (Todos, Carnes, Hortifruti, Laticínios, etc.).

**Why this priority**: The home screen is the first thing users see after onboarding. The economy summary is the core value proposition — "we find savings for you."

**Independent Test**: Can be tested by loading the home screen with seed data (promotions, stores, products) and verifying all three sections render with correct data, scroll behavior, and navigation.

**Acceptance Scenarios**:

1. **Given** a logged-in user with a shopping list and location permission, **When** they open the app, **Then** the economy card shows savings calculated from list items (reference price minus cheapest promo price per item). **Given** a user with an empty list, **When** they open the app, **Then** the economy card shows aggregate discount total from nearby active deals
2. **Given** deals exist near the user, **When** viewing "Ofertas perto de você", **Then** deal cards show product image, name, promo price, original price strikethrough, and a discount percentage stamp badge
3. **Given** the store ranking has data, **When** viewing "Ranking da semana", **Then** it shows the top 3 cheapest stores with total base basket price and savings percentage
4. **Given** the user taps a category chip, **When** the chip is selected, **Then** the deals section filters to show only products in that category
5. **Given** the user taps "Comparar lista", **When** they have items in their list, **Then** they navigate to the list comparison view

---

### User Story 3 — Product Search & Store Comparison (Priority: P3)

As a consumer searching for a specific product (e.g., "Arroz 5kg"), I want to see which stores sell it and at what price, sorted by price/distance/discount, so I can find the best deal.

The search screen shows:
- A text search input with clear button
- Three sort tabs: "Menor preço", "Distância", "Desconto"
- A list of store results, each showing: store name, distance, opening status ("Aberto agora"), promo price, original price (strikethrough), and discount percentage badge
- The cheapest store gets a "Melhor preço" stamp badge
- Stores that require Plus to view are shown blurred/locked with "Assine Plus para ver" teaser

**Why this priority**: Search is the primary action loop. Users come to find a product and compare prices across stores. This is the conversion funnel.

**Independent Test**: Can be tested by searching for a known product with multiple store prices and verifying sort order, badge placement, and Plus gating.

**Acceptance Scenarios**:

1. **Given** the user types "Arroz 5kg" in search, **When** results load, **Then** a list of stores appears showing each store's price for that product
2. **Given** search results are showing, **When** the user taps "Menor preço", **Then** results sort by ascending promo price
3. **Given** search results are showing, **When** the user taps "Distância", **Then** results sort by proximity to user
4. **Given** search results are showing, **When** the user taps "Desconto", **Then** results sort by highest discount percentage first
5. **Given** a store has the lowest price, **When** results render, **Then** that store shows a "Melhor preço" stamp badge
6. **Given** a free-plan user, **When** search returns more than 3 stores, **Then** the 4th+ stores appear blurred with an "Assine Plus para ver" overlay and tapping opens the paywall

---

### User Story 4 — Shopping List as Receipt (Priority: P4)

As a consumer, I want to maintain a shopping list that looks and feels like a grocery receipt, showing me which items to buy at which stores and my total estimated savings.

The list screen shows:
- A header "Minha Lista" with "+ Item" button
- An economy summary card showing total estimated savings (e.g., "R$ 34,20"), item/store count, and a "Ver rota" button
- A list of items in receipt style: each item shows a checkmark, product name + weight, store attribution (best store), and price — separated by dotted lines like a real receipt
- Free-plan users see a lock after N items with "Assine Plus · listas ilimitadas" upsell
- Skeleton loading state while data loads

**Why this priority**: The shopping list is the retention hook. Users who build a list return daily. The receipt metaphor reinforces the "savings" mental model.

**Independent Test**: Can be tested by adding items to a list and verifying receipt layout, savings calculation, store attribution, free-plan limits, and skeleton loading.

**Acceptance Scenarios**:

1. **Given** a user with items in their list, **When** they open the Lista tab, **Then** items display in receipt format with dotted separators, product name, store, and price
2. **Given** a list with items from 3 stores, **When** viewing the economy card, **Then** it shows total savings, item count, store count, and "Ver rota" button
3. **Given** a user taps "+ Item", **When** they search and select a product, **Then** it is added to the list with the cheapest store auto-assigned
4. **Given** a free-plan user with more items than the free limit, **When** viewing the list, **Then** excess items appear locked with a Plus upsell message
5. **Given** the user taps an item's checkmark, **When** toggling it, **Then** the item is visually marked as purchased (strikethrough or dimmed)
6. **Given** data is loading, **When** the list tab opens, **Then** skeleton placeholders animate in place of real items

---

### User Story 5 — Product Detail with Price Intelligence (Priority: P5)

As a consumer viewing a specific product at a specific store, I want to see its price history, set a price alert, and compare prices across all stores, so I can decide whether to buy now or wait.

The detail screen shows:
- Product image carousel with "Imagem ilustrativa" label
- Product metadata: name, category (e.g., "Grãos"), type, weight
- **Price history chart** — line chart showing price over weeks (S1–S8), with min/current markers
- **Price alert** — "Alerta de queda de preço: Avisar quando baixar de R$ X" with "Ativar" toggle
- **Store comparison list** — all stores carrying this product with: store name, status ("Aberto"), promo price, and discount percentage badge
- **"+ Adicionar à lista"** CTA button fixed at the bottom

A back arrow and "Alertas" link sit in the navigation header.

**Why this priority**: Price intelligence differentiates POUP from simple deal apps. Users who set alerts have 3x higher retention. The comparison drives purchase decisions.

**Independent Test**: Can be tested by navigating to a product with historical price data and verifying chart rendering, alert toggle, store comparison, and add-to-list action.

**Acceptance Scenarios**:

1. **Given** a user taps a product from search or home, **When** the detail screen opens, **Then** it shows product image, name, metadata, price chart, and store list
2. **Given** a product has 8+ weeks of price data, **When** viewing the chart, **Then** it renders a line chart with labeled weeks and a marker at the current/minimum price
3. **Given** a user sets a price alert threshold, **When** tapping "Ativar", **Then** the alert is saved and the user sees confirmation
4. **Given** the comparison list has multiple stores, **When** viewing it, **Then** stores sort by price with discount percentage badges on discounted items
5. **Given** the user taps "+ Adicionar à lista", **When** they confirm, **Then** the product is added to their shopping list at the cheapest available price

---

### User Story 6 — Map with List-Aware Store Routing (Priority: P6)

As a consumer with a shopping list, I want to see stores on a map with their prices, grouped by which list items each store carries, so I can plan an efficient shopping route.

The map screen shows:
- An interactive map with store markers. Each marker shows the store's total price for the user's list items (if applicable) or a generic label
- A "Ver minha lista" floating button in the top-right corner
- A bottom panel "Itens da lista por mercado" showing: store name, item count, subtotal, and a "rota" button that opens turn-by-turn navigation
- The cheapest store's marker is visually highlighted ("+ mais barato" label)

**Why this priority**: The map is a differentiator — it bridges the digital list with the physical shopping trip. Users with location permission are higher-value.

**Independent Test**: Can be tested by creating a list with items available at 3+ stores, then verifying map markers show correct prices, bottom panel groups correctly, and route button opens navigation.

**Acceptance Scenarios**:

1. **Given** a user with location permission and list items, **When** they open the Mapa tab, **Then** the map centers on their location with store markers showing list-relevant prices
2. **Given** multiple stores carry list items, **When** viewing "Itens da lista por mercado", **Then** each store shows its name, how many list items it has, and the subtotal
3. **Given** one store is cheapest for the full list, **When** viewing markers, **Then** that marker has a visual "mais barato" highlight
4. **Given** the user taps "rota" on a store, **When** the action triggers, **Then** it opens turn-by-turn navigation to that store
5. **Given** a user without a list, **When** viewing the map, **Then** markers show store names and general deal counts instead of list prices

---

### User Story 7 — Onboarding Flow (Priority: P7)

As a first-time user, I want a clear, visually striking introduction that explains POUP's value and gets me started quickly, so I understand why this app saves me money.

The onboarding screen uses a chalkboard-style dark background (per Palette A) or night-dark background (per Palette B) with:
- A hero illustration showing price tags on a map with different prices
- Three value propositions with icons: "Escolha seus mercados", "Permita a localização", "Comece a economizar"
- A prominent "Começar" CTA button
- A "já tenho conta" link for returning users
- Pagination dots indicating carousel position

**Why this priority**: Onboarding sets the first impression but existing users skip it. It's important for conversion but lower priority than core features.

**Independent Test**: Can be tested by launching the app as a new user and verifying all onboarding steps display correctly, "Começar" leads to auth, and "já tenho conta" leads to login.

**Acceptance Scenarios**:

1. **Given** a first-time user opens the app, **When** the onboarding loads, **Then** it shows a dark-background screen with hero illustration and three value propositions
2. **Given** the user is on onboarding, **When** they tap "Começar", **Then** they proceed to authentication (sign up)
3. **Given** the user is on onboarding, **When** they tap "já tenho conta", **Then** they proceed to authentication (sign in)
4. **Given** the user has completed onboarding before, **When** they reopen the app, **Then** onboarding is skipped and they land on the home screen

---

### User Story 8 — Account, Preferences & Paywall (Priority: P8)

As a consumer, I want to manage my account, configure my preferences, and upgrade to Plus for premium features, all from a single profile screen.

**Account screen (Conta)** shows:
- User avatar/initial, name, email, and current plan badge ("FREE" / "PLUS")
- "Upgrade para Plus" CTA card with benefit highlights and "7 dias grátis" teaser
- **Preferences section**: Alertas de oferta (configure), Localização (city display), Meus mercados (selected count)
- **Account section**: Alterar senha, Histórico de buscas, Excluir conta
- **Subscription section**: Plano atual, Termos de uso

**Paywall modal** (triggered from upgrade CTA, locked features, or Plus badges):
- Dark background with large savings number (e.g., "R$ 120")
- "+ POUP PLUS" branding
- "Economize mais. Sem limites." tagline
- Feature comparison table: Free vs Plus (Alertas, Histórico 90d, Listas ilimitadas, Alertas de preço, Análise de economia)
- Pricing options: Mensal R$ 9,90 / Anual R$ 6,90 (with -30% badge)
- "Experimentar 7 dias grátis" CTA

**Why this priority**: The paywall is the monetization layer. It's critical for business but users need to experience value (P1-P6) before being asked to pay.

**Independent Test**: Can be tested by navigating to Conta tab and verifying profile info, tapping upgrade to trigger paywall, and completing a mock subscription flow.

**Acceptance Scenarios**:

1. **Given** a logged-in user, **When** they open the Conta tab, **Then** they see their name, email, current plan badge, and all preference/account sections
2. **Given** a free-plan user, **When** they tap "Upgrade para Plus", **Then** the paywall modal appears with feature comparison and pricing
3. **Given** the paywall is open, **When** the user views pricing, **Then** they see monthly and annual options with the annual discount badge
4. **Given** the user taps "Experimentar 7 dias grátis", **When** the subscription flow completes, **Then** the user's plan updates to Plus and the paywall dismisses
5. **Given** a Plus user, **When** they open the Conta tab, **Then** the upgrade CTA is replaced with plan management and the badge shows "PLUS"
6. **Given** any user, **When** they tap "Excluir conta", **Then** they see a confirmation dialog before account deletion proceeds

---

### Edge Cases

- What happens when the user has no items in their shopping list? The economy card shows "R$ 0,00" with a prompt to add items; the map shows generic store markers without list grouping
- What happens when no deals exist near the user? The "Ofertas perto de você" section shows an empty state with a suggestion to expand search radius
- What happens when the user denies location permission? The app functions without map centering, distance sorting, or "perto de você" — features degrade gracefully with a banner encouraging permission
- What happens when a product has no price history? The price chart section shows a "Dados insuficientes" message instead of the chart
- What happens when palette switch is toggled mid-session? All screens update immediately without data loss or navigation reset
- What happens on slow connections? Skeleton loading states appear for all data-dependent sections; cached data shows while refreshing
- What happens when a store is closed? The store still appears in results with "Fechado" status; it is not filtered out
- What happens when a network request fails? The failing section shows an inline retry banner ("Não foi possível carregar. Tentar novamente?") while preserving any cached or stale data underneath; no full-screen error pages
- What happens when search returns 0 results? The search screen shows an empty state with "Nenhum resultado encontrado" and a suggestion to try a different term

## Requirements *(mandatory)*

### Functional Requirements

**Design System & Theming**

- **FR-001**: The app MUST support two complete visual palettes ("Encarte" and "Fintech") switchable without app restart
- **FR-002**: The palette selection MUST persist across sessions
- **FR-003**: In Palette A, product deal cards MUST render in a price tag shape with a decorative hole and hanging wire element. In Palette B, deal cards MUST render as clean rounded cards with subtle border
- **FR-004**: In Palette A, section dividers MUST use a barcode-style visual. In Palette B, section dividers MUST use simple rule lines
- **FR-005**: In Palette A, discount badges MUST use an oval stamp shape with double border (e.g., "-23%", "OFERTA"). In Palette B, discount badges MUST use pill-shaped badges
- **FR-006**: In Palette A, the shopping list screen MUST use a receipt paper visual style with dotted separators between items. In Palette B, the list MUST use clean card-based layout with standard separators
- **FR-007**: In Palette A, paywall and alert sections MUST be separated by a coupon cut line (✂ - - - -). In Palette B, these sections MUST use a standard spacing divider
- **FR-008**: The bottom tab bar MUST float above content with a shadow, allowing content to scroll behind it
- **FR-009**: Red color MUST appear exclusively on discount/promotion elements — never on generic buttons, headers, or error states
- **FR-010**: Gold color MUST appear exclusively for achievements, Plus features, and triggered alerts

**Home Screen**

- **FR-011**: The home screen MUST display an economy summary card showing total potential savings in currency. When the user has a shopping list, savings MUST be calculated as the sum of (reference price − cheapest promo price) per list item. When the list is empty, savings MUST show the aggregate discount total from nearby active deals
- **FR-012**: The economy card MUST show the cheapest store name and a "Comparar lista" action. When the list is empty, it MUST show the store with the highest total discount value nearby
- **FR-013**: The home screen MUST show a horizontally scrollable row of nearby deal cards with product name, promo price, original price strikethrough, and discount stamp
- **FR-014**: The home screen MUST show a "Ranking da semana" section with the top 3 cheapest stores for a reference basket
- **FR-015**: Category filter chips MUST filter the deals section by product category

**Search & Comparison**

- **FR-016**: Users MUST be able to search for products by name via a text input
- **FR-017**: Search results MUST show a list of stores carrying the searched product with per-store pricing
- **FR-018**: Results MUST be sortable by three criteria: lowest price, distance, and highest discount
- **FR-019**: The store with the lowest price MUST display a "Melhor preço" stamp badge
- **FR-020**: Free-plan users MUST see only the top 3 store results; any additional stores MUST appear blurred/locked with an "Assine Plus para ver" upsell overlay

**Shopping List**

- **FR-021**: Users MUST be able to add, remove, and check off items in a shopping list
- **FR-022**: The list MUST display total estimated savings, item count, and store count in a summary card
- **FR-023**: Each list item MUST show the product name, best store, and price
- **FR-024**: The list MUST include a "Ver rota" action that opens navigation to the recommended store(s)
- **FR-025**: Free-plan users MUST see items beyond the free limit as locked with a Plus upsell

**Product Detail**

- **FR-026**: The product detail screen MUST show product image, name, category, type, and weight
- **FR-027**: The detail screen MUST display a price history line chart with weekly data points
- **FR-028**: Users MUST be able to set a price drop alert with a custom threshold
- **FR-029**: The detail screen MUST show a comparison of all stores carrying the product with prices and discount badges
- **FR-030**: A persistent "Adicionar à lista" action MUST be available at the bottom of the detail screen

**Map**

- **FR-031**: The map MUST display store markers centered on the user's location
- **FR-032**: Store markers MUST show list-relevant pricing when the user has a shopping list
- **FR-033**: A bottom panel MUST group the user's list items by store with subtotals
- **FR-034**: The cheapest store MUST have a visually distinct marker ("mais barato")
- **FR-035**: Each store in the bottom panel MUST have a "rota" action to open navigation

**Onboarding**

- **FR-036**: First-time users MUST see an onboarding flow before accessing the main app
- **FR-037**: Onboarding MUST display three value propositions with icons
- **FR-038**: Onboarding MUST offer both "Começar" (new user) and "já tenho conta" (returning user) paths
- **FR-039**: Onboarding MUST be skipped for returning users who have completed it

**Account & Paywall**

- **FR-040**: The account screen MUST show user info, current plan badge, and all preference sections
- **FR-041**: The paywall MUST show a feature comparison table (Free vs Plus) with monthly and annual pricing
- **FR-042**: The paywall MUST display the annual discount as a percentage badge (e.g., "-30%")
- **FR-043**: The paywall MUST offer a free trial entry point ("Experimentar 7 dias grátis")
- **FR-044**: Users MUST be able to delete their account from the account screen with confirmation

**Error Handling**

- **FR-050**: When a data section fails to load, the app MUST show an inline retry banner ("Não foi possível carregar. Tentar novamente?") within that section, preserving any cached data visible underneath
- **FR-051**: The app MUST NOT display full-screen error pages; errors MUST be scoped to the failing section only
- **FR-052**: When search returns 0 results, the app MUST show an empty state with "Nenhum resultado encontrado" and a suggestion to refine the search

**Animations & Haptics (should-have, enhancement priority — implement after core screens)**

- **FR-045**: The bottom navbar SHOULD use physics-based spring animations for tab transitions
- **FR-046**: Tapping interactive elements (add to list, toggle alert, check item) SHOULD trigger light haptic feedback
- **FR-047**: Navigating from a deal card to product detail SHOULD use a shared element transition (card expands into detail view)
- **FR-048**: List item check-off SHOULD animate with a satisfying completion motion (checkmark + strikethrough)
- **FR-049**: Data mutations (add item, set alert, toggle favorite) SHOULD use optimistic UI — update the interface immediately and reconcile with the server in the background

### Key Entities

- **Theme/Palette**: The active visual identity (Encarte or Fintech), including all color tokens, background textures, and visual metaphor styles. Persisted as a user preference.
- **Deal Card**: A product promotion displayed as a price tag shape, containing product reference, store, promo price, original price, and discount percentage.
- **Economy Summary**: An aggregated view of potential savings based on the user's list and nearby deals, showing total savings, cheapest store, and comparison action.
- **Store Ranking**: A weekly computed ranking of the cheapest stores for a reference basket, specific to the user's city.
- **Price Alert**: A user-defined threshold on a product that triggers a notification when the price drops below it.

## Assumptions

- The existing data layer (Supabase queries, hooks for promotions, stores, categories, price history, favorites, alerts, shopping lists) is already functional and will be reused. This spec focuses on the visual/UI layer.
- The app name in the wireframe is "POUP" — all UI text references POUP branding.
- The palette switch is primarily a development/testing tool for now and can live in a developer settings menu or the account screen. It does not need to be a user-facing A/B test system.
- "Ranking da semana" uses a reference basket defined by the system (common staple items), not the user's personal list.
- The "Ver rota" action opens the device's native maps app (Google Maps or Apple Maps) rather than in-app navigation.
- Skeleton loading follows the same visual style as the active palette.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All 8 screens (Onboarding, Home, Search, Map, List, Detail, Account, Paywall) render correctly in both palettes without visual artifacts or broken layouts
- **SC-002**: Users can switch palettes and see all screens update within 1 second, with no data loss or navigation disruption
- **SC-003**: Users can complete the core flow — search product → compare prices → add to list → view on map → get route — in under 60 seconds
- **SC-004**: All discount badges use red exclusively; a visual audit confirms red does not appear on any non-discount element
- **SC-005**: Free-plan users encounter at least 3 natural Plus upsell touchpoints (search results, list limits, paywall) without the experience feeling obstructive
- **SC-006**: The floating navbar remains visible and responsive during all scroll interactions across all tab screens
- **SC-007**: Skeleton loading states appear within 200ms of navigation for all data-dependent screens
- **SC-008**: All visual elements render identically across iOS and Android — Palette A metaphors (price tag cards, barcode dividers, stamp badges, receipt separators, coupon lines) and Palette B clean equivalents (rounded cards, rule lines, pill badges, standard separators)
