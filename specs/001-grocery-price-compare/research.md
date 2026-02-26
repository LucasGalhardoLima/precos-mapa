# Research: Grocery Price Comparison — Production Architecture

**Feature**: `001-grocery-price-compare`
**Date**: 2026-02-11

## R1: Backend — Supabase

**Decision**: Supabase (PostgreSQL + Auth + Realtime + Edge Functions
+ Storage)
**Rationale**: Full backend-as-a-service that eliminates the need for
a separate backend framework. PostgreSQL provides relational data
modeling with Row Level Security for access control. Auth supports
Google and Apple Sign-In natively. Realtime enables live promotion
updates. Edge Functions (Deno) handle server-side logic like push
notification triggers. Storage serves store logos and promotional
images.
**Alternatives considered**:
- NestJS + Prisma + PostgreSQL: Full-featured but significantly more
  infrastructure to maintain; overkill when Supabase provides all
  needed primitives out of the box
- Firebase: NoSQL (Firestore) less suitable for relational data
  (products → promotions → stores); weaker SQL query capabilities
- Appwrite: Less mature Realtime and Auth; smaller ecosystem

## R2: Authentication — Supabase Auth + Native SDKs

**Decision**: Supabase Auth with `signInWithIdToken()` using native
Google and Apple SDKs
**Rationale**: Native SDKs provide the best UX (one-tap sign-in,
Face ID/Touch ID integration). Supabase's `signInWithIdToken()`
accepts ID tokens from native providers, bypassing browser-based
OAuth flows that feel foreign on mobile. Apple Sign-In is mandatory
per App Store policy when offering social login.
**Packages**:
- `@supabase/supabase-js` — Supabase client
- `@react-native-google-signin/google-signin` — Native Google Sign-In
- `expo-apple-authentication` — Native Apple Sign-In
- `expo-secure-store` — Encrypted session token storage
**Key patterns**:
- `detectSessionInUrl: false` in Supabase client config (critical for RN)
- User role stored in `profiles` table (not `user_metadata` — users
  can modify metadata; profiles table is RLS-protected)
- Session persisted via expo-secure-store (encrypted, unlike AsyncStorage)
**Gotchas**:
- Apple provides name/email only on FIRST sign-in — must cache immediately
- expo-secure-store has 2KB value limit; JWT tokens fit comfortably
- Google iOS SDK nonce handling must match Supabase expectations

## R3: B2B Payments — Stripe

**Decision**: Stripe for business subscriptions (web admin panel)
**Rationale**: Industry standard for SaaS subscriptions. Supports
free trials, annual billing, customer portal, and webhook lifecycle
management. Next.js Server Actions create Checkout sessions; API
Route Handlers process webhooks.
**Packages**:
- `stripe` — Server-side SDK
- `@stripe/stripe-js` — Client-side loader (for Checkout redirect)
**Key patterns**:
- Server Actions for creating Checkout sessions and portal redirects
- API Route Handler (`app/api/webhooks/stripe/route.ts`) for webhooks
- Webhook body read as `req.text()` (NOT `.json()` — corrupts signature)
- `stripeCustomerId` and `stripeSubscriptionId` stored in Supabase
- Idempotency checks on webhook processing
- Products/Prices configured in Stripe Dashboard, referenced by price ID
**Free trials**: 7 days for all paid tiers, credit card required,
auto-converts to full price, one trial per user (enforced via Stripe
`trial_settings.end_behavior.missing_payment_method: cancel`)
**Annual discount**: 16% — separate annual Price IDs in Stripe
(Premium: R$299/mês → R$3,014/ano; Plus: R$9.90/mês → R$99/ano)
**Launch offer**: 50% off first 3 months via Stripe Coupon, limited
to first 100 customers per tier, auto-renews at full price

## R4: B2C Payments — RevenueCat

**Decision**: RevenueCat wrapping Apple IAP + Google Play Billing
**Rationale**: RevenueCat abstracts platform-specific IAP complexity
into a single SDK. Manages entitlements, subscription status, receipt
validation, and cross-platform consistency. Pre-built paywall UI
via `react-native-purchases-ui` accelerates development.
**Packages**:
- `react-native-purchases` — Core SDK
- `react-native-purchases-ui` — Pre-built paywall components
- `expo-dev-client` — Required (RevenueCat does NOT work in Expo Go)
**Key patterns**:
- Configure with platform-specific API keys at app startup
- `Purchases.logIn(supabaseUserId)` after auth to link RevenueCat
  user to Supabase user
- Check entitlements via `Purchases.getCustomerInfo()`
- Listen for changes via `addCustomerInfoUpdateListener`
**Gotchas**:
- Requires development builds (not Expo Go) for testing
- iOS testing via StoreKit Configuration files or Sandbox accounts
- Android testing via Google Play Console internal testing track
- RevenueCat Preview API Mode provides mock responses in Expo Go
  (UI development only)

## R5: Realtime — Supabase Postgres Changes

**Decision**: Supabase Realtime subscriptions on `promotions` table
**Rationale**: When a business user creates/edits/deletes a promotion,
consumers see the change immediately without manual refresh. Uses
Supabase's built-in Postgres Changes (no additional infrastructure).
**Key patterns**:
- Enable table for realtime: `alter publication supabase_realtime
  add table promotions;`
- Subscribe in React hooks with cleanup on unmount
  (`supabase.removeChannel(channel)`)
- Filter subscriptions by store_id or category for efficiency
**Gotchas**:
- Table must be added to `supabase_realtime` publication explicitly
- Free tier: ~100 concurrent connections (sufficient for D1 launch)
- `old` record only populated if `REPLICA IDENTITY FULL` is set
- Channel names must be unique per client

## R6: Push Notifications — Expo Notifications

**Decision**: Expo Notifications (APNs + FCM) triggered by Supabase
Edge Functions
**Rationale**: Expo Notifications provides a unified API for iOS
(APNs) and Android (FCM). Push tokens are stored in Supabase. When
a new promotion matches a user's favorites, a Supabase Edge Function
sends a push notification via Expo's push service.
**Packages**:
- `expo-notifications` — Push notification handling
- `expo-device` — Device detection (push requires physical device)
- `expo-constants` — Project ID for push token registration
**Key patterns**:
- Register push token on app launch, store in Supabase
  `profiles.push_token` column
- Supabase database trigger on `promotions` INSERT → calls Edge
  Function → queries matching favorites → sends push via Expo API
- `setNotificationHandler` at app startup for foreground behavior
- Deep link from notification tap to specific promotion/product
**Gotchas**:
- Push notifications do NOT work in Expo Go (SDK 53+, Android)
- Physical device required (simulators/emulators cannot receive push)
- Android 13+ requires notification channel before requesting permission
- Push tokens can change — refresh on every app launch

## R7: Dual-Role Routing — Expo Router Protected Routes

**Decision**: Expo Router route groups with `Stack.Protected` guards
**Rationale**: Expo Router (SDK 53+) supports `Stack.Protected` and
`Tabs.Protected` components that conditionally show/hide route groups
based on auth state and user role. Two route groups: `(tabs)/` for
consumers and `(business)/` for business users.
**Key patterns**:
- Root layout checks Supabase session + user role from profiles table
- `Stack.Protected guard={isLoggedIn && isConsumer}` for consumer tabs
- `Stack.Protected guard={isLoggedIn && isBusiness}` for business tabs
- `Stack.Protected guard={!isLoggedIn}` for auth/onboarding screens
- When guard changes, navigation history auto-clears
**Gotchas**:
- `Stack.Protected` / `Tabs.Protected` are SDK 53+ features
- Screen names must be unique across route groups
- Protected routes are client-side only — always enforce via RLS

## R8: Row Level Security (RLS) Patterns

**Decision**: RLS policies for multi-tenant, role-based access
**Rationale**: Supabase RLS provides database-level access control.
Policies enforce that consumers see public data, business users
manage only their stores, and plan limits are respected — even if
client code is compromised.
**Key patterns**:
- Public read: `to anon, authenticated` with `using (status = 'active')`
- Business write: Join through `store_members` table to verify ownership
- Plan checks: `security definer` functions for plan-based feature gating
- Always wrap `auth.uid()` in `(select auth.uid())` for performance
- Index all columns used in RLS policies
- Use `app_metadata` (server-only) for roles, never `user_metadata`
**Gotchas**:
- RLS SELECT failures are silent (return 0 rows, not errors)
- Enable RLS on every table in `public` schema
- Tables not in `supabase_realtime` publication won't fire realtime events

## R9: EAS Build — Production Configuration

**Decision**: EAS Build for iOS + Android production builds
**Rationale**: Expo Application Services (EAS) provides cloud-based
builds, app signing management, and submission to app stores. Avoids
local Xcode/Android Studio build complexity.
**Key patterns**:
- Three build profiles: `development` (dev client), `preview`
  (internal testing), `production` (app store)
- `autoIncrement` for version management
- `appVersionSource: "remote"` prevents version downgrades
- EAS Secrets for API keys and signing credentials
- `expo-dev-client` for development builds (required by RevenueCat)
**Environment variables**:
- `EXPO_PUBLIC_SUPABASE_URL` — Supabase project URL
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` — Supabase anonymous key
- `EXPO_PUBLIC_RC_APPLE_KEY` — RevenueCat Apple API key
- `EXPO_PUBLIC_RC_GOOGLE_KEY` — RevenueCat Google API key
- `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` — Google Maps API key

## R10: Existing Libraries (Carried Forward)

These decisions from the demo phase remain valid for production:

| Decision | Library | Rationale |
|----------|---------|-----------|
| Maps | react-native-maps | Standard, Expo-compatible |
| Styling | NativeWind v4 + Tailwind CSS 3.4.x | Design token consistency with admin |
| Navigation | Expo Router v6 | File-based routing, role-based groups |
| Icons | lucide-react-native | Same as admin panel |
| Bottom Sheet | @gorhom/bottom-sheet v5 | Map detail sheet |
| Animations | react-native-reanimated + moti | Already dependencies |
| State | Zustand v5 | Client-side state (auth, filters, search) |

## R11: Transactional Email — Resend via Edge Functions

**Decision**: Resend for transactional email, invoked from Supabase
Edge Functions
**Rationale**: Resend is a TypeScript-native email API with simple
SDK. Perfect for Supabase Edge Functions (Deno). Handles B2B daily
digest alerts and trial reminder emails. No heavy SMTP config.
**Packages**:
- `resend` — Email API SDK (installed in Edge Functions, not mobile)
**Key patterns**:
- Edge Function `daily-digest/` runs on cron (every morning 8am BRT)
- Queries Premium stores with active promotions
- Generates digest email with competitor price comparisons
- Edge Function `trial-reminders/` runs daily
- Sends reminders at day 3 ("50% do trial usado"), day 5 ("2 dias restantes"),
  day 7 ("Ultimo dia! Assine para nao perder acesso")
- Use Resend domains for `noreply@precomapa.com.br`
- HTML templates with inline styles (email client compat)
**Gotchas**:
- Resend free tier: 100 emails/day, 3,000/month (sufficient for D1)
- Must verify sending domain in Resend dashboard
- Edge Functions cron: use `pg_cron` extension or Supabase Dashboard cron
- Emails should include unsubscribe link (CAN-SPAM/LGPD compliance)
**Alternatives considered**:
- SendGrid: Heavier, more complex API, Java-oriented
- Postmark: Good but more expensive at scale
- SES: Requires AWS infrastructure; overengineered for this scale

## R12: Smart Shopping List Algorithm

**Decision**: Client-side optimization with Supabase data
**Rationale**: Smart shopping lists (Plus feature, D1 Phase 2)
calculate the cheapest store combination for a user's product list.
Algorithm runs client-side with cached promotion data to avoid
expensive server-side computation.
**Algorithm**:
1. User adds products to shopping list
2. Query active promotions for all products in list
3. Group promotions by store
4. For each store, calculate total cost of available items
5. Find optimal combination (greedy: single cheapest store, or
   multi-store if savings exceed a threshold accounting for travel)
6. Display estimated savings vs buying everything at nearest store
**Key patterns**:
- `shopping_lists` table stores user's lists with items
- `shopping_list_items` has product_id + quantity
- Optimization runs in-memory on fetched promotion data
- Recurring lists: save as template, re-use weekly
- Smart substitutions: suggest cheaper brand alternatives
**Gotchas**:
- Multi-store optimization is NP-hard in general; use greedy heuristic
- Cache promotion data aggressively (stale-while-revalidate)
- Limit list size to 50 items to keep computation fast

## R13: Optimized Routes — Google Maps Directions API

**Decision**: Google Maps Directions API for multi-stop route
optimization
**Rationale**: Plus feature (D1 Phase 2). After smart list determines
which stores to visit, calculate optimal driving route between them.
Google Maps Directions API supports waypoint optimization with
`optimizeWaypoints: true`.
**Key patterns**:
- Use `@googlemaps/google-maps-services-js` or direct REST API
- Input: user location + list of store coordinates
- `optimizeWaypoints: true` reorders stops for shortest route
- Display estimated driving time and fuel savings
- Deep link to Google Maps / Apple Maps for turn-by-turn navigation
**Pricing**:
- Directions API: $5 per 1,000 requests (with waypoint optimization)
- Budget: ~1,000 requests/month at D1 scale = ~$5/month
**Gotchas**:
- Maximum 25 waypoints per request (more than enough for grocery trips)
- API key must be restricted to Directions API + Maps SDK
- Rate limit: 50 requests/second per project
- Consider caching route results for identical store combinations
**Alternatives considered**:
- OSRM (Open Source): Free but requires self-hosted infrastructure
- Mapbox: Good alternative, slightly cheaper, but Google Maps already
  in use for map rendering

## R14: Competitive Intelligence Data Patterns

**Decision**: Aggregated competitor price queries via Supabase views
**Rationale**: Premium B2B feature (D1 Phase 2). Stores see how their
prices compare to competitors within a configurable radius (default
5km). Data comes from existing `promotions` table — no scraping needed.
**Key patterns**:
- Supabase view `competitor_prices` joins promotions + stores + products
- Filter by `ST_DWithin(geography, point, radius)` using PostGIS
  (or Haversine function if PostGIS unavailable)
- Aggregate: avg price, min price, max price per product in radius
- Dashboard shows: "Your price vs market average" per product
- Ranking: position of store's price vs competitors (1st, 2nd, etc.)
**Implementation without PostGIS**:
- Use Haversine function in SQL (no extension needed)
- Create materialized view refreshed every 15 minutes for performance
- Index on (product_id, store_id) for efficient joins
**Gotchas**:
- Only shows data from stores ON the platform (not all competitors)
- Refresh frequency: materialized view every 15 min or on-demand
- Privacy: stores see aggregate data, not individual competitor names
  (unless both are Premium+)

## R15: Stripe Coupons — Launch Offer Implementation

**Decision**: Stripe Coupons for 50% off launch offer
**Rationale**: Launch offer gives early adopters 50% off for first
3 months. Stripe Coupons (not Promotion Codes) are applied
programmatically during Checkout session creation.
**Key patterns**:
- Create Stripe Coupon: `percent_off: 50`, `duration: 'repeating'`,
  `duration_in_months: 3`, `max_redemptions: 100`
- Apply coupon in Checkout session: `discounts: [{ coupon: couponId }]`
- Track redemption count in Stripe Dashboard
- After 3 months, subscription auto-renews at full price
- Create separate coupons per tier (Premium vs Premium+) for tracking
**Gotchas**:
- `max_redemptions` is per-coupon, not per-customer — one customer
  can use it once per subscription
- Coupons cannot be modified after creation; create new ones if needed
- Customer Portal shows discount status to subscribers
- Webhook `customer.subscription.updated` fires when discount period ends

## R16: Search Priority by Plan Tier

**Decision**: Plan-based ranking in search results via query ordering
**Rationale**: Free stores appear below paid stores in consumer search
results. This incentivizes B2B upgrades while keeping free tier viable.
**Key patterns**:
- Add `search_priority` column to `stores` table (integer: 0=free, 1=premium, 2=premium+)
- Updated by Stripe webhook when plan changes
- Consumer search query: `.order('search_priority', { ascending: false })`
  followed by `.order(sortBy, { ascending: sortAsc })`
- Premium stores get "Verificado" badge; Premium+ get "Melhor Preco" badge
- Free stores get "Dados basicos" badge (subtle, not punitive)
**Gotchas**:
- Priority ordering must be secondary to user-chosen sort (distance,
  price, expiry) — within each sort bucket, higher priority appears first
- Badge display is client-side based on `store.b2b_plan`
- Index `search_priority` column for query performance

## R17: Monthly Limit Reset Pattern

**Decision**: Count rows with `created_at` in current month (no counters)
**Rationale**: Instead of maintaining a counter column with cron resets,
count actual promotion rows where `created_at` falls in the current
calendar month. This is idempotent, always correct, and requires no
maintenance. The query is fast with an index on `(store_id, created_at)`.
Counter-based approaches risk drift if cron fails, create two sources
of truth, and add reset logic complexity.
**Key patterns**:
- Check function uses `date_trunc('month', now() AT TIME ZONE 'America/Sao_Paulo')`
  to determine month boundaries in BRT
- Index `ix_promotions_store_created` on `(store_id, created_at)` for fast counting
- Client displays "3/5 ofertas usadas este mes" via count query with `head: true`
**Gotchas**:
- Timezone: Use `America/Sao_Paulo` for BRT — month resets at midnight Brasilia time
- `COUNT(*)` with index is fast for small result sets (< 50 rows per store per month)
- No `pg_cron` needed for this feature (unlike daily digest, snapshots)

## R18: Price History Storage

**Decision**: Hybrid — daily `price_snapshots` table + existing promotions
**Rationale**: Plus B2C feature (D1 Phase 2). The `promotions` table
already captures price history implicitly (every promotion has start/end
dates and a price). However, promotions are sparse — not every product
has a promo every day. A daily `price_snapshots` table fills the gaps:
one row per product per day with min/avg promo price and store count.
This provides clean data for line chart graphs and "best time to buy"
indicators.
**Key patterns**:
- `price_snapshots` table: product_id, date, min_promo_price,
  avg_promo_price, store_count, reference_price
- Unique constraint on `(product_id, date)` — upsert-safe
- Daily cron Edge Function queries active promotions, aggregates per
  product, and upserts snapshots
- Client queries last 90 days for line chart
- "Best time to buy" indicator compares current price to historical min/avg
**Storage estimates**:
- 21 products × 365 days = ~7,665 rows/year (very small)
- At scale (1,000 products): ~365,000 rows/year (still manageable)
**Gotchas**:
- 90-day retention for Plus (delete older via scheduled cleanup)
- 180-day retention for Premium+ B2B (D2)
- Use index on `(product_id, date)` for efficient range queries
- Charts rendered client-side (Victory Native or react-native-chart-kit)
- Snapshots only capture days when at least one promotion is active;
  null values in graph indicate "no promotion available"

## Dependency Summary (Production)

| Package | Purpose | Version |
|---------|---------|---------|
| expo | Managed RN framework | ~54 |
| expo-router | File-based navigation | ~6 |
| @supabase/supabase-js | Supabase client | ^2 |
| @react-native-google-signin/google-signin | Google Sign-In | latest |
| expo-apple-authentication | Apple Sign-In | latest |
| expo-secure-store | Encrypted token storage | latest |
| expo-notifications | Push notifications | latest |
| expo-device | Device detection | latest |
| expo-location | GPS location | latest |
| react-native-purchases | RevenueCat core | latest |
| react-native-purchases-ui | RevenueCat paywall | latest |
| expo-dev-client | Development builds | latest |
| react-native-maps | Interactive map | ~1.20 |
| nativewind | Tailwind CSS for RN | ^4 |
| tailwindcss | Utility CSS engine | ~3.4 |
| @gorhom/bottom-sheet | Map detail sheet | ^5 |
| react-native-reanimated | Animation runtime | ~4 |
| moti | Declarative animations | ~0.30 |
| lucide-react-native | Icon library | latest |
| zustand | Client state management | ^5 |
| stripe | Stripe server SDK (admin) | ^15 |
| @stripe/stripe-js | Stripe client loader (admin) | latest |
| resend | Transactional email (Edge Functions) | latest |
| @supabase/ssr | Supabase SSR client (admin) | latest |
