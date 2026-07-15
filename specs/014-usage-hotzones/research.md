# Phase 0 Research: Usage Analytics & Hot Zones

All unknowns from the Technical Context were resolved directly from existing codebase inspection (three research agents already audited this exact area before the spec was written) plus two decisions made directly with the product owner (location depth, spec-kit process). No new external research was required — this is an extension of existing, already-understood infrastructure, not a greenfield technology choice.

## Decision: Geographic view is a ranked table grouped by store city/state, not a map

**Rationale**: `stores` already has non-nullable `city`, `state`, `latitude`, `longitude` for every store (`supabase/migrations/001_initial_schema.sql:37-40`), and the existing `store_engagement_summary` view already joins in `s.city` (`020_analytics_events.sql:87`). A geographic breakdown is therefore already one `group by city, state` away with zero new geographic infrastructure. Introducing an actual map component (web: no existing library; would need something like `react-simple-maps`/Leaflet) is a new dependency the constitution requires justifying (Simplicity & YAGNI), and the existing admin dashboard has no precedent for it — every current chart/table in `/painel/super/engajamento` and `/painel/super/dashboard` is hand-rolled CSS/divs. A ranked table ("Matão, SP — 1,204 events" / "Araraquara, SP — 340 events") delivers the spec's User Story 2 (identify high-engagement regions) without a new dependency.

**Alternatives considered**: A real lat/long-plotted map (rejected for this iteration — no library precedent, real added complexity, not required by any acceptance scenario in the spec, which only asks that "the highest-engagement areas [be] clearly distinguishable," not literally mapped). Can be revisited later as a pure UI enhancement on top of the same aggregation once the underlying data/view exists — the view design below doesn't preclude it.

## Decision: `region` is one new nullable column on `analytics_events`, not a new table

**Rationale**: Matches the existing table's shape exactly (`event_type`, `user_id`, `store_id`, `product_id`, `metadata jsonb` — one row per event). A new column is additive, requires no data backfill (nullable, existing rows simply have `region = null`), and needs no new RLS policy — the three existing policies (`analytics_events_insert`, `analytics_events_select_admin`, `analytics_events_select_business`) already govern the whole row regardless of which columns it has.

**Alternatives considered**: A separate `event_locations` side table (rejected — pure YAGNI violation; there is no independent lifecycle or access pattern for this data that would justify splitting it out, and it would require a join on every query that today needs zero joins beyond the existing `stores` join).

## Decision: Populate `region` client-side from the already-derived location, not via a new geocoding step

**Rationale**: `packages/shared/src/hooks/use-location.ts` already reverse-geocodes device GPS to city/state for the "nearest store" feature (lines 71-156 per earlier audit) and already falls back gracefully when permission is denied. `mobile/hooks/use-analytics.ts` can read that already-resolved value at the moment of tracking and attach it — no new geocoding call, no new permission request (satisfies spec FR-005), and it naturally becomes `null` for exactly the users this hook's existing fallback already treats as "unknown."

**Alternatives considered**: IP-based geolocation server-side (rejected — the device already has a better signal available for free; adding a server-side IP lookup would be strictly worse data for extra complexity). Precise per-event GPS (explicitly rejected in the spec, FR-007 — App Store privacy-label and consent cost outweighs benefit for this use case).

## Decision: `product_engagement_summary` is a new view mirroring `store_engagement_summary`'s shape

**Rationale**: The index this needs already exists and was built for exactly this (`ix_analytics_product_type` on `(product_id, event_type)`, `020_analytics_events.sql:37-39` — comment literally reads "Product-level aggregation"). The existing view is a proven, working template (per-entity counts filtered by `event_type`, plus `total_events`/`total_unique_users`/time-window columns) — reusing its exact shape keeps the two views consistent for anyone reading both, and lets the admin UI reuse one ranked-table rendering component for both (see data-model.md).

**Alternatives considered**: Computing product rankings client-side from raw events, like `dashboard-queries.ts` does for offer analytics (rejected — that pattern fits because offer data is already fetched as a small array for the page; `analytics_events` is not something you want to pull unaggregated into a Server Component for this purpose).

## Decision: Keep PostHog and `analytics_events` as two separate, unreconciled-by-design systems

**Rationale**: PostHog's `autocapture` (`mobile/app/_layout.tsx`) automatically captures generic screen/tap interaction for broad product-usage/UX analysis — a different audience (product/growth) and different question ("where do users get confused/drop off?") than this feature's audience (business/ops: "which stores, products, and regions matter most?"). Forcing them into one system would mean either duplicating first-party business logic (store/product/RLS-scoped access) into PostHog, or routing PostHog's generic autocapture through the bespoke `analytics_events` schema — both cost real engineering for no user-facing benefit this spec asks for. Documented as an explicit assumption in spec.md rather than left ambiguous.

**Alternatives considered**: Migrate everything to PostHog (rejected — would require rebuilding the existing RLS-scoped, store/product-relational reporting that already works, inside a general-purpose product-analytics tool not designed for per-tenant data isolation). Migrate everything to `analytics_events` and remove PostHog (rejected — out of scope; no requirement in this spec calls for touching the autocapture integration, and removing a working integration isn't justified by this feature).

## Decision: Extract a shared ranked-table component once the product view is built (3rd repetition)

**Rationale**: The constitution's YAGNI principle sets the bar at "no abstractions until a pattern repeats at least three times." `store-engagement-table.tsx` is repetition #1. Adding `product-engagement-table.tsx` with the same shape (rank, name, total_events, total_unique_users, per-event-type breakdown) is repetition #2. Adding `geo-hotzone-table.tsx` is repetition #3 — the threshold is met within this feature itself, so the shared component should be extracted as part of this work rather than deferred, to avoid shipping the 3rd copy-pasted table in the same PR that's supposed to apply the principle. See data-model.md for the proposed shared shape.

**Alternatives considered**: Ship three independent table components now, refactor later (rejected — the repetition is visible right now, in this same feature; there's no "hypothetical future need" argument here, which is what YAGNI actually guards against).

## App Store / Privacy compliance (carried into requirements, not re-researched here)

Already resolved in the spec's FR-005/FR-007/FR-011 and confirmed against current Apple policy: first-party in-app analytics (this feature) does not require App Tracking Transparency consent (ATT governs cross-app/cross-company tracking via device identifiers, not a first-party feature like this). No new location permission is requested (reuses the existing foreground grant). The App Store Privacy Nutrition Label does need a disclosure update for "Location" data used for "Analytics" purpose, since persisting a previously-transient value for a new (analytics) purpose is a disclosure event even without a new runtime prompt. As a Brazilian consumer app, LGPD applies: the `region` field should stay at city/state granularity (never precise coordinates, per FR-007) and existing account-deletion cascades (`analytics_events.user_id` already `on delete cascade`) already extend correctly to this new column with no additional work.
