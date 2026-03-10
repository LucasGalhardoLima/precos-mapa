# Comprehensive Test Coverage — Design

**Goal:** Achieve full test pyramid coverage (unit + integration + E2E) for every user flow scenario in the Poup mobile app, ensuring the best possible user experience.

**Approach:** Bottom-up pyramid (A). Start with hook unit tests (fast, high ROI), then component integration tests with RNTL, then E2E flows with Maestro.

**Note:** RevenueCat-specific tests are excluded — payment provider will change soon. Paywall UI rendering is still tested, but purchase/restore/entitlement flows are not.

---

## Layer 1: Hook Unit Tests (~35 test files)

Jest + existing mock Supabase client. Each hook gets its own test file.

### Critical hooks (complex logic)

| Hook | Scenarios |
|------|-----------|
| `use-promotions` | Enrichment (discount%, distance, gamification msg), sorting modes (cheapest/nearest/discount/expiring), `isLocked` gating for free users (index >= 3), `isBestPrice` detection, realtime refetch on insert/update/delete |
| `use-shopping-list` | CRUD (add/remove/toggle), `optimizeList` greedy algorithm, origin `store_id` grouping vs legacy fallback, Google Maps URL generation with waypoints, optimistic updates + rollback on error |
| `use-stores` | Distance calculation, topDeals extraction (top 5 by discount%), enrichment consistency |
| `use-favorites` | Add/remove with optimistic updates, plan limit enforcement (DB error parsing), `isFavorited` check |
| `use-alerts` | Create with Zod validation, disable, plan limit errors, target price parsing |
| `use-plan-gate` | Limit checks per plan tier (free vs paid) |
| `use-store-ranking` | Ranking by proximity and price, edge cases (no stores, no location) |
| `use-price-history` | Trend calculation, empty history, date range handling |

### Simpler hooks (thin wrappers)

`use-location`, `use-auth`, `use-categories`, `use-featured-deals`, `use-social-proof`, `use-economy-summary`, `use-competitive`, `use-extraction`, `use-publish-import`, `use-haptics`, `use-push-notifications`, `use-realtime`, `use-image-picker`, `use-search`, `use-account`, `use-theme-classes`

---

## Layer 2: Component Integration Tests (~25 test files)

React Native Testing Library (`@testing-library/react-native`) + `jest-expo`.

### Screen-level tests

| Screen | Scenarios |
|--------|-----------|
| Home | Renders deals carousel + category chips + store ranking; tap deal card navigates to `/product/[id]`; tap category filters deals; loading skeleton; error state with retry |
| Search | Debounced input (300ms); sort pill toggles; empty state message; locked cards (index >= 3) show overlay; tap locked triggers paywall callback; clear button resets query |
| Map | Markers render for stores; tap marker opens store sheet; "Ver minha lista" pill only with list items; list panel groups by store; cheapest store highlighted; route button URL |
| List | Empty state with "Adicionar" CTA; items render with checkbox; toggle updates state; optimization shows cheapest route; free user upsell card |
| Account | User info displays; plan badge (free vs paid); delete account confirmation; settings rows |
| Product Detail | Metadata renders; price comparison sorted; cheapest highlighted; alert creation with target price; "Adicionar a lista" creates list + adds item with store_id |
| Onboarding | Role selection; auth step with provider buttons; business shows store setup; redirect with existing session |

### Component-level tests

| Component | Scenarios |
|-----------|-----------|
| `SearchResults` | Product-first cards (name + price + store); locked overlay; discount badge (> 0%); "Melhor preco" badge |
| `StoreBottomSheet` | Header + info row + top deals; navigate URL; dismiss on close |
| `DealCard` | Compact vs full; discount badge; expiring soon |
| `SmartList` | Item rendering; checked state; empty state |
| `Paywall` | Feature comparison table renders; close button; restore link present |
| `StoreSetup` | Multi-field validation; state code picker |
| `NativeTabLayout` | 5 visible tabs; hidden legacy routes; correct icons |

---

## Layer 3: E2E Flow Tests (~8 Maestro YAML flows)

Maestro — YAML-based, runs on iOS simulator + Android emulator, no native build changes.

| # | Flow | Steps |
|---|------|-------|
| 1 | Consumer onboarding | Launch -> hero -> tap "Comecar" -> auth screen -> back works |
| 2 | Search & find product | Search tab -> type query -> results appear -> tap sort pill -> order changes -> tap result -> product detail |
| 3 | Product to list | Product detail -> "Adicionar a lista" -> success alert -> list tab -> item present |
| 4 | Map exploration | Map tab -> markers visible -> tap marker -> store sheet -> "Rota" -> external link |
| 5 | Shopping list optimization | List tab -> items present -> savings card -> "Ver rota" -> map link |
| 6 | Map list panel | Items in list -> map tab -> pill visible -> tap -> panel opens -> stores grouped -> cheapest highlighted |
| 7 | Business dashboard | Login as business -> KPIs -> offers tab -> promotions list |
| 8 | Business importer | Business -> importer tab -> upload area -> select image -> analyze -> review -> publish |

---

## Test Organization

```
mobile/__tests__/
  foundational/          (existing - keep)
  helpers/               (existing - keep)
  us0-us6/               (existing - keep)
  hooks/                 (NEW - unit tests per hook)
    use-promotions.test.ts
    use-shopping-list.test.ts
    use-stores.test.ts
    use-favorites.test.ts
    use-alerts.test.ts
    use-plan-gate.test.ts
    ...
  components/            (NEW - RNTL integration tests)
    home-screen.test.tsx
    search-screen.test.tsx
    search-results.test.tsx
    map-screen.test.tsx
    list-screen.test.tsx
    account-screen.test.tsx
    product-detail.test.tsx
    onboarding.test.tsx
    store-bottom-sheet.test.tsx
    deal-card.test.tsx
    paywall.test.tsx
    ...
  e2e/                   (NEW - Maestro YAML flows)
    consumer-onboarding.yaml
    search-and-find.yaml
    product-to-list.yaml
    map-exploration.yaml
    list-optimization.yaml
    map-list-panel.yaml
    business-dashboard.yaml
    business-importer.yaml
```

## Dependencies to Add

- `@testing-library/react-native` — component rendering + queries
- `@testing-library/jest-native` — custom matchers (toBeVisible, toHaveTextContent)
- `jest-expo` — Expo-aware Jest preset (may already be present)
- `maestro` — CLI tool, installed globally (`curl -Ls https://get.maestro.mobile.dev | bash`)

## Tooling

- **Unit + Integration**: `npx jest` (existing config, extended)
- **E2E**: `maestro test mobile/__tests__/e2e/` (requires running dev build on simulator)
