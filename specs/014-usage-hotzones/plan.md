# Implementation Plan: Usage Analytics & Hot Zones

**Branch**: `014-usage-hotzones` | **Date**: 2026-07-14 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/014-usage-hotzones/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Extend the existing `analytics_events` pipeline (already tracking store/product interactions) with two missing dimensions the business asked for: a platform-wide **product engagement ranking** and a **geographic hot-zone view** (store location, always available, plus the user's already-derived coarse city/region when granted — no new permission). Reuse the existing `store_engagement_summary` view as the template for a new `product_engagement_summary` view and a geo-grouped aggregation, extend the existing admin dashboard (`/painel/super/engajamento`) rather than building new pages from scratch, and wire the currently-mocked business-owner analytics page to the same real data (already RLS-scoped correctly for that purpose).

## Technical Context

**Language/Version**: TypeScript 5.9 (strict mode) across mobile (React Native) and admin (Next.js)
**Primary Dependencies**: Next.js 16 (App Router) + React 19 for the admin panel; Expo SDK 54 / React Native 0.81 / Expo Router v6 for mobile; `@supabase/supabase-js` (existing client) for all data access; Zod for any new input validation; Zustand only if new client state is genuinely needed (not expected — this is server-data-driven)
**Storage**: Supabase PostgreSQL — extends the existing `analytics_events` table (adds a nullable `region` column) and adds two new views/RPCs (`product_engagement_summary`, a geo-grouped view/RPC) alongside the existing `store_engagement_summary`
**Testing**: Vitest (existing `npm test`) for any new pure aggregation/formatting helpers; existing Maestro e2e flow conventions (`mobile/__tests__/e2e/*.yaml`) if a new mobile-visible flow needs coverage — this feature is primarily admin-panel + backend, so unit coverage on query-shaping helpers is the main testing surface, matching how `dashboard-queries.ts` is tested today
**Target Platform**: Web admin panel (Vercel serverless, existing `/painel/super/**` and `/painel/**` business routes) for the two new views; iOS/Android (Expo) for the one small instrumentation change (persisting `region` alongside existing tracked events)
**Project Type**: Extension within the existing web (`src/`) + mobile (`mobile/`) + backend (`supabase/`) structure — not a new project type
**Performance Goals**: Consistent with existing admin dashboards — meaningful content within ~1s per the constitution's UX principle; aggregation queries should return well under that on current data volume (tens of thousands of events, ~26k products) without needing a separate analytics warehouse
**Constraints**: No new location-permission prompt (FR-005); location/geography must never be recorded at precise per-event device-coordinate granularity, only store-level or city/region-level (FR-007); business-owner views must only ever return that business's own store(s) — enforced via the same RLS pattern already used for the existing `store_engagement_summary`/`store_engagement_report()`; Vercel serverless constraints (stateless API routes / Server Components, no persistent connections)
**Scale/Scope**: Current `products` catalog ~25,722 rows, `analytics_events` growing continuously at existing app-usage volume — no scale concern requiring new infrastructure at this stage

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Type-Safe Clean Code** — PASS. All new query helpers, hook changes, and admin components are TypeScript strict, explicit return types, no `any`. New logic co-located by feature (`src/app/painel/(protected)/super/engajamento/`, `src/app/painel/(protected)/analytics/`, `mobile/hooks/use-analytics.ts`).
- **II. Testing Discipline** — PASS. New pure aggregation/query-shaping helpers get unit tests (mirroring `dashboard-queries.ts` coverage), AND the constitution's "integration tests MUST cover... critical data flows" clause is satisfied by dedicated integration tests per story that seed data and exercise the new views/RPCs end-to-end (not just manual quickstart verification) — see tasks.md.
- **III. User Experience First** — PASS. All new admin copy in pt-BR; empty/zero states specified (spec edge cases, User Story 3 scenario 3); no change to page-load performance expectations.
- **IV. Interface Consistency** — PASS, with an explicit decision: introduce **no new charting or mapping library**. The existing `/painel/super/engajamento` dashboard is hand-rolled (CSS/divs, no chart lib — confirmed no recharts/chart.js/d3 in `package.json`); the new product-ranking and geo-hotzone views extend that same visual language (KPI cards, ranked table, existing `daily-trend-chart.tsx` pattern) instead of introducing a map component. This is a genuine 3rd repeated pattern (store ranking → product ranking → geo ranking), which is exactly the constitution's "pattern repeats at least three times" threshold for extracting a shared ranked-table component — see data-model.md.
- **V. Simplicity & YAGNI** — PASS. No new dependency introduced. Reuses the existing `analytics_events` table (one additive nullable column, not a new table) and the existing RLS model rather than inventing a parallel permissions scheme.
- **Technology constraints** — PASS. Stays within Next.js App Router / Supabase / Zod stack; no new AI/scraping/image dependency implicated by this feature.

No violations requiring Complexity Tracking justification.

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
supabase/
└── migrations/
    ├── 042_product_engagement_summary.sql            # new: product view + RPC (US1 — no region column)
    └── 043_analytics_region_and_geo_summary.sql       # new: region column + geo view (US2)

src/
├── app/painel/(protected)/
│   ├── super/
│   │   ├── engajamento/
│   │   │   ├── page.tsx                     # extend: add product ranking + geo sections
│   │   │   ├── store-engagement-table.tsx    # existing — becomes the template
│   │   │   ├── product-engagement-table.tsx  # new
│   │   │   ├── geo-hotzone-table.tsx         # new
│   │   │   ├── daily-trend-chart.tsx         # existing, unchanged
│   │   │   └── engajamento-queries.ts        # new — mirrors
│   │   │                                     # src/app/painel/(protected)/super/dashboard/dashboard-queries.ts
│   └── analytics/
│       └── page.tsx                          # rewrite: replace mock weeklyData/mockMarkets with
│                                              # real queries scoped to the business's own store(s)
└── features/shared/                          # candidate home for a shared ranked-table component if
                                                # store/product/geo tables converge on one implementation

mobile/
└── hooks/
    └── use-analytics.ts                      # extend: attach region (from existing use-location
                                                # city/state) to tracked events when available

packages/shared/src/
├── hooks/use-location.ts                     # existing, unchanged — already derives city/state
└── types/index.ts                            # extend AnalyticsEvent/AnalyticsEventType if needed
```

**Structure Decision**: This is an extension of the existing three areas (`supabase/migrations`, `src/app/painel/**`, `mobile/hooks`), not a new project or new top-level structure. No `frontend/`/`backend/` split applies — the repo's existing `src/` (Next.js admin) + `mobile/` (Expo) + `supabase/` (backend) layout is used as-is. The one new architectural question — a shared ranked-table component once store/product/geo all repeat the same shape — is deferred to `data-model.md`, not decided here.

## Constitution Check (post-Phase 1 re-check)

Re-evaluated after `research.md` and `data-model.md`: still PASS on all principles. Two Phase-1 decisions specifically *strengthen* compliance rather than introduce risk:

- The shared `EngagementRankingTable` component (data-model.md) directly satisfies the constitution's "no abstractions until a pattern repeats three times" bar — it's introduced exactly when that threshold is met (store, product, geo), not before and not left un-extracted after.
- The `region` fallback-vs-null distinction (data-model.md) prevents a real data-integrity/privacy correctness bug (misattributing denied-permission users to a hardcoded city) from shipping — this was caught during design, not left for review to catch.

No new Complexity Tracking entries required.

## Complexity Tracking

No constitution violations — this section is not applicable.
