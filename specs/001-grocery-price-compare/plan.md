# Implementation Plan: Grocery Price Comparison Platform

**Branch**: `001-grocery-price-compare` | **Date**: 2026-02-11 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-grocery-price-compare/spec.md`

## Summary

Build a production-ready grocery price comparison platform with a
dual-role mobile app (Expo/React Native) and an upgraded Next.js admin
panel, backed by Supabase (PostgreSQL + Auth + Realtime + Edge Functions).
The mobile app serves both consumers (search, map, favorites, alerts,
smart shopping lists, optimized routes) and business users (dashboard,
offers CRUD, AI importer, store profile) via role-based routing within
a single published app. Monetization uses Stripe for B2B web
subscriptions and RevenueCat for B2C mobile in-app purchases.

Delivered in two phases mapped to a 3-phase rollout:
- **D1 (Phase 1+2, months 1-6)**: Core marketplace MVP + monetization
  (Free + Premium B2B, Free + Plus B2C, payments, competitive
  intelligence, smart lists, routes, email alerts).
- **D2 (Phase 3, months 7-12)**: Advanced features (Premium+, Family,
  Enterprise, Growth, pricing simulator, AI recommendations, predictive
  analytics, multi-store, real-time push alerts).

## Technical Context

**Language/Version**: TypeScript 5.9 (strict mode)
**Primary Dependencies**:
- Mobile: Expo SDK 54, React Native 0.81, NativeWind v4 (Tailwind CSS 3.4.x), Expo Router v6
- Backend: Supabase (PostgreSQL, Auth, Realtime, Edge Functions, Storage)
- Payments: Stripe (B2B), RevenueCat (B2C)
- Email: Resend (via Supabase Edge Functions)
- Admin: Next.js 16 (App Router), React 19, Tailwind CSS v4
**Storage**: Supabase PostgreSQL with Row Level Security
**Testing**: Jest + React Native Testing Library (mobile), Jest (admin)
**Target Platform**: iOS + Android (Expo/EAS Build), Web (Next.js/Vercel)
**Project Type**: Mobile + Web (dual-frontend, shared Supabase backend)
**Performance Goals**: <2s search results, <3s map load, 60fps animations
**Constraints**: Offline-capable (last-loaded cache), real-time updates, dual-role routing
**Scale/Scope**: 7 plan tiers (4 B2B + 3 B2C), 3 rollout phases, ~21 screens

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Pre-Research Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Type-Safe Clean Code | PASS | TypeScript strict mode, explicit return types, Zod validation |
| II. Testing Discipline | PASS | Tests required for all acceptance scenarios, co-located with features |
| III. User Experience First | PASS | Portuguese (pt-BR), <2s load times, immediate feedback, real GPS |
| IV. Interface Consistency | PASS | NativeWind (mobile) + Tailwind (admin), lucide icons, shared design tokens |
| V. Simplicity & YAGNI | PASS | Supabase eliminates custom backend; direct queries via SDK, no ORM layer |

### Technology Constraints Check

| Constraint | Status | Notes |
|-----------|--------|-------|
| Framework: Next.js App Router | PASS | Admin panel stays Next.js; upgraded in-place |
| Styling: Tailwind CSS | PASS | Admin: Tailwind v4. Mobile: NativeWind v4 (Tailwind 3.4.x — documented amendment) |
| State: Zustand | PASS | Client state for auth, filters, search. Server state via Supabase queries |
| Validation: Zod | PASS | API inputs, form data, webhook payloads |
| AI/LLM: OpenAI SDK | PASS | AI importer continues using existing OpenAI integration |
| Icons: lucide-react / lucide-react-native | PASS | Same icon set across platforms |
| Deployment: Vercel (admin) + EAS (mobile) | PASS | Serverless-compatible; Supabase handles persistent connections |

### Post-Design Re-Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Type-Safe Clean Code | PASS | All Supabase queries typed via generated types. Database functions in SQL. |
| II. Testing Discipline | PASS | Unit tests for hooks, integration tests for Supabase queries (using local Supabase), E2E for auth flows |
| III. User Experience First | PASS | Real GPS, real-time updates, push notifications, native sign-in, offline cache |
| IV. Interface Consistency | PASS | Shared color palette, same icon library, consistent card/sheet patterns |
| V. Simplicity & YAGNI | PASS | No custom API routes for data (Supabase PostgREST), no ORM, no separate backend. Edge Functions only for push notifications, email, and cron |

### New Dependencies Justification

| Dependency | Problem Solved | Existing Alternative? |
|-----------|---------------|----------------------|
| @supabase/supabase-js | Database, auth, realtime client | None — this IS the backend |
| @supabase/ssr | Server-side Supabase in Next.js | None — required for SSR auth |
| stripe | B2B payment processing | None — business requirement |
| @stripe/stripe-js | Client-side Stripe loader | None — required for Checkout |
| react-native-purchases | B2C in-app purchases | None — wraps native IAP SDKs |
| react-native-purchases-ui | Pre-built paywall UI | Could build custom, but YAGNI |
| @react-native-google-signin/google-signin | Native Google Sign-In | expo-auth-session (worse UX) |
| expo-apple-authentication | Native Apple Sign-In | expo-auth-session (worse UX) |
| expo-secure-store | Encrypted token storage | AsyncStorage (not encrypted) |
| expo-notifications | Push notifications | None — business requirement |
| expo-location | Device GPS | None — replaces hardcoded demo location |
| expo-dev-client | Development builds | Required by RevenueCat |
| resend | Transactional email (B2B alerts, trial reminders) | SendGrid (heavier); Resend simpler + TS-native |

## Project Structure

### Documentation (this feature)

```text
specs/001-grocery-price-compare/
├── plan.md              # This file
├── research.md          # Phase 0: technology research
├── data-model.md        # Phase 1: Supabase schema + RLS
├── quickstart.md        # Phase 1: setup guide
├── contracts/           # Phase 1: API contracts
│   └── supabase-api.md  # Supabase query patterns
└── tasks.md             # Phase 2: task breakdown (/speckit.tasks)
```

### Source Code (repository root)

```text
src/                                  # Next.js admin panel (upgrade in-place)
├── app/
│   ├── painel/
│   │   ├── acesso/                  # Login (Supabase Auth replaces cookie mock)
│   │   └── (protected)/
│   │       ├── dashboard/           # Market dashboard (Supabase queries)
│   │       ├── ofertas/             # Offers CRUD (Supabase mutations)
│   │       ├── importador-ia/       # AI importer (existing, unchanged)
│   │       ├── analytics/           # Analytics (Supabase queries)
│   │       ├── plano/               # Plan/billing (Stripe integration)
│   │       └── super/               # Super admin routes (moderation)
│   └── api/
│       └── webhooks/
│           └── stripe/
│               └── route.ts         # NEW: Stripe webhook handler
├── features/
│   ├── auth/
│   │   ├── session.ts               # REWRITE: Supabase session (replaces cookies)
│   │   └── actions.ts               # REWRITE: Supabase Auth actions
│   ├── panel/
│   │   └── components/
│   │       └── panel-shell.tsx      # UPDATE: mobile-responsive layout
│   ├── offers/
│   │   └── offers-store.tsx         # REWRITE: Supabase queries (replaces localStorage)
│   └── shared/
│       ├── types.ts                 # UPDATE: add Supabase-aligned types
│       └── mock-data.ts             # KEEP: development fallback
└── lib/
    ├── supabase-server.ts           # NEW: Supabase SSR client
    └── stripe.ts                    # NEW: Stripe server SDK

mobile/                               # Expo consumer + business app
├── app/
│   ├── _layout.tsx                  # REWRITE: Supabase auth gate + role routing
│   ├── onboarding.tsx               # REWRITE: dual-role auth flow
│   ├── (tabs)/                      # Consumer tab group (existing, updated)
│   │   ├── _layout.tsx              # KEEP: consumer tab navigator
│   │   ├── index.tsx                # REWRITE: Supabase queries
│   │   ├── map.tsx                  # UPDATE: real GPS + Supabase data
│   │   ├── favorites.tsx            # REWRITE: real persistence
│   │   └── alerts.tsx               # REWRITE: real push notifications
│   └── (business)/                  # NEW: business tab group
│       ├── _layout.tsx              # NEW: business tab navigator
│       ├── dashboard.tsx            # NEW: KPIs, revenue, views
│       ├── offers.tsx               # NEW: promotion CRUD
│       ├── importer.tsx             # NEW: AI bulk importer
│       └── profile.tsx              # NEW: store profile management
├── components/
│   ├── paywall.tsx                  # NEW: RevenueCat paywall
│   ├── smart-list.tsx               # NEW: Smart shopping list (Phase 2)
│   └── ... (existing components)
├── hooks/                           # ALL REWRITTEN: Supabase queries
│   ├── use-auth.ts                  # NEW: Supabase auth + role
│   ├── use-promotions.ts            # REWRITE: Supabase query
│   ├── use-stores.ts                # REWRITE: Supabase query
│   ├── use-categories.ts            # REWRITE: Supabase query
│   ├── use-favorites.ts             # NEW: real CRUD
│   ├── use-alerts.ts                # NEW: real CRUD
│   ├── use-location.ts              # REWRITE: expo-location
│   ├── use-search.ts                # REWRITE: Supabase query
│   ├── use-featured-deals.ts        # REWRITE: Supabase query
│   ├── use-social-proof.ts          # REWRITE: Supabase query
│   ├── use-realtime.ts              # NEW: Supabase Realtime
│   ├── use-subscription.ts          # NEW: RevenueCat entitlements
│   ├── use-shopping-list.ts         # NEW: Smart list logic (Phase 2)
│   ├── use-price-history.ts         # NEW: Price graphs (Phase 2)
│   └── use-competitive.ts           # NEW: B2B competitor data (Phase 2)
├── lib/
│   ├── supabase.ts                  # NEW: Supabase client init
│   └── revenue-cat.ts              # NEW: RevenueCat init
├── store/
│   └── app-store.ts                 # REWRITE: Supabase session + role
├── data/                            # KEEP: seed data / dev fallback
└── types/
    └── index.ts                     # UPDATE: Supabase-aligned types

supabase/                             # NEW: Supabase project config
├── config.toml                      # Supabase CLI config
├── migrations/
│   ├── 001_initial_schema.sql       # Tables, RLS policies, functions
│   └── 002_phase2_features.sql      # Shopping lists, price snapshots, competitive
├── functions/
│   ├── notify-favorite-match/
│   │   └── index.ts                 # Push notification trigger
│   ├── expire-promotions/
│   │   └── index.ts                 # Cron: expire old promotions
│   ├── daily-digest/
│   │   └── index.ts                 # Cron: B2B email alerts via Resend
│   └── trial-reminders/
│       └── index.ts                 # Cron: Trial reminder emails via Resend
└── seed.sql                         # Development seed data
```

**Structure Decision**: Dual-frontend architecture with shared Supabase
backend. The admin panel (`src/`) is upgraded in-place (no rewrite).
The mobile app (`mobile/`) is extended with business route group and
Supabase integration. A new `supabase/` directory holds database
migrations, Edge Functions, and seed data. Phase 2 features (smart lists,
competitive intelligence, price snapshots) are built into the same
structure with feature flags or plan-gated access.

## Phase D1.5: Price Intelligence Authority (Weeks 4-6 post-D1)

Strategic pivot to position Poup as the Regional Price Intelligence
Authority. Builds on existing D1 infrastructure (price_snapshots,
daily-price-snapshot, reference_price, competitive intelligence RPCs).

### D1.5 Components

1. **Database Migration** (`supabase/migrations/004_price_intelligence.sql`)
   - New tables: price_indices, price_index_categories, price_index_products, price_quality_flags
   - New RPCs: get_latest_index(), get_price_movers()
   - Public RLS: published indices readable by anon role
   - store_id addition to price_snapshots

2. **Enhanced daily-price-snapshot** (modify existing)
   - Outlier detection (flag prices <30% or >150% of reference)
   - Staleness check (7+ days no data)
   - Extended retention: 365 days for YoY calculation
   - Quality flag insertion

3. **Monthly Price Index Engine** (`supabase/functions/monthly-price-index/`)
   - CPI-like methodology with category-weighted aggregation
   - Data quality scoring (0-100)
   - Auto-publish threshold (>= 70)
   - MoM/YoY change computation

4. **Public Index Page** (`src/app/(public)/indice/`)
   - SSR/RSC for SEO
   - Schema.org structured data (Dataset type)
   - Dynamic OG tags
   - Index hero, 12-month chart, category breakdown, top movers
   - Historical detail pages
   - Institutional layout with clean header/footer

5. **Admin Index Management** (`src/app/painel/(protected)/super/indice/`)
   - View draft/published/archived indices
   - Manual publish/archive controls
   - Data quality score visualization

6. **Admin Data Quality** (`src/app/painel/(protected)/super/qualidade/`)
   - Unresolved quality flags
   - Data coverage metrics
   - Severity breakdown

7. **Landing Page Rebrand** (modify `src/app/page.tsx`)
   - Institutional positioning
   - Three audience CTAs
   - Updated metadata

### D1.5 New Files

| File | Purpose |
|---|---|
| `supabase/migrations/004_price_intelligence.sql` | Index tables, RLS, RPCs |
| `supabase/functions/monthly-price-index/index.ts` | Monthly index calculation |
| `src/app/(public)/layout.tsx` | Institutional public layout |
| `src/app/(public)/indice/page.tsx` | Public index main page |
| `src/app/(public)/indice/[month]/page.tsx` | Historical month detail |
| `src/app/(public)/indice/components/*.tsx` | Index UI components |
| `src/app/painel/(protected)/super/indice/page.tsx` | Admin index management |
| `src/app/painel/(protected)/super/qualidade/page.tsx` | Admin data quality |
| `src/lib/index-calculator.ts` | Shared index utilities |

### D1.5 Modified Files

| File | Changes |
|---|---|
| `supabase/functions/daily-price-snapshot/index.ts` | Outlier detection, staleness, 365-day retention |
| `src/app/page.tsx` | Institutional rebrand |
| `src/app/layout.tsx` | Updated metadata/title |
| `src/features/shared/types.ts` | PriceIndex, QualityFlag types |
| `src/features/panel/components/panel-shell.tsx` | Nav items for index/quality pages |

## Complexity Tracking

> No constitution violations to justify. All new dependencies serve
> explicit business requirements (auth, payments, push notifications,
> email alerts) that cannot be achieved with existing dependencies.
> NativeWind uses Tailwind CSS 3.4.x (not v4) due to React Native
> compatibility — this is a documented platform constraint, not a
> constitution violation.
>
> D1.5 adds zero new external dependencies — it uses only existing
> Supabase, Next.js RSC, and Deno runtime capabilities.
