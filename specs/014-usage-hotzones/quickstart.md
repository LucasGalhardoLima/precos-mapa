# Quickstart: Verifying Usage Analytics & Hot Zones

## Prerequisites

- Local `.env.local` with `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` (same as other scripts in this repo)
- The new migration (`supabase/migrations/042_analytics_region_and_product_summary.sql` — exact number/name TBD at implementation time) applied

## 1. Apply the migration

```bash
supabase db push   # or the project's existing migration-apply command
```

Confirm `analytics_events` has the new `region` column and the two new views/RPC exist:

```sql
select column_name from information_schema.columns where table_name = 'analytics_events';
select * from product_engagement_summary limit 1;
select * from geo_hotzone_summary limit 1; -- or the two-view variant, per implementation
```

## 2. Seed representative data

Insert a handful of `analytics_events` rows spanning ≥2 products, ≥2 stores in different cities, and a mix of `region` populated/null, e.g.:

```sql
insert into analytics_events (event_type, user_id, store_id, product_id, region)
values
  ('product_detail_viewed', '<test-user-1>', '<store-matao>', '<product-a>', 'Matão, SP'),
  ('search_result_viewed',  '<test-user-2>', '<store-araraquara>', '<product-a>', null),
  ('product_detail_viewed', '<test-user-1>', '<store-matao>', '<product-b>', 'Matão, SP');
```

## 3. Verify the super-admin dashboard

- Log in as a `super_admin` user, open `/painel/super/engajamento`.
- Confirm the existing store ranking section is unaffected.
- Confirm a new product ranking section shows product-a ranked above product-b (2 events vs 1).
- Confirm a new geographic section shows Matão, SP with 2 events (by store location) and separately shows region-derived rows only for events where `region` was set.
- Change the date-range filter and confirm all three sections (store, product, geo) recompute together.

## 4. Verify the mobile instrumentation

- Run the mobile app locally with location permission granted, perform a product view or search.
- Confirm the resulting `analytics_events` row has `region` populated with the expected city/state.
- Deny/revoke location permission, repeat — confirm the row has `region = null` and nothing else breaks (existing "nearest store" fallback to "Matão, SP" must not leak into `region` as if it were real consent-based data — see Edge Cases below).

## 5. Verify the business-owner page

- Log in as a business user tied to one of the seeded stores.
- Open `/painel/analytics` — confirm it shows the real numbers for that store (matching what the super-admin dashboard shows for the same store/date-range), not the old hardcoded `weeklyData`/`mockMarkets`.
- Change the date-range filter on this page and confirm the figures recalculate.
- Confirm a business user tied to a *different* store never sees the seeded store's data.
- Seed no events for a second business's store and confirm that business sees an empty/zero state, not an error.

## Edge cases to exercise

- A store with no events in the selected range — must not appear (or must appear with explicit zero, per spec) in any ranking, and must not error.
- An event with `store_id = null` and `region = null` (fully ungeolocated) — excluded from the geo view, still counted in product/aggregate views.
- No new location-permission prompt appears for an existing test user who already made a permission choice before this feature shipped.
