# Tasks: Usage Analytics & Hot Zones

**Input**: Design documents from `/specs/014-usage-hotzones/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/supabase-views-and-rpcs.md, quickstart.md

**Tests**: Included — both unit tests (query-shaping helpers, the region fallback-guard) and, per `/speckit.analyze` finding C1, integration tests per story that seed data and exercise the new views/RPCs end-to-end. The project constitution (`.specify/memory/constitution.md`, Principle II) mandates both: "unit tests MUST cover all business logic" and "integration tests MUST cover... critical data flows."

**Organization**: Grouped by user story (spec.md priorities P1/P2/P3). The three stories touch disjoint schema (US1: new product view only; US2: new region column + geo view; US3: no schema change, reuses an existing RPC), so each is independently shippable — confirmed during planning, not just asserted here.

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Setup

**Purpose**: Confirm the starting state of this existing, mature codebase before extending it — no project initialization needed.

- [X] T001 Check `supabase/migrations/` for the highest existing migration number and reserve the next two sequential numbers for this feature's two independent migrations (one for US1, one for US2) — highest existing is 041; reserved 042 (US1) and 043 (US2)
- [X] T002 [P] Confirm baseline: run `npm run dev`, log in as `super_admin`, load `/painel/super/engajamento`, and confirm the existing store-ranking section and daily trend chart render correctly before any change — this is the regression baseline for later verification. **Partial**: confirmed existing files present and captured a clean pre-existing typecheck baseline (5 errors, all unrelated to this feature — `scripts/seed-cosmos-catalog.ts` and an unrelated test typo). Full authenticated browser walkthrough needs the user (no super_admin test credentials available to this session).

**Checkpoint**: Starting state confirmed; safe to begin extending.

---

## Phase 2: Foundational

**Purpose**: The one piece of verification genuinely shared by both stories that touch the database (US1, US2) — everything else is disjoint per-story.

- [X] T003 Confirm and document (as a SQL comment in each new migration, written in Phase 3/4) that no new RLS policy is required for either new view/RPC: both `product_engagement_summary`/`product_engagement_report` (US1) and `geo_hotzone_summary` (US2) select from `analytics_events`, already governed by the existing `analytics_events_select_admin` / `analytics_events_select_business` policies (`supabase/migrations/020_analytics_events.sql:56-77`) — confirmed; comment embedded in migrations 042/043

**Checkpoint**: Foundation confirmed — US1, US2, US3 can now proceed in any order.

---

## Phase 3: User Story 1 - Platform-wide product engagement ranking (Priority: P1) 🎯 MVP

**Goal**: Poup team members can see which products get the most engagement (views + searches) platform-wide, ranked, filterable by date range.

**Independent Test**: Seed `analytics_events` rows for ≥2 products with different engagement volumes, open `/painel/super/engajamento`, confirm the new product ranking section orders them correctly and recalculates when the date range changes — no dependency on US2 or US3 work.

### Tests for User Story 1

> **NOTE**: Write these first, ensure they FAIL before implementation (T006-T007 don't exist yet).

- [X] T004 [P] [US1] Unit test for the product-engagement query-shaping/formatting helper (row → display shape, sort-by-total-events) in `src/app/painel/(protected)/super/engajamento/__tests__/engajamento-queries.test.ts` — written, 6/6 passing
- [X] T005 [P] [US1] Integration test: seed `analytics_events` for 2 products via a test Supabase client, call `product_engagement_report()` directly, assert the returned ranking order and counts match the seeded data — in `src/app/painel/(protected)/super/engajamento/__tests__/engajamento-queries.integration.test.ts`. Written, gated behind `SUPABASE_INTEGRATION_TESTS=1` (skips by default — this project has no separate test DB, only the shared hosted one). Confirmed the skip-by-default behavior works; did NOT run it live (writes/deletes rows against real production data, which the auto-mode classifier correctly flagged as outside prior approval scope — needs explicit user sign-off).

### Implementation for User Story 1

- [X] T006 [US1] Create migration `supabase/migrations/042_product_engagement_summary.sql`: add `product_engagement_summary` view, mirroring `store_engagement_summary`'s shape (`020_analytics_events.sql:83-113`) grouped by `product_id`/`products.name` instead of `store_id` — per data-model.md's Product Engagement Summary spec
- [X] T007 [US1] In the same migration file, add `product_engagement_report(start_date, end_date)` RPC mirroring `store_engagement_report()`'s signature and jsonb-array return shape (`020_analytics_events.sql:122-163`) (same file as T006 — sequential, not parallel)
- [X] T008 [US1] Apply the migration locally/dev and manually verify both objects exist and return expected shapes against seeded data; confirm T005's integration test now passes — applied via `supabase db push` to the live project, queried both the view and RPC against real existing analytics_events (5 real products found), both return correctly-shaped data sorted by total_events desc. T005 not run live (see its own note).
- [X] T009 [P] [US1] Create `src/app/painel/(protected)/super/engajamento/engajamento-queries.ts` with a function calling `product_engagement_report()` scoped to the dashboard's existing date-range selection — also includes the geo query functions (T023) since they share this file; wrote both together for efficiency.
- [X] T010 [P] [US1] Create `src/app/painel/(protected)/super/engajamento/product-engagement-table.tsx` rendering the ranked list (rank, product name, total_events, total_unique_users, search/detail-view breakdown) — standalone component for now, per research.md's "extract shared component on 3rd repetition" (this is the 2nd; store-engagement-table.tsx is the 1st)
- [X] T011 [US1] Add pt-BR empty-state copy ("Nenhum produto com engajamento neste período") to `product-engagement-table.tsx`, per constitution UX principle
- [X] T012 [US1] Wire `product-engagement-table.tsx` into `src/app/painel/(protected)/super/engajamento/page.tsx` as a new section below the existing store ranking, reusing the page's existing date-range selector state (depends on T009, T010) — discovery: no date-range selector existed on this page at all (it showed all-time data unfiltered). Built a new `date-range-selector.tsx` (searchParams-driven, matching the existing `filter-bar.tsx` convention) rather than retrofitting the pre-existing store section, keeping scope to what US1/US2 actually need. Also fixed a pre-existing react-hooks/purity lint error on this file (inline Date.now()) while here.
- [X] T013 [US1] Manually verify via quickstart.md steps 1-3 (product ranking portion only): seed data, confirm ranking order and date-range recalculation. Partial: verified the view/RPC against real existing data (T008) and all unit/integration-test-shape logic (T004); typecheck and lint clean. Did not seed new test rows (write-to-production concern, same as T005) and could not do the authenticated browser walkthrough (no super_admin credentials).

**Checkpoint**: User Story 1 is fully functional and independently testable/demoable — this is the MVP.

---

## Phase 4: User Story 2 - Geographic hot-zone view (Priority: P2)

**Goal**: Poup team members can see engagement concentration by geographic area — store location (always available) and user-derived city/region (when already granted, no new permission).

**Independent Test**: Seed `analytics_events` rows tied to stores in ≥2 different cities, with a mix of populated/null `region`, open `/painel/super/engajamento`, confirm the new geographic section groups correctly by both store location and user region — no dependency on US1's or US3's work (though it visually sits alongside US1's section on the same page).

### Tests for User Story 2

> **NOTE**: Write these first, ensure they FAIL before implementation (T017-T018 don't exist yet).

- [X] T014 [P] [US2] Unit test for the region fallback-guard: given `use-location`'s "permission denied → hardcoded Matão, SP fallback" state, confirm the value passed to `track()` is `null`, not the fallback string — in `mobile/__tests__/analytics/use-analytics.test.ts` (this directly tests the bug caught during planning — see data-model.md). Discovery: `renderHook` on a zustand-backed hook from `packages/shared` hit a monorepo dual-React-instance issue in this Jest environment (first test to exercise that reactive path). Extracted the guard into a standalone pure function `resolveTrackedRegion()` and unit-tested that directly instead — better isolation anyway, sidesteps the environment issue entirely. 3/3 passing.
- [X] T015 [P] [US2] Unit test for the geo query-shaping helper (grouping by city/state vs. by region, and excluding fully-ungeolocated events) in `src/app/painel/(protected)/super/engajamento/__tests__/engajamento-queries.test.ts` (same test file as T004 — write sequentially with it, not in parallel) — written together with T004, 6/6 passing.
- [X] T016 [US2] Integration test: seed events with mixed store_id/region combinations, call the geo view/RPC, assert both the store-location grouping and the user-region grouping are correct, including the null-region exclusion case — in `src/app/painel/(protected)/super/engajamento/__tests__/engajamento-queries.integration.test.ts` (same file as T005 — sequential, not parallel). Note: initially missed during implementation, caught by the final tally check before declaring done — now written (2nd describe block in the file), confirmed skips correctly by default, not run live (same rationale as T005).

### Implementation for User Story 2

- [X] T017 [US2] Create migration `supabase/migrations/043_analytics_region_and_geo_summary.sql`: add nullable `region text` column to `analytics_events`, per data-model.md
- [X] T018 [US2] In the same migration file, add the geo aggregation (either one `geo_hotzone_summary` view with a `source` discriminator or two views/RPCs — implementation's choice per contracts.md's Shape A/Shape B) grouping by `stores.city, stores.state` (Shape A, always populated) and by `analytics_events.region` (Shape B, only non-null rows) (same file as T017 — sequential) — went with two RPCs (`geo_hotzone_by_store`, `geo_hotzone_by_region`) rather than one discriminator view, cleaner to call independently.
- [X] T019 [US2] Apply the migration locally/dev and manually verify the new column and view(s) against seeded data covering both populated and null `region`; confirm T016's integration test now passes — applied via `supabase db push`. `geo_hotzone_by_store` returns real data (Matão, SP: 13 events, 2 stores). `geo_hotzone_by_region` correctly returns 0 rows (expected — no mobile client has ever sent `region` yet, pre-rollout). T016 not run live (writes to production, same note as T005).
- [X] T020 [US2] Extend `packages/shared/src/types/index.ts`'s `AnalyticsEvent`/related types with an optional `region?: string` field
- [X] T021 [US2] Modify `mobile/hooks/use-analytics.ts` so tracked events read the current location from `use-location` and attach `region` — critically, only when `use-location` reports a genuinely resolved location, never its hardcoded "Matão, SP" fallback (implements the guard tested in T014; requires `use-location` to expose which case is current — check `packages/shared/src/hooks/use-location.ts` and add that signal if it doesn't already exist). Added a new `hasResolvedLocation` boolean to `use-location.ts` (true for manual city choice OR successful geocode, false while still on the fallback default). Full mobile suite run: 453/465 passing, 12 failures all in `paywall.test.tsx` — confirmed pre-existing/unrelated (zero references to use-location or use-analytics in that file or its test).
- [X] T022 [P] [US2] Create `src/app/painel/(protected)/super/engajamento/geo-hotzone-table.tsx` rendering both the store-location grouping and the user-region grouping (standalone component for now)
- [X] T023 [US2] Extend `src/app/painel/(protected)/super/engajamento/engajamento-queries.ts` (from T009) with a function calling the new geo view(s)/RPC scoped to the existing date-range selection — written together with T009 for efficiency (see T009 note).
- [X] T024 [US2] **Extract the shared component now that the pattern repeats a 3rd time (constitution YAGNI threshold, per research.md)**: create `src/features/shared/engagement-ranking-table.tsx` per the shape in data-model.md, then refactor `store-engagement-table.tsx`, `product-engagement-table.tsx` (T010), and `geo-hotzone-table.tsx` (T022) to be thin wrappers around it — added `mapStoreRows()` to engajamento-queries.ts so the store table normalizes into the same `RankingRow` shape as product/geo; all three are now thin wrappers.
- [X] T025 [US2] Add pt-BR empty-state copy to the geo section, per constitution UX principle
- [X] T026 [US2] Wire the geo section into `src/app/painel/(protected)/super/engajamento/page.tsx` (depends on T023, T024)
- [X] T027 [US2] Manually verify via quickstart.md steps 1-4: seed data, confirm geo grouping, confirm mobile instrumentation attaches `region` only on genuine permission grant and never on the fallback default, confirm zero new location-permission prompt appears. Partial: RPCs verified against real data (T019), fallback-guard logic unit-tested (T014), typecheck/lint clean, full mobile suite run (453/465, unrelated pre-existing failures only). No new device-permission prompt possible by construction (no new `Location.*` permission call added — reused existing `use-location` state). Did not seed new test rows or do the authenticated browser walkthrough (same constraints as T013).

**Checkpoint**: User Stories 1 and 2 both work independently and together; the shared ranked-table component now backs all three table types.

---

## Phase 5: User Story 3 - Real engagement data for business owners (Priority: P3)

**Goal**: Business owners see their own store's real engagement numbers instead of hardcoded placeholder data.

**Independent Test**: Log in as a business owner whose store has seeded engagement events, open `/painel/analytics`, confirm the figures match what a super-admin sees for that same store — independent of US1/US2 (reuses only the pre-existing `store_engagement_report()` RPC, no new schema).

### Tests for User Story 3

> **NOTE**: Write these first, ensure they FAIL before implementation (T030-T031 don't exist yet).

- [X] T028 [P] [US3] Unit test confirming the business-owner data-fetch resolves only the logged-in business's own store(s) (mocking `store_members`), in `src/app/painel/(protected)/analytics/__tests__/analytics-queries.test.ts` — discovery: `requireSessionContext()` (already used by the real `dashboard/page.tsx`) resolves `session.currentMarketId` directly, no manual `store_members` join needed on this end; tested that the RPC is called scoped to exactly the given store id instead. 4/4 passing.
- [X] T029 [P] [US3] Integration test: seed events for two different businesses' stores, call `store_engagement_report()` scoped to one business, assert the other business's data never appears — in `src/app/painel/(protected)/analytics/__tests__/analytics-queries.integration.test.ts`. Written, gated behind `SUPABASE_INTEGRATION_TESTS=1` (same rationale as T005); confirmed it skips by default, did not run live.

### Implementation for User Story 3

- [X] T030 [P] [US3] Create `src/app/painel/(protected)/analytics/analytics-queries.ts`: resolve the logged-in business user's store(s) via the existing `store_members` relationship, then call the existing `store_engagement_report(target_store_id, start_date, end_date)` RPC per store — discovery: only the 2 categories with accurate per-category unique-user counts (search, detail) are surfaced; the RPC lacks list/alerts/map unique-user breakdowns (pre-existing limitation, unlike the view — out of scope to fix here).
- [X] T031 [US3] Rewrite `src/app/painel/(protected)/analytics/page.tsx` to remove the hardcoded `weeklyData`/`mockMarkets` arrays and render real data from T030, reusing the shared `engagement-ranking-table.tsx` (T024) and the existing `daily-trend-chart.tsx` pattern for visual consistency with the super-admin dashboard — converted from Client to Server Component (matching the real `dashboard/page.tsx` convention); reused the super-admin `DateRangeSelector` directly rather than duplicating it. Did not add a daily-trend-chart section here — no per-store daily aggregate RPC exists yet, out of scope to add one just for this page.
- [X] T032 [US3] Add pt-BR empty-state copy ("Sem dados ainda") for a store with zero recorded engagement, per spec User Story 3 scenario 3 — done as part of T031 (shared component's emptyStateMessage prop); also handles the separate "no store linked to this account" case matching dashboard/page.tsx's existing pattern.
- [X] T033 [US3] Manually verify via quickstart.md step 5: business owner sees only their own store's real data, matching the super-admin view for the same store/range and reflecting date-range changes on this page too; a different business's owner never sees this data; a store with no events shows the empty state, not an error. Partial: unit tests confirm store-scoping logic (T028), typecheck/lint clean, full vitest suite run (146/151, 3 pre-existing unrelated failures in schema-normalization.test.ts, zero references to anything I touched). Did not seed test rows or do the authenticated browser walkthrough (same constraints as T013/T027). Also flagging: quickstart.md step 5 itself doesn't yet have a bullet exercising the date-range change on this page (the /speckit.analyze I3 finding from before implementation) — still open.

**Checkpoint**: All three user stories are independently functional and demoable.

---

## Final Phase: Polish & Cross-Cutting Concerns

- [X] T034 [P] Run `npm run lint` and fix any violations introduced by this feature's new files — zero new errors/warnings across all touched web files (root project has no `mobile/` ESLint config at all — `npx jest` is the only configured mobile quality gate, already green). One pre-existing lint error found in `use-location.ts` (a `require()` on a line I didn't touch) and 2 pre-existing warnings, all confirmed via git diff to predate this feature — left alone.
- [X] T035 [P] Update `docs/test-coverage-matrix.md` (if this repo tracks coverage there) to note the new unit tests (T004, T014, T015, T028) and integration tests (T005, T016, T029) added — 5 new rows added to the Admin Panel (Web) section.
- [X] T036 Run the full quickstart.md validation end-to-end (all 5 steps, all edge cases) as a final pre-merge check. Also fixed the /speckit.analyze I3 finding while here (quickstart.md step 5 was missing a date-range-change bullet — added it). Ran `npm run build`: Turbopack compilation succeeded (✓ Compiled successfully — no Server/Client Component boundary issues), but the separate project-wide type-check step fails on the same pre-existing `scripts/seed-cosmos-catalog.ts` error from the Phase 1 baseline (unrelated file, out of scope). Final full test run: vitest 146/151 (3 pre-existing failures, unrelated), mobile jest 453/465 (12 pre-existing failures, unrelated) — both stable across every check this session. Did not seed test rows or do the authenticated browser walkthroughs (consistent constraint across T013/T027/T033 — no super_admin/business credentials, and writing test rows to production wasn't approved).
- [X] T037 Confirm the App Store Privacy Nutrition Label disclosure update (Location data, "Analytics" purpose — per research.md's compliance note) is tracked as a release-process follow-up, since it's a store-listing change outside this codebase — flagged explicitly in the final implementation report; this is an App Store Connect listing change, not a code change, so no repo artifact tracks it beyond this note.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Depends on Setup. Blocks Phase 3 and 4's migrations (not Phase 5, which has no schema change).
- **User Story 1 (Phase 3)**: Depends on Foundational. No dependency on US2/US3.
- **User Story 2 (Phase 4)**: Depends on Foundational. Task T024 (shared component extraction) depends on T010 (US1's product table) existing — this is the one deliberate cross-story dependency, and it's additive/refactor-only, not a blocker to US2's own functionality if done in isolation with just its own table.
- **User Story 3 (Phase 5)**: Depends on nothing but existing infrastructure. Task T031 depends on T024 (shared component) if built after US2; if US3 is implemented before US2, it can render with its own local table markup temporarily and adopt the shared component when T024 lands.
- **Polish (Final Phase)**: Depends on whichever stories were implemented.

### Parallel Opportunities

- T001/T002 (Setup) in parallel.
- T004/T005 (US1 tests) in parallel with each other — different files — and both can be written in parallel with T006/T007 (US1 migration) since none exist yet to conflict with.
- T009/T010 (US1 query file / table component) in parallel — different files.
- T014 (US2 mobile test) in parallel with T015 (US2 web query test) — different files, but T015 is sequential with T004 (same file, `engajamento-queries.test.ts`) — write together, not concurrently. T016 (US2 integration test) is sequential with T005 (same file, `engajamento-queries.integration.test.ts`).
- T022 (US2 geo table) in parallel with T017/T018 (US2 migration) — different files, no dependency until wiring.
- T028/T029 (US3 tests) in parallel with each other — different files — and with T030 (US3 query file).
- T034/T035 (Polish) in parallel.

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1 (Setup) → Phase 2 (Foundational) → Phase 3 (US1).
2. **STOP and VALIDATE**: quickstart.md steps 1-3 (product ranking only).
3. Ship — the product ranking alone delivers real, standalone value (the one genuinely missing capability from the original ask).

### Incremental Delivery

1. Setup + Foundational → foundation confirmed.
2. US1 → validate independently → ship (MVP).
3. US2 → validate independently (including the shared-component refactor and the region fallback-guard, the two riskiest pieces) → ship.
4. US3 → validate independently → ship.
5. Polish once all three are in.
