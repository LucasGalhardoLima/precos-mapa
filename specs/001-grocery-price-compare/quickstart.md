# Quickstart: PrecoMapa — Production Setup

**Feature**: `001-grocery-price-compare`
**Date**: 2026-02-11

## Prerequisites

- Node.js 18+ (LTS)
- npm
- Expo CLI: `npx expo` (no global install needed)
- EAS CLI: `npm install -g eas-cli`
- Supabase CLI: `npm install -g supabase`
- Stripe CLI: `npm install -g stripe` (for webhook testing)
- Resend account (create at https://resend.com) — for transactional email
- iOS Simulator (macOS) or Android Emulator
- Physical device for push notification testing
- Supabase project (create at https://supabase.com)
- Stripe account (create at https://stripe.com)
- RevenueCat account (create at https://revenuecat.com)
- Google Cloud project (for Maps API + Google Sign-In)
- Apple Developer account (for Apple Sign-In + App Store)

## 1. Environment Setup

### Supabase

```bash
# Start local Supabase (for development)
supabase init
supabase start

# Or connect to remote project
supabase link --project-ref YOUR_PROJECT_REF
```

Create a `.env.local` file in the project root (for admin panel):

```env
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-local-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-local-service-role-key
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
RESEND_API_KEY=re_...
```

Create a `.env` file in `mobile/` (for the mobile app):

```env
EXPO_PUBLIC_SUPABASE_URL=http://localhost:54321
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-local-anon-key
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=your-google-maps-key
EXPO_PUBLIC_RC_APPLE_KEY=appl_...
EXPO_PUBLIC_RC_GOOGLE_KEY=goog_...
```

### Database Schema

```bash
# Apply migrations (creates all tables, RLS policies, functions)
supabase db push

# Seed development data
supabase db seed
```

### Stripe Products

Create products and prices in Stripe Dashboard (test mode):

**D1 Products:**
1. **Premium (B2B)** — R$299/month, R$3,014/year (16% discount)

**D2 Products (create later):**
2. **Premium+ (B2B)** — R$799/month, R$8,054/year (16% discount)
3. **Growth (B2B)** — R$399-449/month (pricing TBD at D2 launch)

Note the `price_id` values for each.

**Launch Offer Coupons:**
- Create coupon: 50% off, repeating, 3 months, max 100 redemptions (Premium)
- Create coupon: 50% off, repeating, 3 months, max 100 redemptions (Premium+, D2)

**B2C (RevenueCat, not Stripe):**
- Plus: R$9.90/month, R$99/year (16% discount) — configured in App Store Connect / Google Play Console
- Family (D2): R$19.90/month, R$199/year (16% discount)

**Trial Settings:**
- All paid tiers: 7-day free trial, credit card required, auto-converts
- One trial per user (enforce via Stripe `trial_settings`)

### RevenueCat

1. Create products in App Store Connect and Google Play Console:
   - Plus: R$9.90/month, R$99/year (16% discount)
   - Family (D2): R$19.90/month, R$199/year (16% discount)
2. Configure RevenueCat project with Apple and Google API keys
3. Create entitlements: `plus` (D1), `family` (D2)
4. Create offerings with the products
5. Configure 7-day free trial in App Store Connect / Play Console

## 2. Mobile App Setup

```bash
cd mobile

# Install dependencies
npm install --legacy-peer-deps

# Install new production dependencies
npx expo install @supabase/supabase-js expo-secure-store \
  expo-apple-authentication expo-location expo-notifications \
  expo-device expo-constants expo-dev-client \
  react-native-purchases react-native-purchases-ui
npm install @react-native-google-signin/google-signin --legacy-peer-deps

# Start development build (required for RevenueCat + native auth)
npx expo run:ios
# or
npx expo run:android
```

## 3. Admin Panel Setup

```bash
# From repository root
npm install

# Install new production dependencies
npm install stripe @stripe/stripe-js @supabase/supabase-js @supabase/ssr

# Start dev server
npm run dev
```

## 4. Running the App

### Mobile App (Development Build)

```bash
cd mobile
npx expo run:ios     # iOS
npx expo run:android # Android
```

**Note**: Expo Go is NOT supported for production features
(RevenueCat, native auth). Always use development builds.

### Admin Panel

```bash
npm run dev
# Open http://localhost:3000/painel/acesso
```

### Stripe Webhook Listener (Local)

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

## 5. Demo Walkthrough (Production)

1. **Onboarding**: Open the mobile app. See social proof and two
   role CTAs.

2. **Consumer Sign-In**: Tap "Sou Consumidor" → Google or Apple
   Sign-In → grant location permission → land on consumer home.

3. **Search & Browse**: Real promotions from Supabase. Filter by
   category, sort by price/distance/expiry.

4. **Map**: Real GPS location + store markers from Supabase data.
   Tap markers for bottom sheet with live promotions.

5. **Favorites**: Tap hearts on promotions to save. Persisted in
   Supabase. Free tier limited to 10.

6. **Alerts**: Set price alerts on favorited products. Receive push
   notifications when new promotions match.

7. **Business Sign-In**: Sign out → reopen → tap "Sou Lojista" →
   authenticate → land on business dashboard.

8. **Business Dashboard**: See KPIs, manage promotions (CRUD), use
   AI importer, edit store profile.

9. **Admin Panel (Web)**: Open on smartphone browser. Verify
   responsive layout, touch-friendly controls.

10. **Subscription**: As consumer, hit favorite limit → see paywall
    → subscribe via RevenueCat. As business, upgrade to Premium via
    Stripe Checkout.

## 6. Project Structure (Production)

```
precos-mapa/
├── src/                          # Next.js admin panel
│   ├── app/
│   │   ├── painel/              # Admin routes
│   │   └── api/
│   │       └── webhooks/
│   │           └── stripe/      # Stripe webhook handler
│   ├── features/
│   │   ├── auth/                # Supabase Auth (replaces cookie auth)
│   │   ├── panel/               # Panel shell (mobile-responsive)
│   │   ├── offers/              # Offers store (Supabase queries)
│   │   └── shared/              # Types, formatters
│   └── lib/
│       ├── supabase-server.ts   # Supabase SSR client
│       └── stripe.ts            # Stripe server SDK
│
├── mobile/                       # Expo consumer + business app
│   ├── app/
│   │   ├── _layout.tsx          # Auth gate + role routing
│   │   ├── onboarding.tsx       # Dual-role auth flow
│   │   ├── (tabs)/              # Consumer tab group
│   │   └── (business)/          # Business tab group
│   ├── components/
│   │   └── paywall.tsx          # RevenueCat paywall
│   ├── hooks/                   # Supabase query hooks
│   ├── lib/
│   │   ├── supabase.ts          # Supabase client
│   │   └── revenue-cat.ts       # RevenueCat initialization
│   ├── store/                   # Zustand (auth, filters)
│   └── data/                    # Seed data (dev fallback)
│
├── supabase/
│   ├── migrations/              # Database schema migrations
│   ├── functions/               # Edge Functions
│   │   ├── notify-favorite-match/
│   │   └── expire-promotions/
│   └── seed.sql                 # Development seed data
│
└── specs/001-grocery-price-compare/
    ├── spec.md
    ├── plan.md
    ├── research.md
    ├── data-model.md
    ├── quickstart.md
    └── contracts/
```

## 7. EAS Build (Production)

```bash
cd mobile

# Configure EAS
eas build:configure

# Build for internal testing
eas build --platform all --profile preview

# Build for app store submission
eas build --platform all --profile production

# Submit to app stores
eas submit --platform ios
eas submit --platform android
```

## Troubleshooting

- **RevenueCat not working**: Must use development build, not Expo Go
- **Auth not persisting**: Check `detectSessionInUrl: false` in
  Supabase config
- **RLS blocking queries**: Check RLS policies with
  `supabase.auth.getSession()` — ensure user is authenticated
- **Map not loading on Android**: Set Google Maps API key in
  `app.json` and use development build
- **Push notifications not received**: Physical device required;
  check push token stored in Supabase
- **Stripe webhooks failing**: Run `stripe listen` for local dev;
  check webhook signing secret
- **NativeWind styles not applying**: Run `npx expo start --clear`
