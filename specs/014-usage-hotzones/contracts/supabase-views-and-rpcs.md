# Contracts: Supabase Views & RPCs

This project's admin panel queries Supabase directly from Server Components (see `src/app/painel/(protected)/super/dashboard/dashboard-queries.ts` for the existing pattern) rather than through a REST/GraphQL API layer. The contract boundary for this feature is therefore the shape of the new/extended database views and RPCs, not HTTP endpoints.

## `analytics_events` (extended)

No contract change to existing columns. New column:

```
region: text | null
```

Written only by the client (mobile app) at insert time via the existing `analytics_events_insert` RLS policy (`auth.uid() = user_id`) — no new policy needed.

## `product_engagement_summary` (new view)

**Consumers**: super-admin engagement dashboard (product ranking section).

**Shape** (one row per product with ≥1 event, unfiltered by date — the RPC below is the date-filtered variant):

```
product_id: uuid
product_name: text
search_impressions: integer
search_unique_users: integer
detail_views: integer
detail_unique_users: integer
total_events: integer
total_unique_users: integer
first_event_at: timestamptz
last_event_at: timestamptz
```

**Access**: governed by the same RLS as `analytics_events` (super_admin read-all policy applies since this view selects from that table).

## `product_engagement_report(start_date, end_date)` (new RPC)

**Input**:

```
start_date: timestamptz (default now() - interval '30 days')
end_date:   timestamptz (default now())
```

**Output**: `jsonb` array, each element matching `product_engagement_summary`'s row shape, ordered by `total_events desc` — mirrors `store_engagement_report()`'s exact return convention for consistency.

## `geo_hotzone_summary` (new view or two views — implementation detail for `/speckit.tasks`)

**Consumers**: super-admin engagement dashboard (geographic hot-zone section).

**Shape A — by store location** (always populated):

```
city: text
state: text
total_events: integer
total_unique_users: integer
store_count: integer   -- number of distinct stores contributing in this city/state
```

**Shape B — by user region** (only rows where `analytics_events.region` is not null):

```
region: text
total_events: integer
total_unique_users: integer
```

**Access**: super_admin only for this iteration (spec's User Story 2 is scoped to "Poup team members"; no business-owner-facing geo view is in scope).

## `store_engagement_report(target_store_id, start_date, end_date)` (existing, unchanged)

Reused as-is for the business-owner analytics page (spec User Story 3). No contract change — the existing RLS (`analytics_events_select_business`, scoped via `store_members`) already restricts a business user's call to their own store's data when `target_store_id` is one of their own stores; the page passes the business's own resolved store id(s).

## Mobile-side contract: `useAnalytics()` hook

No new exported function. Existing trackers (`track`, `trackSearch`, `trackProductView`, `trackListAdd`, `trackAlertCreated`, `trackMapPinTap`, `trackScreen`) gain one new internal behavior: read the current resolved city/state from `use-location` (already available wherever these trackers are called, since it's a shared app-level hook) and include it as `region` in the inserted row. No change to any call site's public signature — `search.tsx`, `alerts.tsx`, `map.tsx`, `product/[id].tsx` continue calling the trackers exactly as they do today.
