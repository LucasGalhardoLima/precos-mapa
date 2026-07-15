# Phase 1 Data Model: Usage Analytics & Hot Zones

## Entities

### Engagement Event (extends existing `analytics_events`)

Existing columns unchanged: `id`, `event_type`, `user_id`, `store_id`, `product_id`, `metadata jsonb`, `created_at`.

| New column | Type | Nullable | Notes |
|---|---|---|---|
| `region` | `text` | yes | City/state string (e.g. `"Matão, SP"`), matching the format already produced by `packages/shared/src/hooks/use-location.ts`'s reverse-geocode. Populated client-side at tracking time when the user has already granted location permission for the existing "nearest store" feature; `null` otherwise. Never precise coordinates (FR-007). |

**Important implementation constraint carried from research**: `use-location` currently falls back to a hardcoded `"Matao, SP"` when GPS permission is denied or unavailable (existing behavior for the unrelated "nearest store" UX, so the feature still works without permission). The `region` field on `analytics_events` MUST distinguish "permission granted, resolved to city X" from "permission denied, showing the hardcoded fallback" — the latter MUST be persisted as `null`, not as `"Matao, SP"`, or every permission-denying user would silently and incorrectly inflate that one region's numbers. This requires `use-location` (or the tracking call site) to expose *whether* the current city/state came from a real resolved location or the fallback default, not just the string itself.

No new table. No change to existing RLS policies — `region` is just another column on a row already governed by `analytics_events_insert` / `analytics_events_select_admin` / `analytics_events_select_business`.

**Validation**: `region`, when present, MUST be a human-readable "City, State" string, not raw coordinates — enforced at the point it's set (mobile hook), not by a DB constraint, consistent with how `metadata` is already unvalidated JSON at rest.

### Product Engagement Summary (new view: `product_engagement_summary`)

Mirrors `store_engagement_summary`'s shape exactly, grouped by `product_id` instead of `store_id`:

| Column | Source |
|---|---|
| `product_id` | `analytics_events.product_id` |
| `product_name` | joined from `products.name` |
| `search_impressions` / `search_unique_users` | `count(*)` / `count(distinct user_id)` filtered `event_type = 'search_result_viewed'` |
| `detail_views` / `detail_unique_users` | same, filtered `event_type = 'product_detail_viewed'` |
| `total_events` / `total_unique_users` | unfiltered counts |
| `first_event_at` / `last_event_at` | `min`/`max(created_at)` |

Backed by the existing `ix_analytics_product_type (product_id, event_type)` index — no new index required.

A date-range-filtered variant (`product_engagement_report(start_date, end_date)`) mirrors `store_engagement_report()`'s RPC shape for consistency, returning the same jsonb-array-of-rows pattern already used by the admin dashboard.

### Geographic Hot Zone (new view: `geo_hotzone_summary`)

Two data sources, unioned conceptually but computed as two grouped result sets shown together in the UI (not merged into one row, since they answer slightly different questions):

1. **By store location** (always available, zero missing data): group `analytics_events` (joined to `stores`) by `stores.city, stores.state`, same count/unique-user shape as above. This covers every event with a non-null `store_id` — which, per the existing table's own comment, is effectively all of them (store_id is only null for a small number of pre-store-context events like generic screen views).
2. **By user region** (available only when `region` is populated): group by `analytics_events.region` directly, independent of which store (if any) the event was tied to. Surfaces engagement concentration even for events that aren't store-specific, and cross-checks against (1) for stores whose customers are traveling from elsewhere.

**Edge case handling**: A store with `latitude`/`longitude` present but events with no derivable city grouping (shouldn't happen — `city`/`state` are `not null` on `stores`) is a non-issue by construction. If `store_id` is null and `region` is also null (a fully anonymous/ungeolocated event), that event is excluded from the geo view entirely — consistent with the spec's edge case ("excluded from... the geographic hot-zone grouping").

### Store Engagement Summary (existing, unchanged)

`store_engagement_summary` view and `store_engagement_report()` RPC — no changes. Continues to power the existing store ranking section.

## Shared UI shape: ranked engagement table

Three consumers (store, product, geo) now render the same underlying shape: a ranked list of `{ name, total_events, total_unique_users, ...event-type breakdown columns }`, sorted descending by `total_events`, for a selected date range. Proposed shared component (`src/features/shared/engagement-ranking-table.tsx` or co-located under `engajamento/` if it's not reused outside this feature yet — final placement is an implementation detail for `/speckit.tasks`, not this plan):

```text
EngagementRankingTable<T>({
  rows: T[]                        // already-sorted, already-filtered by date range
  rankBy: "total_events"            // sort key, for consistency across the 3 usages
  labelColumn: (row: T) => string   // "store_name" | "product_name" | "region"
  breakdownColumns: Array<{ key: keyof T; label: string }>  // per event-type counts to show
  emptyStateMessage: string         // pt-BR, per constitution's UX principle
})
```

`store-engagement-table.tsx`, the new `product-engagement-table.tsx`, and the new `geo-hotzone-table.tsx` become thin wrappers passing their specific `rows`/`labelColumn`/`breakdownColumns` into this shared component, rather than three parallel full implementations.

## Business-owner analytics page data flow

`src/app/painel/(protected)/analytics/page.tsx` currently renders hardcoded `weeklyData`/`mockMarkets`. Replace with:

1. Resolve the logged-in business user's store(s) via the existing `store_members` relationship (same pattern already used elsewhere in the business dashboard).
2. Call `store_engagement_report(target_store_id, start_date, end_date)` per owned store (existing RPC, existing RLS — a business user's read policy already restricts this to their own store's rows, so no new access-control work is needed).
3. Render with the same `EngagementRankingTable`/trend-chart components used on the super-admin side, so the business owner sees the same shape of data a super-admin would see for their store (spec SC-003: zero discrepancy).
4. Empty state (spec User Story 3, scenario 3): if the RPC returns no rows for the store/range, show a clear "sem dados ainda" (no data yet) message rather than the old mock arrays or a blank page.

## State transitions

None — this feature has no entity with a lifecycle/state machine. Events are append-only; views are computed, not stored state.
