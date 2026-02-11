# Implementation Plan: Grocery Price Comparison — Consumer App Demo

**Branch**: `001-grocery-price-compare` | **Date**: 2026-02-10 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-grocery-price-compare/spec.md`

## Summary

Build a client-facing demo of the PrecoMapa consumer mobile app using
React Native / Expo with mock data. The demo covers three interactive
flows — onboarding with social proof (US0), product search and browse
with enriched deal cards (US1), and an interactive map with store
markers and bottom-sheet promotion summaries (US2) — plus a static
favorites mockup (US3) and alerts placeholder. The existing Next.js
admin panel demo remains unchanged. All data is hardcoded mock data
(~25-30 offers across 4 markets in the Matao/SP region).

## Technical Context

**Language/Version**: TypeScript 5+ (strict mode)
**Primary Dependencies**: Expo SDK 52+, React Native 0.76+, Expo
Router (file-based navigation), react-native-maps, NativeWind v4
(Tailwind CSS for RN), Zustand, lucide-react-native
**Storage**: Mock data in-memory (hardcoded TypeScript modules);
no backend or database for demo
**Testing**: Jest + React Native Testing Library (demo scope: smoke
tests for navigation and component rendering)
**Target Platform**: iOS 16+ and Android 13+ (Expo managed workflow)
**Project Type**: Mobile (Expo) + existing Web (Next.js admin)
**Performance Goals**: 60 fps scrolling, <1s screen transitions,
map renders within 3 seconds
**Constraints**: Demo only — no real backend, no real auth, no push
notifications. All data is hardcoded. Must look production-quality
for client presentation.
**Scale/Scope**: 4 screens (Home, Map, Favorites, Alerts) + onboarding
+ ~25-30 mock offers across 4 markets

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Type-Safe Clean Code | PASS | TypeScript strict mode, ESLint, feature-based file structure in mobile app |
| II. Testing Discipline | PASS (scoped) | Demo ships with smoke tests for navigation and key components. Full test suite deferred to production build. Justified: demo is a presentation artifact, not a shipped product. |
| III. User Experience First | PASS | All UI in pt-BR, immediate visual feedback (loading states, animations), modern design with enriched deal cards |
| IV. Interface Consistency | PASS with adaptation | Constitution specifies Tailwind CSS + lucide-react + framer-motion for the web admin. Mobile app uses NativeWind (Tailwind for RN) + lucide-react-native + Reanimated/Moti for equivalent consistency. Same design tokens. |
| V. Simplicity & YAGNI | PASS | Mock data, no premature abstractions, Expo defaults preferred, minimal dependencies |

**Constitution adaptations for mobile context:**
- Tailwind CSS → NativeWind v4 (same utility classes, compiles to RN StyleSheet)
- lucide-react → lucide-react-native (same icon set, RN-compatible)
- framer-motion → react-native-reanimated + moti (RN animation equivalents)
- Next.js App Router → Expo Router (same file-based routing paradigm)
- Server Components → N/A for mobile; all client-side with mock data

## Project Structure

### Documentation (this feature)

```text
specs/001-grocery-price-compare/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0: technology decisions
├── data-model.md        # Phase 1: entity definitions + mock data schema
├── quickstart.md        # Phase 1: how to run the demo
├── contracts/           # Phase 1: mock data layer interface
│   └── mock-data-api.md
└── checklists/
    └── requirements.md  # Spec quality checklist
```

### Source Code (repository root)

```text
# Existing (unchanged)
src/                         # Next.js admin panel (existing demo)
├── app/                     # Admin routes, API routes
├── features/                # Admin features (panel, offers, auth, etc.)
└── lib/                     # Shared libs (crawler, schemas)

# New: Consumer mobile app
mobile/                      # Expo (React Native) project root
├── app/                     # Expo Router file-based routes
│   ├── _layout.tsx          # Root layout (auth gate + onboarding check)
│   ├── index.tsx            # Redirect: onboarding or tabs
│   ├── onboarding.tsx       # US0: Onboarding screen
│   └── (tabs)/              # Tab navigator group
│       ├── _layout.tsx      # Tab bar configuration (4 tabs)
│       ├── index.tsx        # Home tab (search/browse — US1)
│       ├── map.tsx          # Map tab (US2)
│       ├── favorites.tsx    # Favorites tab (US3 — static mockup)
│       └── alerts.tsx       # Alerts tab (placeholder)
├── components/              # Reusable UI components
│   ├── deal-card.tsx        # Enriched promotion card
│   ├── filter-chips.tsx     # Quick-filter chip row
│   ├── category-tabs.tsx    # Horizontal category tab bar
│   ├── search-bar.tsx       # Product search input
│   ├── store-bottom-sheet.tsx # Map marker detail sheet
│   ├── social-proof.tsx     # Stats + testimonials
│   └── ui/                  # Primitives (button, badge, text, etc.)
├── data/                    # Mock data modules
│   ├── stores.ts            # 4 markets with geo-coordinates
│   ├── products.ts          # Product catalog (~30 items)
│   ├── promotions.ts        # ~25-30 offers with enrichment data
│   ├── testimonials.ts      # Social proof testimonials
│   └── categories.ts        # Category definitions
├── hooks/                   # Custom React hooks
│   ├── use-search.ts        # Search/filter logic over mock data
│   └── use-location.ts      # Simulated location (fixed Matao/SP)
├── store/                   # Zustand stores
│   └── app-store.ts         # Onboarding state, filter state
├── constants/               # Design tokens, gamification messages
│   ├── colors.ts            # Color palette (matching admin panel)
│   ├── animations.ts        # Shared animation configs
│   └── messages.ts          # Gamification text strings
├── types/                   # TypeScript type definitions
│   └── index.ts             # Product, Promotion, Store, etc.
├── app.json                 # Expo config
├── package.json
├── tsconfig.json
├── tailwind.config.ts       # NativeWind config (shared tokens)
└── babel.config.js
```

**Structure Decision**: Mobile + existing Web. The consumer app lives
in `mobile/` as a separate Expo project. The existing Next.js admin
panel in `src/` remains untouched. Both projects share design tokens
(colors, spacing) via aligned Tailwind configurations but do not share
runtime code — keeping the demo self-contained and the admin panel
stable.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| NativeWind instead of Tailwind CSS | React Native does not support CSS directly; NativeWind compiles Tailwind utilities to RN StyleSheet | No simpler alternative exists for Tailwind-in-RN |
| react-native-reanimated instead of framer-motion | framer-motion is web-only; Reanimated is the RN standard | No simpler RN animation library with equivalent capability |
| lucide-react-native instead of lucide-react | lucide-react renders SVG to DOM; RN needs react-native-svg wrappers | Same icon set, different renderer — required by platform |
