# Feature Specification: Usage Analytics & Hot Zones

**Feature Branch**: `014-usage-hotzones`
**Created**: 2026-07-14
**Status**: Draft
**Input**: User description: "Usage analytics & hot zones: extend the existing analytics pipeline so we can see which supermarkets and products get the most user engagement, and where that engagement is geographically concentrated."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Platform-wide product engagement ranking (Priority: P1)

As a Poup team member, I want to see which products get the most user attention (views, searches) across the whole platform over a selectable time period, so I can understand demand patterns and prioritize catalog, pricing, and partnership decisions.

**Why this priority**: This is the one clearly missing piece of the three things the business asked to understand (stores, products, geography) — store-level engagement ranking already exists today; product-level does not, even though the underlying event data already captures it.

**Independent Test**: Can be fully tested by generating product-view and search events for several products, then confirming the ranking correctly orders products by engagement volume and updates as new events arrive — independent of the geographic or business-owner-facing work in the other stories.

**Acceptance Scenarios**:

1. **Given** several products have recorded views and searches over the last 30 days, **When** a team member opens the product engagement view, **Then** products are ranked from most to least engaged, with a visible count of views/searches and unique users per product.
2. **Given** a product has zero recorded engagement, **When** the ranking is viewed, **Then** that product does not appear (or appears clearly marked as having no activity), and the view does not error.
3. **Given** a team member changes the selected date range, **When** the range is updated, **Then** the ranking recalculates to reflect only engagement within that range.

---

### User Story 2 - Geographic hot-zone view (Priority: P2)

As a Poup team member, I want to see where engagement is geographically concentrated — by store location and, when available, by the general area users were in — so I can identify regions worth prioritizing for new store partnerships or marketing.

**Why this priority**: This directly answers "from where," the geographic dimension of the original ask. It depends on story 1's underlying aggregation patterns but is independently valuable and testable on its own.

**Independent Test**: Can be fully tested by generating engagement events tied to stores in different cities, then confirming the hot-zone view correctly groups and visualizes engagement by geographic area, without needing the business-owner-facing work in story 3.

**Acceptance Scenarios**:

1. **Given** engagement events exist for stores in multiple cities, **When** a team member opens the hot-zone view, **Then** engagement is shown grouped by geographic area (at minimum, by each store's known location), with the highest-engagement areas clearly distinguishable.
2. **Given** a user has previously granted the app permission to determine their general location (already requested today for the "nearest store" feature), **When** that user generates an engagement event, **Then** the event is additionally tagged with the user's general city/region, enriching the hot-zone view beyond store location alone.
3. **Given** a user has never granted location permission, **When** their engagement events are generated, **Then** those events still contribute to the hot-zone view via their associated store's location, and nothing in the app breaks or is degraded for that user.
4. **Given** no new location permission is requested by this feature, **When** the feature ships, **Then** no existing user sees a new permission prompt as a result.

---

### User Story 3 - Real engagement data for business owners (Priority: P3)

As a business owner (store partner), I want to see my own store's real engagement numbers in my dashboard instead of placeholder data, so I can trust and act on the analytics I'm shown.

**Why this priority**: Valuable and currently a known gap (the existing business-facing page shows fixed sample data), but it is a presentation of the same underlying data built in stories 1 and 2, scoped to a single business — lower priority than establishing the platform-wide views first.

**Independent Test**: Can be fully tested by logging in as a business owner with a store that has recorded engagement, and confirming the numbers shown match what a super-admin sees for that same store in the platform-wide view.

**Acceptance Scenarios**:

1. **Given** a business owner's store has recorded engagement events, **When** the business owner opens their analytics page, **Then** the figures shown reflect real events for their store(s), not placeholder data.
2. **Given** a business owner manages more than one store, **When** they view their analytics, **Then** they see data scoped only to the store(s) they own, never another business's data.
3. **Given** a business owner's store has no recorded engagement yet, **When** they open their analytics page, **Then** they see a clear empty/zero state rather than placeholder or misleading numbers.

### Edge Cases

- What happens when a store has no known location (missing address coordinates)? It should still appear in product/store rankings but be excluded from (or clearly marked as excluded from) the geographic hot-zone grouping.
- How does the system handle a user who revokes previously-granted location permission? Future events simply stop carrying a city/region tag; past events are unaffected.
- How does the system handle engagement generated by a logged-out/anonymous visitor? Consistent with today's system, engagement tracking requires a signed-in user; anonymous usage is out of scope for this feature.
- What happens when a product is engaged with across many different stores? Product ranking is platform-wide (not per-store), so its total reflects engagement across all stores.
- How does the system handle a business owner viewing analytics the moment a new event arrives? Near-real-time is not required; existing dashboards refresh on page load, and this feature follows the same expectation.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST rank products by engagement volume (views and searches) over a selectable date range, visible to Poup team members.
- **FR-002**: System MUST show, for each ranked product, the total engagement count and number of distinct users engaging with it in the selected range.
- **FR-003**: System MUST associate every engagement event that has an associated store with that store's existing known geographic location. (Events with no associated store are excluded from store-location grouping, per the geographic hot-zone edge case.)
- **FR-004**: System MUST capture the user's general city/region alongside an engagement event when the user has already granted the location permission used elsewhere in the app for that purpose.
- **FR-005**: System MUST NOT introduce any new location-permission request beyond what the app already requests today.
- **FR-006**: System MUST present a geographic breakdown of engagement to Poup team members, grouped by store location and, where available, by user region.
- **FR-007**: System MUST only record and report location at store-level or city/region-level granularity — never precise per-event device coordinates.
- **FR-008**: System MUST replace the placeholder data on the business-owner-facing analytics page with real figures derived from that business's own store engagement.
- **FR-009**: System MUST restrict a business owner's analytics view to only the store(s) they own.
- **FR-010**: System MUST allow filtering all engagement views (product ranking, hot-zone, business-owner analytics) by a selectable date range, consistent with the existing store engagement dashboard.
- **FR-011**: System MUST document the collection and analytics use of location-derived data in the app's public-facing privacy disclosures.

### Key Entities

- **Engagement Event**: A record of a user interacting with a store or product (already exists). Extended to optionally carry the user's general city/region at the time of the event.
- **Product Engagement Summary**: Aggregated engagement (counts, unique users) per product over a time range — new.
- **Geographic Hot Zone**: Aggregated engagement grouped by geographic area, derived from store location and/or user region — new.
- **Store Engagement Summary**: Aggregated engagement per store over a time range (already exists, unchanged).

## Assumptions

- Anonymous (logged-out) usage remains untracked, consistent with the existing analytics pipeline; extending tracking to anonymous sessions is out of scope.
- The general city/region capture applies uniformly to all existing trackable interactions, not a subset — there's no product reason to treat one event type differently from another for this purpose.
- Existing engagement data has no defined retention limit today; this feature does not change that — data volume/retention policy is a separate concern.
- The existing third-party autocapture analytics tool continues to operate independently for its own purpose (general product usage/UX analysis); it is not the source of truth for the store/product/geographic reporting this feature specifies, which relies on the existing first-party event log.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A Poup team member can identify the top 10 most-engaged products platform-wide within 3 clicks from the admin home.
- **SC-002**: The geographic hot-zone view covers 100% of stores that have at least one recorded engagement event in the selected period, even for stores whose users never granted location permission.
- **SC-003**: Business owners see figures on their analytics page that match, to the same numbers, what a Poup team member sees for that same store in the platform-wide view — zero discrepancy.
- **SC-004**: Shipping this feature results in zero new location-permission prompts shown to existing users.
- **SC-005**: A Poup team member can filter any of the three new/updated views (product ranking, hot-zone, business analytics) to a custom date range and see results reflect that range within the same page load.
