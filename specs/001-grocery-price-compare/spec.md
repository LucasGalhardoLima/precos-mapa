# Feature Specification: Grocery Price Comparison Platform

**Feature Branch**: `001-grocery-price-compare`
**Created**: 2026-02-10
**Status**: Draft
**Input**: User description: "Build a mobile app that helps users save money on groceries by comparing promotional prices across different supermarkets."

## Delivery Scope

This specification describes the full production vision. The project is
delivered in three phases:

### Delivery 1 — Core Marketplace + Monetization (Months 1-6)

The first delivery produces a fully functional, app-store-publishable
mobile app with a real backend, working subscriptions, and competitive
intelligence features. Covers Phase 1 (MVP, months 1-3) and Phase 2
(monetization, months 4-6) of the rollout.

**Phase 1 — MVP (months 1-3)**: Free plans only, no payments.
- **US0 - Onboarding & Dual-Role Auth**: Real onboarding flow with
  role selection ("Sou Consumidor" / "Sou Lojista"), Google + Apple
  Sign-In via Supabase Auth, location permission request, and
  role-based routing to the appropriate experience.
- **US1 - Search/Browse**: Product search, filter chips, category tabs,
  enriched deal cards, "Perto de voce" section — all powered by
  Supabase queries and real device GPS.
- **US2 - Map**: Interactive map with store markers, logos, tappable
  bottom sheet with promotion summaries using real store data.
- **US3 - Favorites & Alerts**: Real favorites persisted in Supabase
  (max 10 free), basic alerts (max 3 free).
- **US4 - Admin Panel**: Existing Next.js admin upgraded in-place —
  mock data replaced with Supabase queries, cookie auth replaced with
  Supabase Auth. Mobile-responsive for smartphone browser access.
- **Business Mobile Experience**: Business users access dashboard,
  offers management (manual, up to 5 promotions/month on Free), and
  store profile within the same mobile app via role-based routing.
- **Real-time Updates**: Supabase Realtime channels for live promotion
  updates without manual refresh.

**Phase 2 — Monetization (months 4-6)**: Premium + Plus plans, payments enabled.
- **US5 - B2B Plans/Billing**: Premium plan (R$299/mes) via Stripe
  with 7-day trial (CC required, auto-convert). Unlocks unlimited
  products, Importador IA upload (4/month), competitive intelligence
  (competitor pricing, ranking, dashboard), email alerts (daily
  digest), 90-day history, badges, and higher search priority.
- **US6 - B2C Subscriptions**: Plus plan (R$9.90/mes) via RevenueCat.
  Unlocks unlimited favorites, unlimited alerts, smart shopping lists,
  optimized routes, price history graphs, ad-free experience, and
  90-day history.
- **Stripe Integration**: Checkout, Customer Portal, webhook handlers
  for B2B subscription lifecycle.
- **RevenueCat Integration**: In-app paywall for B2C tier selection
  via Apple IAP / Google Play Billing.
- **Launch offer** ("Early Adopter"): 50% discount for first 3 months.
  Limited to first 100 customers per tier. Auto-renews at full price.
  Premium: R$149.50/mes (saves R$448.50), Premium+: R$399.50/mes
  (saves R$1,198.50). Implemented via Stripe coupon with redemption
  limit.

### Delivery 1.5 — Price Intelligence Authority (Weeks 4-6 post-D1)

Strategic pivot: position PrecoMapa as the **Regional Price Intelligence
Authority** — an independent platform that becomes the reference for
local economic data via the **Indice Regional de Precos do Varejo**.

- **Monthly Price Index Engine**: CPI-like methodology aggregating daily
  snapshots per city, computing category-weighted index (base 100),
  MoM/YoY changes, and data quality score (0-100).
- **Data Quality Pipeline**: Outlier detection (prices <30% or >150% of
  reference), staleness checks (7+ days no data), quality flags for
  admin review, 365-day snapshot retention for YoY calculations.
- **Public Index Page**: SEO-friendly server-rendered page at `/indice`
  with Schema.org structured data, OG tags, institutional design.
  No auth required. Includes index hero, 12-month chart, category
  breakdown, top movers (risers/fallers), historical archive.
- **Admin Index Management**: View/publish/archive draft indices,
  quality score detail, content preview.
- **Admin Data Quality**: Unresolved quality flags, data coverage
  metrics, severity breakdown dashboard.
- **Landing Page Rebrand**: From "demo" to institutional "Inteligencia
  Regional de Precos" with three audience CTAs (consumers, business,
  public data).

### Delivery 2 — Scale + Advanced Intelligence (Months 7-12)

- **Premium+ plan** (R$799/mes): Multi-store (up to 5), real-time push
  alerts, pricing simulator, AI recommendations, predictive analytics,
  12-month history, data export (CSV/Excel/PDF), API/ERP integration,
  premium visibility (homepage banner, "Top Parceiro" badge), priority
  support (WhatsApp, 2h response, account manager).
- **Growth plan** (R$399-449/mes, D2 roadmap): 2 stores, 180-day
  history. Fills the gap between Premium (R$299) and Premium+ (R$799).
  Client-suggested; deferred to validate 2 tiers first. Earliest:
  month 7, requires clear demand signal.
- **Family plan** (R$19.90/mes, B2C): Up to 5 members, shared lists
  with real-time sync, family budget tracking, AI recipe suggestions
  based on promotions, family analytics with gamification.
- **Enterprise plan** (sob consulta, B2B): White-label, dedicated ERP,
  unlimited stores, team training, SLA 99.9%, pricing consultancy.
- Role switching (business users browsing as consumers).

### Dual-role mobile app architecture:

The mobile app is a **single published app** with role-based routing.
Onboarding presents two CTAs: "Sou Consumidor" and "Sou Lojista".
Both trigger OAuth (Google/Apple) but set the user's role, routing to
distinct tab experiences within the same app.

- **Consumer tabs** (bottom tab bar):
  - **Home** (house icon): Search bar + filter chips + category tabs +
    deal feed + "Perto de voce" section. Primary landing tab.
  - **Map** (map-pin icon): Interactive map with store markers and
    bottom sheet promotion summaries.
  - **Favorites** (heart icon): Saved products list with best current
    prices, persisted in Supabase.
  - **Alerts** (bell icon): Push-notification-driven deal alert feed.

- **Business tabs** (bottom tab bar):
  - **Dashboard** (chart icon): KPIs, revenue, store views.
  - **Ofertas** (tag icon): Manage promotions — create, edit, delete.
  - **Importador** (upload icon): AI bulk offer importer.
  - **Perfil** (store icon): Store profile, hours, logo, location.

### Data strategy:

- All data is stored in and queried from Supabase (PostgreSQL).
  Existing mock data files serve as seed data for development.
- Map uses real device GPS (`expo-location`) with react-native-maps
  (Google Maps on Android, Apple Maps on iOS).
- Initial product and promotion data bootstrapped via the existing
  web crawler/scraper. Supermarkets self-serve via the admin panel.
- Real-time promotion updates via Supabase Realtime subscriptions.

## User Scenarios & Testing *(mandatory)*

### User Story 0 - Onboarding and Dual-Role Authentication (Priority: P1)

As a first-time visitor, I want to immediately understand what
PrecoMapa does, see proof that it works (user stats, savings,
testimonials), choose whether I am a consumer or a store owner,
authenticate with my Google or Apple account, and be routed to the
correct experience so I can get started quickly.

**Why this priority**: This is the first screen every user sees. It
must communicate value, build trust, authenticate users, and route
them to the correct role-based experience. Without effective
onboarding and auth, acquisition and activation rates suffer
regardless of how good the core features are.

**Independent Test**: Open the app for the first time. See the
PrecoMapa brand, location context, social proof stats, testimonials,
a preview of featured deals, and two clear entry paths. Tap "Sou
Consumidor", authenticate with Google Sign-In, grant location
permission, and arrive at the consumer home screen. Sign out, reopen,
tap "Sou Lojista", authenticate, and arrive at the business dashboard.

**Acceptance Scenarios**:

1. **Given** a first-time user opens the app, **When** the onboarding
   screen loads, **Then** they see: the PrecoMapa logo and tagline
   ("Compre com inteligencia. Economize com dados."), their detected
   city/region, social proof stats (user count and average monthly
   savings), user testimonials with savings amounts, a preview carousel
   of featured deals, and two CTA buttons — "Sou Consumidor" and "Sou
   Lojista."
2. **Given** a user is on the onboarding screen, **When** they tap
   "Sou Consumidor", **Then** they are presented with Google Sign-In
   and Apple Sign-In options. Upon successful authentication, their
   role is set to "consumer" in Supabase, they are prompted for
   location permission, and they land on the consumer home screen.
3. **Given** a user is on the onboarding screen, **When** they tap
   "Sou Lojista", **Then** they are presented with Google Sign-In
   and Apple Sign-In options. Upon successful authentication, their
   role is set to "business" in Supabase, they complete a store setup
   flow collecting store name, address, city/state, and GPS
   coordinates (auto-detected or via map pin drop), and they land on
   the business dashboard. Logo, phone, hours, and CNPJ can be added
   later from the store profile screen.
4. **Given** a returning authenticated consumer opens the app,
   **When** the app loads, **Then** they skip onboarding and land
   directly on the consumer home screen.
5. **Given** a returning authenticated business user opens the app,
   **When** the app loads, **Then** they skip onboarding and land
   directly on the business dashboard.
6. **Given** a user denies location permission during onboarding,
   **When** they reach the home screen, **Then** they are prompted
   to enter a neighborhood or ZIP code manually.

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

### User Story 4 - Business: Manage Promotions (Dual-Channel) (Priority: P4)

As a supermarket manager, I want to publish and manage my store's
promotional offers through the mobile app or the web admin panel so
that shoppers can discover my deals and visit my store.

**Why this priority**: The supply side of the marketplace. Without
stores publishing promotions, there is no data for consumers. However,
initial data can come from web scraping (existing crawler), making this
a P4 that enables the self-serve pipeline.

**Independent Test**: Log in as a business user on the mobile app.
Create a new promotion for "Coca-Cola 2L" at R$7.99 valid for 7 days.
Verify it appears in the business offers list and becomes visible to
consumers in search results. Repeat via the web admin panel on a
smartphone browser and verify the same functionality works
responsively.

**Acceptance Scenarios**:

1. **Given** a business user logs into the mobile app, **When** the
   business dashboard loads, **Then** they see KPIs (active
   promotions count, monthly promotion usage e.g. "3/5 ofertas",
   plan name and features) and plan usage. (Revenue estimate and
   total views are D2 analytics features — D1 shows plan usage and
   promotion counts only.)
2. **Given** a business user taps "Nova Oferta" in the mobile app,
   **When** they search/select a product from the shared catalog (or
   request a new product entry), fill in original price, promotional
   price, start date, and end date, **Then** the promotion is
   published to Supabase and visible to consumers immediately via
   Realtime.
3. **Given** a business user has active promotions, **When** they edit
   or delete a promotion (mobile or web), **Then** the change reflects
   in consumer-facing results in real-time via Supabase Realtime.
4. **Given** a business user is on the Free plan, **When** they try to
   create more than 5 promotions in a calendar month, **Then** they see
   an upgrade prompt explaining Premium plan benefits and offering a
   7-day free trial.
5. **Given** a business user accesses the web admin panel on a
   smartphone browser, **When** the page loads, **Then** the layout
   is fully responsive with touch-friendly controls.
6. **Given** a business user uses the AI importer in the mobile app,
   **When** they upload a promotional flyer image, **Then** the system
   extracts products and prices via AI and presents them for review
   before publishing.

---

### User Story 5 - Business Plans: 4-Tier B2B Subscriptions (Priority: P5)

As a supermarket owner, I want to choose from a range of plans (Free,
Premium, Premium+, Enterprise) so that I can start publishing
promotions at no cost and upgrade as my needs grow.

**Why this priority**: Monetization is critical but depends on having
an active user base first. The plan system is the business model layer
that sits on top of the admin panel (US4).

**Independent Test**: Register a new supermarket on the Free plan.
Verify plan limits are enforced (10 offers, no AI importer). Upgrade
to Premium via Stripe. Verify AI importer and analytics unlock. Test
annual billing discount.

**Plan Tiers (B2B)**:

| Tier | Price | Promotions | Stores | Importador IA | History | Support |
|------|-------|------------|--------|------------|---------|---------|
| Free | R$0 | 5/month | 1 | No | 7 days | Community |
| Premium | R$299/mes | Unlimited | 1 | 4/month (100 products each) | 90 days | Email |
| Premium+ (D2) | R$799/mes | Unlimited | Up to 5 | Unlimited | 12 months | Priority (WhatsApp, 2h) |
| Enterprise (D2) | Sob consulta | Unlimited | Unlimited | Unlimited | Unlimited | Dedicated |

- Annual billing: 16% discount (Premium: R$3,014/yr, Premium+: R$8,054/yr).
- Free trial: 7 days on all paid plans. Requires credit card. Auto-converts if not canceled. One trial per user.
- Free stores appear below paid stores in search results with "Dados basicos" badge.
- Premium unlocks: competitive intelligence (competitor pricing within 5km, ranking by product/category, competitiveness dashboard), email alerts (daily digest: competitor price drops, 15%+ expensive warnings, best price highlights), badges ("Melhor Preco" on products, "Verificado" on profile), higher search priority.
- Premium+ (D2) adds: pricing simulator, AI recommendations, predictive analytics, real-time push alerts (exclusive), data export (CSV/Excel/PDF), API/ERP integration, homepage banner (1x/week), "Top Parceiro" badge, account manager with monthly strategy calls.
- Monthly limits (promotions, encarte uploads) reset on the 1st of each month.

**Acceptance Scenarios**:

1. **Given** a new supermarket registers, **When** they complete
   onboarding, **Then** they are placed on the Free plan by default
   with clear documentation of included features and limits.
2. **Given** a business user is on the Free plan, **When** they view
   the plan management page, **Then** they see a comparison table
   showing all 4 tiers with features, limits, and pricing.
3. **Given** a business user wants to upgrade to Premium, **When**
   they select the plan, **Then** they are redirected to Stripe
   Checkout with a 7-day free trial (credit card required). The trial
   auto-converts to paid if not canceled. Premium features unlock
   immediately during trial.
4. **Given** a Premium business user, **When** their subscription
   lapses, **Then** they are downgraded to Free after a 7-day grace
   period with clear communication about lost features.
5. **Given** a business user on monthly billing, **When** they switch
   to annual billing, **Then** they receive a 16% discount and the
   change takes effect at the next billing cycle.
6. **Given** a business user wants to manage their subscription,
   **When** they access the billing page, **Then** they can view
   invoices, update payment method, and cancel via Stripe Customer
   Portal.

---

### User Story 6 - Consumer Plans: B2C Subscriptions (Priority: P5)

As a consumer, I want to optionally upgrade to a Plus or Family plan
to unlock premium features like unlimited favorites, more alerts, and
an ad-free experience so I can get the most out of PrecoMapa.

**Why this priority**: B2C monetization diversifies revenue beyond
B2B. It depends on having an engaged consumer base (US1-US3).

**Independent Test**: Use the app as a free consumer. Hit the
10-favorite limit and see an upgrade prompt. Subscribe to Plus via
in-app purchase. Verify unlimited favorites and ad-free experience
unlock immediately.

**Plan Tiers (B2C)**:

| Tier | Price | Favorites | Alerts | Comparison | Ads | Key Features |
|------|-------|-----------|--------|------------|-----|-------------|
| Free | R$0 | 10 | 3 | 5 stores | Placeholder (D1) | Basic search, map, 7-day history |
| Plus | R$9.90/mes | Unlimited | Unlimited | Unlimited | No | Smart shopping lists, optimized routes, price history graphs (30/60/90 days), 90-day history, share lists |
| Family (D2) | R$19.90/mes | Unlimited | Unlimited | Unlimited | No | Plus + 5 members, family budget, AI recipes, family analytics, priority support (chat, 4h) |

- Annual billing: 16% discount (Plus: R$99/yr, Family: R$199/yr).
- Family tier (multi-user, budget, recipes, analytics) is D2 scope.
- Cashback is explicitly NOT included (removed — operational risk, unsustainable at scale, may revisit with partner subsidy model post-launch).
- Smart shopping lists: auto-calculate cheapest store combination, optimization suggestions, estimated savings per list, save recurring lists, smart substitutions.
- Optimized routes: best store visit sequence, time/fuel savings estimates, Google Maps integration.

**Acceptance Scenarios**:

1. **Given** a free consumer, **When** they try to add an 11th
   favorite, **Then** they see a paywall explaining Plus benefits
   with a subscription button.
2. **Given** a free consumer, **When** they try to create a 4th
   alert, **Then** they see a paywall explaining Plus benefits.
3. **Given** a consumer taps "Upgrade to Plus", **When** the paywall
   loads, **Then** it shows Plus and Family tiers with pricing via
   RevenueCat. Purchase flows through Apple IAP or Google Play
   Billing natively.
4. **Given** a Plus consumer, **When** they use the app, **Then**
   ads are hidden, favorites are unlimited, alerts are unlimited,
   price history graphs are available, smart shopping lists are
   accessible, and optimized routes are enabled.
5. **Given** a consumer subscription is active, **When** they check
   subscription status, **Then** RevenueCat reports the correct
   entitlements and expiry date.

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
  The system MUST auto-publish but flag price outliers (>80% discount
  or promo price <R$0.50) as unverified and queue them for super_admin
  review in the moderation panel.
- How does the system handle two supermarkets with overlapping
  geo-coordinates (e.g., same shopping mall)?
  Map markers MUST cluster or offset to remain individually tappable.
- What happens when the user's device loses connectivity while
  browsing promotions?
  The app MUST show the last-loaded results from memory/AsyncStorage
  with a "last updated" timestamp and a retry banner. No background
  sync or local database in D1.

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
- **FR-007**: System MUST enforce plan-based limits on the number
  and features of supermarket promotions per the B2B tier structure.
- **FR-008**: System MUST display all user-facing content in
  Portuguese (pt-BR).
- **FR-009**: System MUST show promotion expiry dates and
  automatically hide expired promotions from consumer results.
- **FR-010**: System MUST cache the most recent query results in
  memory/AsyncStorage and display them with a "last updated" timestamp
  banner when the device is offline. No background sync or local
  database in D1.
- **FR-011**: System MUST allow users to navigate to a store using
  their device's native maps application.
- **FR-012**: System MUST support product search with trigram-based
  fuzzy matching (PostgreSQL `pg_trgm` extension) and synonym
  resolution via a `product_synonyms` table (e.g., "leite moca" →
  "leite condensado", brand names mapped to generic product names).
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
  testimonials, a featured deals preview, and dual-role CTAs
  ("Sou Consumidor" / "Sou Lojista"). Returning authenticated
  users MUST bypass onboarding.
- **FR-019**: System MUST support Supabase Auth with Google Sign-In
  and Apple Sign-In for all users (consumers and business). Session
  tokens MUST be persisted securely on-device via expo-secure-store.
- **FR-020**: System MUST process B2B subscriptions (Premium in D1;
  Premium+, Enterprise in D2) via Stripe Checkout with 7-day free
  trials (credit card required, auto-convert if not canceled, one
  trial per user) and Stripe Customer Portal for self-service billing
  management.
- **FR-021**: System MUST process B2C subscriptions (Plus, Family)
  via Apple IAP and Google Play Billing using RevenueCat SDK. In-app
  paywall MUST present tier options natively.
- **FR-022**: System MUST enforce plan-based limits per the tier
  structure: B2B (Free: 5 promotions/month, 1 store, 3 photos, no AI
  importer, low search priority; Premium: unlimited promotions, 1
  store, 4 encartes/month with 100 products each, 10 photos, 90-day
  history, high search priority). B2C (Free: 10 favorites, 3 alerts,
  5-store comparison, placeholder ad banners; Plus: unlimited
  favorites, unlimited alerts, unlimited comparison, no ads, 90-day
  history). Monthly limits (promotions, encarte uploads) reset on the
  1st of each month.
- **FR-023**: System MUST support annual billing with 16% discount
  for Premium (R$3,014/yr), Premium+ (R$8,054/yr), Plus (R$99/yr),
  and Family (R$199/yr).
- **FR-024**: Mobile app MUST support dual-role login (consumer vs
  business) with role-based routing. After authentication, the app
  checks the user's role and routes to distinct tab experiences:
  consumers to `/(tabs)/` and business users to `/(business)/`.
- **FR-025**: Business users MUST have access to admin panel
  functionality within the mobile app: dashboard (KPIs, revenue,
  views), offers management (CRUD), AI importer (bulk offer upload),
  and store profile management.
- **FR-026**: Next.js admin panel MUST be mobile-responsive for
  smartphone browser access with touch-friendly controls, responsive
  layouts, and appropriate tap target sizes.
- **FR-027**: System MUST display a privacy policy URL accessible from
  onboarding, sign-up, and profile settings. The privacy policy MUST
  describe data collected, purposes, and user rights under LGPD.
- **FR-028**: System MUST capture explicit consent for data processing
  at sign-up (LGPD Art. 7). Consent record (timestamp, version) MUST
  be stored in Supabase.
- **FR-029**: System MUST allow users to delete their account and all
  associated personal data (LGPD Art. 18, App Store / Google Play
  requirement). Deletion MUST remove profile, favorites, alerts, push
  tokens, and disassociate store memberships.
- **FR-030**: System MUST allow users to export their personal data in
  a machine-readable format (JSON) on request (LGPD Art. 18).
- **FR-031**: System MUST auto-publish all promotions immediately but
  flag price outliers (>80% discount or promo price <R$0.50) as
  unverified and add them to the super_admin moderation queue for
  review. Full moderation with store trust scoring is D2 scope.
- **FR-032**: System MUST provide Premium B2B users with competitive
  intelligence: view competitor prices within a 5km radius, ranking
  by product and by category, percentage difference vs cheapest, and
  a competitiveness dashboard. Competitive data is restricted to
  Premium and above plans.
- **FR-033**: System MUST send Premium B2B users a daily digest email
  via Resend (Supabase Edge Function) summarizing: competitor price
  changes on tracked products, products where the user is 15%+ more
  expensive than average, and products where the user has the best
  price. Real-time push alerts are exclusive to Premium+ (D2).
- **FR-034**: System MUST display badges on business profiles and
  products based on plan: "Melhor Preco" on products where the store
  has the lowest price, "Verificado" badge on Premium profiles. Free
  stores display a "Dados basicos" badge and appear below paid stores
  in search results.
- **FR-035**: System MUST provide Plus B2C users with a smart shopping
  list feature: add products, auto-calculate cheapest store
  combination, provide optimization suggestions ("buy X at store A, Y
  at store B"), show estimated savings per list, allow saving recurring
  lists, and suggest smart substitutions.
- **FR-036**: System MUST provide Plus B2C users with optimized
  multi-store routes: best store visit sequence, time and fuel savings
  estimates, with Google Maps integration for navigation.
- **FR-037**: System MUST provide Plus B2C users with price history
  graphs for products (30/60/90-day periods) with trend analysis and
  "best time to buy" indicators.
- **FR-038**: System MUST enforce B2B store limits: Free and Premium
  plans are limited to 1 store (hard limit). Multi-store (up to 5)
  requires Premium+ (D2). Attempting to add a second store on Premium
  shows an upgrade prompt.
- **FR-039**: System MUST send trial reminder emails via Resend at
  day 3 ("Faltam 4 dias"), day 5 ("Faltam 2 dias"), and day 7
  ("Ultimo dia") of the 7-day free trial period. Trials auto-convert
  to paid if not canceled.

### Key Entities

- **Product**: A grocery item in a shared canonical catalog, identified
  by name, category (e.g., Bebidas, Limpeza, Alimentos), and optional
  brand. Category is required and used for browsing tabs. Serves as
  the anchor for promotions and favorites. When creating a promotion,
  business users search/select from existing products or request a new
  entry. Duplicate products are merged by moderators or auto-matching.
- **Promotion**: A time-bound price offer for a product at a specific
  store. Includes original price, promotional price, start date, end
  date, status (active/expired), computed discount percentage, and
  verification status. The system computes a "below normal" indicator
  by comparing the promotional price against the product's reference
  (average/typical) price.
- **Store**: A physical supermarket location with name, brand/chain,
  address, geographic coordinates, logo, and associated plan.
- **User**: A platform user with a role (`consumer` or `business`),
  authenticated via Supabase Auth (Google/Apple Sign-In). Consumers
  have location preferences, search history, favorited products,
  and an optional B2C subscription (Free/Plus/Family). Business
  users are associated with one or more stores.
- **B2B Plan**: A business subscription tier — Free (5 promotions/month,
  1 store, basic metrics, low search priority), Premium (R$299/mes,
  unlimited promotions, 1 store, Importador IA 4/month, competitive
  intelligence, email alerts, 90-day history, badges, high search
  priority), Premium+ (D2, R$799/mes, 5 stores, unlimited AI,
  pricing simulator, AI recommendations, real-time alerts, 12-month
  history, API/ERP, premium visibility), or Enterprise (D2, sob
  consulta, unlimited stores, white-label, dedicated support).
  Managed via Stripe. Annual billing: 16% discount. Trial: 7 days,
  CC required, auto-convert.
- **B2C Plan**: A consumer subscription tier — Free (10 favorites,
  3 alerts, 5-store comparison, placeholder ad banners, 7-day history),
  Plus (R$9.90/mes,
  unlimited favorites/alerts/comparison, no ads, smart shopping lists,
  optimized routes, price history graphs, 90-day history), or Family
  (D2, R$19.90/mes, Plus + 5 members, family budget, AI recipes,
  family analytics). Managed via RevenueCat (Apple IAP / Google Play
  Billing). Annual billing: 16% discount. Cashback explicitly removed
  (operational risk). Family tier is D2 scope.

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

### Session 2026-02-11

- Q: What backend architecture should the production system use? → A: **Supabase** — PostgreSQL + Auth + Realtime + Edge Functions + Storage. No NestJS/Prisma/GraphQL. The existing Next.js admin panel is upgraded in-place: mock data replaced with Supabase queries, cookie auth replaced with Supabase Auth, Stripe billing connected.
- Q: What plan tiers and pricing should the system support? → A: **B2B**: Free (R$0, 5 promotions/month, 1 store), Premium (R$299/mes, unlimited promotions, 1 store, Importador IA 4/month, competitive intelligence, email alerts), Premium+ (R$799/mes, 5 stores, unlimited AI, pricing simulator, real-time alerts, API), Enterprise (sob consulta, unlimited stores, white-label). **B2C**: Free (10 favorites, 3 alerts, 5-store comparison, ads), Plus (R$9.90/mes, unlimited everything, smart lists, routes, no ads), Family (R$19.90/mes, Plus + 5 members, budget, recipes). Annual billing: 16% discount. Trials: 7 days, CC required. Cashback removed.
- Q: How should payment processing work? → A: **Stripe** for B2B web subscriptions (with 7-day free trials, CC required, auto-convert, customer portal). **RevenueCat** for B2C mobile (wrapping Apple IAP + Google Play Billing). No cashback.
- Q: What is the delivery scope? → A: **D1 = Phase 1+2 (months 1-6)**: Phase 1 (MVP): Free plans, registration, search/browse/map/favorites/alerts. Phase 2 (monetization): Premium B2B (competitive intelligence, Importador IA, email alerts, badges), Plus B2C (smart lists, routes, price history, unlimited), Stripe + RevenueCat payments, 7-day trials. **D2 = Phase 3 (months 7-12)**: Premium+, Family, Enterprise, pricing simulator, AI recommendations, predictive analytics, multi-store, real-time alerts.
- Q: Should the admin panel be rewritten or upgraded? → A: **Upgrade in-place** — keep existing Next.js admin UI/routes/components, replace mock data with Supabase queries, swap cookie auth for Supabase Auth, connect Stripe billing. Make it mobile-responsive.
- Q: Should business users have a separate mobile app? → A: **No — single dual-role app**. One published app with role-based routing. Onboarding has "Sou Consumidor" + "Sou Lojista" buttons. Consumer login → consumer tabs. Business login → admin-like dashboard within the same app.
- Q: What level of LGPD / data privacy compliance should D1 include? → A: **Standard** — Privacy policy, consent capture at sign-up, account deletion with data erasure, data export on request (LGPD Art. 18 core rights). Full DPO/audit infrastructure deferred to D2.
- Q: What should the business onboarding store setup flow collect? → A: **Essential** — Store name, address, city/state, and GPS coordinates (auto-detected or map pin drop). Enough to appear on the map and publish promotions. Logo, phone, hours, and CNPJ can be added later from the store profile screen.
- Q: How should product identity/deduplication work across stores? → A: **Shared catalog** — A single canonical product catalog. When creating a promotion, business users search/select from existing products or request a new product entry. Moderators or auto-matching merge duplicates. This ensures clean price comparison across stores.
- Q: Should promotion moderation be in D1, and what triggers it? → A: **Light moderation** — All promotions auto-publish immediately, but price outliers (>80% discount or <R$0.50) are flagged for super_admin review. Flagged promotions still publish but are marked unverified. Full moderation with trust scoring deferred to D2.
- Q: What offline caching strategy should D1 use? → A: **Last-loaded cache** — Keep most recent query results in memory/AsyncStorage. Show stale data with "last updated" banner when offline. No background sync or local SQLite. Full offline-first deferred to D2.
- Q: How does the 3-phase rollout map to D1/D2 delivery? → A: **Phase 1+2 = D1, Phase 3 = D2**. D1 includes Phase 1 (Free-only MVP: registration, store profiles, manual products, search, comparison, map) AND Phase 2 (monetization: Premium + Plus plans, Stripe/RevenueCat payments, Importador IA upload, competitive intelligence, smart shopping lists, optimized routes, email alerts, 7-day trials). D2 is Phase 3 (scale: Premium+, Family, pricing simulator, AI recommendations, multi-store, real-time alerts, API access, predictive analytics). The client wants monetization and business capitalization in the first delivery.
- Q: What is the B2B Free plan limit unit — products per month or active promotions? → A: **Active promotions per month**. Businesses create promotions (which reference products). Free plan: 5 active promotions/month, resets on the 1st. Premium: unlimited. The limit is on promotions, not on product catalog entries.
- Q: What email service should handle B2B alerts (daily digest) and trial reminder emails? → A: **Supabase Edge Functions + Resend**. Simple, TypeScript-native, free tier (100 emails/day). Handles daily digest for Premium B2B (competitor price changes, expensive warnings, best price highlights) and trial reminder emails (day 3, 5, 7).
- Q: What client feedback was incorporated after plan review? → A: **9 points raised, 7 accepted fully (78%), 1 partially (11%), 1 deferred (11%)**. Accepted: margin recalculation (31-58% real), cashback removed, Premium limited to 1 store, real-time alerts Premium+ only, free stores ranked below paid, 7-day trial with CC. Partial: annual discount kept at 16% (client wanted 25%). Deferred: Growth plan (R$399-449, D2). New positioning: "Compre com inteligencia. Economize com dados." Launch offer: 50% off first 3 months, limited to 100 customers/tier.
- Q: What type of ads should Free B2C consumers see in D1? → A: **Placeholder banners** — visual ad space reserved with "Upgrade to remove ads" / Plus upgrade CTAs only. No third-party ad SDK (AdMob) or in-house store promotions in D1. Real ad implementation (type TBD — Google Ads vs in-house store promotions) deferred to D2.

## Assumptions

- **Backend**: Supabase (PostgreSQL + Auth + Realtime + Edge Functions
  + Storage). No separate backend framework (NestJS, Prisma, etc.).
  Row Level Security (RLS) enforces access control at the database
  layer.
- **Authentication**: Supabase Auth with Google Sign-In and Apple
  Sign-In for all users (consumers and business). Apple is mandatory
  per App Store policy when social login is offered. Session tokens
  persisted on-device via expo-secure-store. Users select a role
  (consumer or business) during onboarding, stored in Supabase
  profiles table.
- **Mobile App**: Single published app (React Native / Expo) with
  dual-role architecture — consumers and business users access
  distinct tab experiences within the same app via role-based
  routing. Distributed via App Store and Google Play. Requires
  Apple Developer account and Google Play Console.
- **Admin Panel**: Existing Next.js web app upgraded in-place —
  mock data replaced with Supabase queries, cookie auth replaced
  with Supabase Auth, Stripe billing connected. Must be
  mobile-responsive for smartphone browser access.
- **B2B Payments**: Stripe for business subscriptions. D1: Premium
  only. D2: Premium+, Enterprise. 7-day free trials (CC required,
  auto-convert, one per user). Annual billing: 16% discount. Stripe
  Customer Portal for self-service management. Webhook handlers for
  subscription lifecycle events. Trial reminder notifications at
  day 3, 5, and 7.
- **B2C Payments**: RevenueCat wrapping Apple IAP + Google Play
  Billing for consumer subscriptions. D1: Plus only. D2: Family.
  In-app paywall for tier selection. Annual billing: 16% discount.
  RevenueCat manages entitlements and subscription status. Cashback
  is explicitly NOT included (removed due to operational risk).
- **Push Notifications**: Expo Notifications (APNs for iOS, FCM for
  Android). Push tokens stored in Supabase. Supabase Edge Functions
  trigger notifications when promotions match user favorites.
- **Transactional Email**: Resend (via Supabase Edge Functions).
  Handles B2B daily digest alerts (competitor pricing changes, 15%+
  expensive warnings, best price highlights) and trial reminder
  emails (day 3, 5, 7 notifications). Free tier: 100 emails/day.
- **Real-time Updates**: Supabase Realtime subscriptions on the
  promotions table. Consumer app reflects admin changes (create,
  edit, delete) without manual refresh.
- Initial product and promotion data is bootstrapped via the existing
  web crawler/scraper. The admin panel and mobile business experience
  enable supermarkets to self-serve over time.
- The default search radius is 5 km, configurable by the user up to
  a maximum of 50 km.
- Prices are in Brazilian Real (BRL / R$).
- **Data Privacy (LGPD)**: D1 includes standard compliance — privacy
  policy, consent capture at sign-up, account deletion with full data
  erasure, and data export on request. Full DPO designation, audit
  trails, and anonymization pipelines are D2 scope.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can search for a product and see ranked
  promotional prices from nearby stores in under 2 seconds on a
  standard 4G connection. (Note: Constitution's 1s target applies
  to server-rendered admin panel pages; mobile data queries over
  Supabase have higher baseline latency.)
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

---

## Strategic Positioning (D1.5)

### Authority, Not App

PrecoMapa is not a "price comparison app" — it is a **Regional Price
Intelligence Authority**. The platform becomes the independent reference
for local grocery pricing data, analogous to how the IBGE publishes IPCA
but at regional/city granularity.

### Core Principles

1. **Extremely Reliable Data**: No gross errors, no stale prices. Every
   data point passes outlier detection and staleness checks before
   inclusion in the index.
2. **Public Communication**: The index serves as economic media content.
   Monthly publications are shareable, SEO-optimized, and designed for
   press consumption.
3. **Institutional Positioning**: All public-facing content speaks as
   "plataforma independente de inteligencia de precos" — never as a
   commercial app.
4. **Strategic Neutrality**: The platform cannot appear to favor any
   store. Rankings are based on objective data (promotion count,
   average discount) with transparent methodology.

### B2B Repositioning

The value proposition to stores is not "dashboards" but "strategic
intelligence based on the region's official index." Stores that are
not present in the index are invisible to the local economic narrative.

### B2C Repositioning

The value proposition to consumers is not a "comparator" but "the
trusted source for where to buy best" — backed by data credibility
and the regional index.

### Future Value

Historical data + strong local brand + proprietary data = acquirable
asset for ERP integrations, media groups, and government partnerships.

---

## Functional Requirements — D1.5 (Price Intelligence)

- **FR-040**: The system shall compute a Monthly Regional Price Index
  per city on the 1st of each month using CPI-like methodology
  (category-weighted aggregation of daily price snapshots). The base
  period (first month) has index value 100.
- **FR-041**: The system shall serve a public, SEO-friendly index page
  at `/indice` that requires no authentication and includes Schema.org
  structured data, dynamic OG meta tags, and institutional design.
- **FR-042**: The daily-price-snapshot function shall flag promotions
  with prices <30% of reference_price (outlier_low) or >150% of
  reference_price (outlier_high) and insert records into
  price_quality_flags for admin review.
- **FR-043**: Each monthly index shall include a data quality score
  (0-100) based on product coverage, snapshot density, store
  participation, and category diversity. Indices with score <70
  require manual publish by admin.
- **FR-044**: (D2-A) The system shall auto-generate social content
  cards (monthly inflation summary, top risers/fallers, competitive
  ranking) stored as structured JSONB for admin review and publication.
- **FR-045**: (D2-A) The system shall provide embeddable widgets and
  OG tags that enable press and social media sharing of index data.
