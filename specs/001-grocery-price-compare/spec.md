# Feature Specification: Grocery Price Comparison Platform

**Feature Branch**: `001-grocery-price-compare`
**Created**: 2026-02-10
**Status**: Draft
**Input**: User description: "Build a mobile app that helps users save money on groceries by comparing promotional prices across different supermarkets."

## Demo Scope

This specification describes the full production vision. The **immediate
deliverable** is a client-facing demo of the consumer mobile app (React
Native / Expo) using mock data. The existing Next.js admin panel demo
(dashboard, offers CRUD, AI importer, RBAC) is already in place and
does not require changes for this phase.

### Demo includes (interactive, with mock data):
- **US0 - Onboarding**: Social proof, testimonials, featured deals,
  dual-audience CTAs. Auth is simulated (tap to enter).
- **US1 - Search/Browse**: Product search, filter chips, category tabs,
  enriched deal cards, "Perto de voce" section.
- **US2 - Map**: Interactive map with store markers, logos, tappable
  bottom sheet with promotion summaries.

### Demo includes (static mockup only):
- **US3 - Favorites**: Pre-populated favorites list screen showing
  saved products with best prices. No real persistence or push
  notifications.

### Deferred to production (not in demo):
- **US4 - Admin panel**: Already demo'd via existing Next.js web app.
- **US5 - Plans/billing**: Already demo'd via existing admin panel.
- Real authentication (Google/Apple Sign-In)
- Real backend API integration
- Push notifications
- Offline support
- Fuzzy search / synonym resolution

### Consumer app navigation (bottom tab bar):
- **Home** (house icon): Search bar + filter chips + category tabs +
  deal feed + "Perto de voce" section. Primary landing tab after auth.
- **Map** (map-pin icon): Interactive map with store markers and
  bottom sheet promotion summaries.
- **Favorites** (heart icon): Saved products list with best current
  prices. Static mockup in demo; real persistence in production.
- **Alerts** (bell icon): Deal alert notifications feed. Static
  placeholder screen in demo; push-notification-driven in production.

### Demo data strategy:
- Consumer app uses an expanded mock dataset: same 4 markets from
  the admin panel (Carol Supermercado, Mais Barato Araraquara, Bom
  Dia Ribeirao, Santa Fe Sao Carlos) with ~25-30 offers spread
  across all browsing categories (Bebidas, Limpeza, Alimentos,
  Hortifruti, Padaria, etc.) to make search, filters, and category
  tabs feel populated and realistic.
- Map uses a real interactive map (react-native-maps with Google Maps
  on Android, Apple Maps on iOS) with actual geo-coordinates for the
  4 demo stores in the Matao/SP region.
- Social proof stats are hardcoded (e.g., "+3,200 usuarios",
  "R$47 economia media/mes").
- Each offer includes enrichment data: original price, promotional
  price, discount %, reference price for "abaixo do normal"
  calculation, verification status, and expiry date.

## User Scenarios & Testing *(mandatory)*

### User Story 0 - Onboarding and Audience Routing (Priority: P1)

As a first-time visitor, I want to immediately understand what
PrecoMapa does, see proof that it works (user stats, savings,
testimonials), and choose whether I am a consumer looking for deals or
a supermarket wanting to publish promotions, so I can get started
quickly on the right path.

**Why this priority**: This is the first screen every user sees. It
must communicate value, build trust, and route users to the correct
experience. Without effective onboarding, acquisition and activation
rates suffer regardless of how good the core features are.

**Independent Test**: Open the app for the first time. See the
PrecoMapa brand, location context, social proof stats, testimonials,
a preview of featured deals, and two clear entry paths. Tap "Sou
Consumidor" and arrive at the consumer sign-in flow. Go back and tap
"Tenho um Mercado" and arrive at the admin panel access flow.

**Acceptance Scenarios**:

1. **Given** a first-time user opens the app, **When** the onboarding
   screen loads, **Then** they see: the PrecoMapa logo and tagline,
   their detected city/region, social proof stats (user count and
   average monthly savings), user testimonials with savings amounts,
   a preview carousel of featured deals, and two CTA cards — "Sou
   Consumidor" and "Tenho um Mercado."
2. **Given** a user is on the onboarding screen, **When** they tap
   "Sou Consumidor" / "Entrar com Google", **Then** they are taken
   to the consumer authentication flow and upon success land on the
   home/search screen.
3. **Given** a user is on the onboarding screen, **When** they tap
   "Tenho um Mercado" / "Acessar Painel Admin", **Then** they are
   redirected to the supermarket admin panel login (web).
4. **Given** a returning authenticated user opens the app, **When**
   the app loads, **Then** they skip onboarding and land directly on
   the home/search screen.

---

### User Story 1 - Search, Browse, and Compare Promotional Prices (Priority: P1)

As a shopper, I want to search for a grocery product or browse deals
by category and filters, and instantly see which nearby supermarkets
have the best promotions so I can buy at the lowest price without
visiting multiple stores.

**Why this priority**: This is the core value proposition. Without price
comparison and deal discovery, the platform has no reason to exist.
Every other feature depends on users being able to find and compare
deals — whether they search by name or browse what's available.

**Independent Test**: Open the home screen, see quick-filter chips
("Mais barato", "Mais perto", "Acaba hoje"), category tabs ("Todos",
"Bebidas", etc.), and a "Perto de voce" section with nearby deals.
Search for "arroz 5kg" and see a ranked list of promotions. Toggle
filters and verify results update accordingly.

**Acceptance Scenarios**:

1. **Given** a user with location enabled, **When** they search for
   "leite integral", **Then** they see a list of current promotions
   for that product sorted by lowest price, each showing store name,
   price, distance, promotion expiry date, discount percentage,
   verified badge (if confirmed), and "X% abaixo do normal" indicator.
2. **Given** a user searches for a product, **When** no promotions
   exist for that product, **Then** they see a friendly empty state
   message suggesting similar products or categories.
3. **Given** a user searches for a product, **When** multiple stores
   have the same price, **Then** results are sorted by nearest
   distance.
4. **Given** a user denies location access, **When** they search for
   a product, **Then** they are prompted to enter a neighborhood or
   ZIP code manually, and results use that location.
5. **Given** a user is on the home screen, **When** they tap a
   quick-filter chip ("Mais barato", "Mais perto", or "Acaba hoje"),
   **Then** the deal feed re-sorts/filters accordingly.
6. **Given** a user is on the home screen, **When** they tap a
   category tab (e.g., "Bebidas", "Limpeza"), **Then** the deal feed
   shows only promotions in that category.
7. **Given** a user is on the home screen, **When** the "Perto de
   voce" section loads, **Then** it displays nearby deals from the
   closest stores regardless of category.

---

### User Story 2 - Explore Nearby Stores on Map (Priority: P2)

As a shopper, I want to see an interactive map of supermarkets near me
with their logos/brands so I can visually identify which stores are
closest and tap on them to see their current promotions.

**Why this priority**: The map is a key differentiator and the primary
discovery mechanism. It complements search by letting users browse
deals geographically rather than by product.

**Independent Test**: Open the map view, see pins/markers for nearby
supermarkets with their brand logos. Tap a marker, see a summary card
with the store's top current promotions and a link to the full list.

**Acceptance Scenarios**:

1. **Given** a user opens the map view with location enabled, **When**
   the map loads, **Then** it centers on their current position and
   shows supermarket markers within a default 5 km radius.
2. **Given** a user sees store markers on the map, **When** they tap
   a marker, **Then** a bottom sheet appears showing the store name,
   logo, address, distance, number of active promotions, and top 3
   deals.
3. **Given** a user is on the map, **When** they pan or zoom to a new
   area, **Then** new store markers load dynamically for the visible
   region.
4. **Given** a user without location access, **When** they open the
   map, **Then** they can search for a location and the map centers
   on it.

---

### User Story 3 - Save Favorite Products and Get Alerts (Priority: P3)

As a frequent shopper, I want to save products to a favorites list and
receive notifications when any of them go on promotion near me, so I
never miss a deal on items I regularly buy.

**Why this priority**: Favorites and alerts drive retention and repeat
engagement. They convert casual browsers into daily active users. This
builds on top of search (US1) and location (US2).

**Independent Test**: Add "cafe Pilao 500g" to favorites. Verify it
appears in the favorites list. Simulate a new promotion for that
product at a nearby store. Verify the user receives a push notification
with the deal details.

**Acceptance Scenarios**:

1. **Given** a user views a product in search results, **When** they
   tap the favorite/heart icon, **Then** the product is added to their
   favorites list and the icon toggles to filled/active state.
2. **Given** a user has products in favorites, **When** they open the
   favorites tab, **Then** they see all saved products with the
   current best price and which store offers it.
3. **Given** a user has "azeite extra virgem" in favorites, **When**
   a new promotion appears for that product within their configured
   radius, **Then** they receive a push notification with the store
   name, price, and distance.
4. **Given** a user has favorites, **When** a favorited product has
   no active promotions, **Then** the favorites list shows the last
   known price with a "no current deals" indicator.

---

### User Story 4 - Supermarket Admin: Manage Promotions (Priority: P4)

As a supermarket manager, I want to publish and manage my store's
promotional offers through an admin panel so that shoppers can discover
my deals and visit my store.

**Why this priority**: The supply side of the marketplace. Without
stores publishing promotions, there is no data for consumers. However,
initial data can come from web scraping (existing crawler), making this
a P4 that enables the self-serve pipeline.

**Independent Test**: Log in as a supermarket admin. Create a new
promotion for "Coca-Cola 2L" at R$7.99 valid for 7 days. Verify it
appears in the admin's promotion list and becomes visible to end users
in search results.

**Acceptance Scenarios**:

1. **Given** a supermarket admin logs into the admin panel, **When**
   the dashboard loads, **Then** they see an overview of active
   promotions, total views, and plan usage.
2. **Given** an admin clicks "New Promotion", **When** they fill in
   product name, original price, promotional price, start date, and
   end date, **Then** the promotion is published and visible to
   consumers immediately.
3. **Given** an admin has active promotions, **When** they edit or
   delete a promotion, **Then** the change reflects in consumer-facing
   results within 5 minutes.
4. **Given** a supermarket is on the Free plan, **When** they try to
   create more promotions than the plan allows, **Then** they see an
   upgrade prompt explaining Pro plan benefits.

---

### User Story 5 - Supermarket Plans: Free vs Pro (Priority: P5)

As a supermarket owner, I want to choose between a Free and Pro plan
so that I can start publishing promotions at no cost and upgrade when
I need advanced features to attract more customers.

**Why this priority**: Monetization is critical but depends on having
an active user base first. The plan system is the business model layer
that sits on top of the admin panel (US4).

**Independent Test**: Register a new supermarket on the Free plan.
Verify plan limits are enforced. Upgrade to Pro. Verify additional
features become available.

**Acceptance Scenarios**:

1. **Given** a new supermarket registers, **When** they complete
   onboarding, **Then** they are placed on the Free plan by default
   with clear documentation of included features and limits.
2. **Given** a supermarket is on the Free plan, **When** they view
   the plan management page, **Then** they see a comparison table
   showing Free vs Pro features, limits, and pricing.
3. **Given** a supermarket wants to upgrade, **When** they select the
   Pro plan, **Then** they complete payment and immediately gain
   access to Pro features.
4. **Given** a Pro supermarket, **When** their subscription lapses,
   **Then** they are downgraded to Free with a grace period and clear
   communication about what features they lose.

---

### Edge Cases

- What happens when a user searches for a product with multiple
  common names (e.g., "leite condensado" vs "leite moca")?
  The system MUST support synonym matching and brand-to-category
  mapping to return relevant results.
- What happens when a promotion expires while a user is viewing it?
  The UI MUST gracefully remove or mark the promotion as expired
  without crashing or showing stale data.
- What happens when a supermarket publishes a promotion with an
  unrealistically low price (e.g., R$0.01)?
  The system MUST flag outlier prices for review before publishing.
- How does the system handle two supermarkets with overlapping
  geo-coordinates (e.g., same shopping mall)?
  Map markers MUST cluster or offset to remain individually tappable.
- What happens when the user's device loses connectivity while
  browsing promotions?
  The app MUST show cached results with a "last updated" timestamp
  and a retry banner.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow users to search for grocery products
  by name and display matching promotions sorted by price.
- **FR-002**: System MUST determine the user's location (GPS or
  manual input) and filter results to nearby stores within a
  configurable radius (default 5 km).
- **FR-003**: System MUST display an interactive map with supermarket
  markers showing brand logos and tappable promotion summaries.
- **FR-004**: System MUST allow users to save products to a favorites
  list persisted across sessions.
- **FR-005**: System MUST send push notifications to users when a
  favorited product goes on promotion within their radius.
- **FR-006**: System MUST provide an admin panel where supermarket
  managers can create, edit, and delete promotional offers.
- **FR-007**: System MUST enforce plan-based limits (Free vs Pro) on
  the number and features of supermarket promotions.
- **FR-008**: System MUST display all user-facing content in
  Portuguese (pt-BR).
- **FR-009**: System MUST show promotion expiry dates and
  automatically hide expired promotions from consumer results.
- **FR-010**: System MUST support offline browsing of previously
  loaded results with a clear staleness indicator.
- **FR-011**: System MUST allow users to navigate to a store using
  their device's native maps application.
- **FR-012**: System MUST support product search with fuzzy matching
  and synonym resolution (e.g., brand names mapped to categories).
- **FR-013**: System MUST display deal enrichment on promotion cards:
  discount percentage relative to original price, a "verified" badge
  for confirmed promotions, a "X% abaixo do normal" indicator comparing
  against the product's reference price, and motivational gamification
  messages (e.g., "Voce evitou pagar caro!").
- **FR-014**: System MUST maintain a reference (average/typical) price
  per product, derived from historical promotion data, to compute
  "below normal" indicators.
- **FR-015**: The home screen MUST display quick-filter chips ("Mais
  barato", "Mais perto", "Acaba hoje") and category tabs ("Todos",
  "Bebidas", "Limpeza", etc.) allowing users to browse deals without
  searching by product name.
- **FR-016**: The home screen MUST include a "Perto de voce" section
  showing nearby deals from the closest stores based on user location.
- **FR-018**: The consumer app MUST use a bottom tab bar with 4 tabs:
  Home (search/browse), Map, Favorites, and Alerts. The Home tab is
  the default landing screen after authentication.
- **FR-017**: System MUST present first-time users with an onboarding
  screen showing social proof (user count, average savings),
  testimonials, a featured deals preview, and dual-audience CTAs
  ("Sou Consumidor" / "Tenho um Mercado"). Returning authenticated
  users MUST bypass onboarding.

### Key Entities

- **Product**: A grocery item identified by name, category (e.g.,
  Bebidas, Limpeza, Alimentos), and optional brand. Category is
  required and used for browsing tabs. Serves as the anchor for
  promotions and favorites.
- **Promotion**: A time-bound price offer for a product at a specific
  store. Includes original price, promotional price, start date, end
  date, status (active/expired), computed discount percentage, and
  verification status. The system computes a "below normal" indicator
  by comparing the promotional price against the product's reference
  (average/typical) price.
- **Store**: A physical supermarket location with name, brand/chain,
  address, geographic coordinates, logo, and associated plan.
- **User**: An end-user consumer with location preferences, search
  history, and a list of favorited products.
- **Supermarket Admin**: A business user associated with one or more
  stores, with permissions to manage promotions and plan billing.
- **Plan**: A subscription tier (Free or Pro) with defined limits on
  promotion count, analytics access, and featured placement.

## Clarifications

### Session 2026-02-10

- Q: What is the consumer app delivery platform? → A: Native mobile app (React Native / Expo) for consumers; Next.js web for the admin panel.
- Q: Should deal cards show enrichment badges and gamification? → A: Yes, full enrichment: discount %, verified badge, below-normal tag, and gamification messages.
- Q: Should the app include an onboarding/landing screen with social proof and dual-audience paths? → A: Yes, full onboarding: social proof stats, testimonials, featured deals preview, and dual CTAs for consumers and supermarket admins.
- Q: What consumer authentication methods should the app support? → A: Google + Apple Sign-In (required by App Store policy when offering social login).
- Q: Should the consumer home screen include quick-filter chips and category tabs for browsing deals? → A: Yes, full browsing: quick-filter chips + category tabs + "Perto de voce" section.
- Q: What scope should the consumer app demo cover? → A: Core demo: onboarding (US0) + search/browse (US1) + map (US2) with mock data. Favorites (US3) as static mockup only. Admin panel (US4/US5) already demo'd on web.
- Q: What is the consumer app's main tab navigation structure? → A: 4 tabs: Home (search/browse), Map, Favorites, Alerts.
- Q: Should the demo use existing admin mock data or a richer dataset? → A: Expand to ~25-30 offers across all categories using the same 4 markets.
- Q: Should the demo map use a real map provider or static images? → A: Real interactive map (react-native-maps) with actual Matao/SP coordinates for the 4 demo stores.

## Assumptions

- Initial product and promotion data is bootstrapped via the existing
  web crawler/scraper. The admin panel enables supermarkets to
  self-serve over time.
- The consumer-facing app is a native mobile app built with React
  Native / Expo, distributed via App Store and Google Play. The
  existing Next.js web app serves exclusively as the supermarket
  admin panel.
- Consumer authentication supports Google Sign-In and Apple Sign-In
  (Apple is mandatory per App Store policy when social login is
  offered). Supermarket admins use email/password authentication
  on the web admin panel.
- Push notifications are delivered via the device's native push
  service (APNs for iOS, FCM for Android).
- The default search radius is 5 km, configurable by the user up to
  a maximum of 50 km.
- Free plan allows up to 10 active promotions per store. Pro plan
  allows unlimited promotions with analytics and featured placement.
- Prices are in Brazilian Real (BRL / R$).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can search for a product and see ranked
  promotional prices from nearby stores in under 2 seconds.
- **SC-002**: 80% of users who search for a product find at least one
  relevant promotion on their first search.
- **SC-003**: Users can identify the nearest store with a deal and
  get navigation directions within 3 taps from the home screen.
- **SC-004**: At least 30% of active users save one or more products
  to their favorites within the first week of usage.
- **SC-005**: Push notification open rate for deal alerts is above 25%.
- **SC-006**: Supermarket admins can create and publish a new
  promotion in under 2 minutes.
- **SC-007**: The map view loads and displays store markers within
  3 seconds on a standard mobile connection.
- **SC-008**: Consumer retention rate (weekly active users returning
  the following week) exceeds 40% after the first month.
- **SC-009**: At least 10 supermarkets sign up and publish promotions
  within the first 3 months of launch.
- **SC-010**: 90% of users rate the app as "easy to use" in
  post-onboarding surveys.
