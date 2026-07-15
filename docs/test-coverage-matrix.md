# Test Coverage Matrix

Persona × Capability → Test File → Status

## Consumer Free

| Capability | Test File | Type | Status |
|---|---|---|---|
| Onboarding flow | `mobile/__tests__/e2e/consumer-onboarding.yaml` | E2E | ✅ |
| Home screen (featured deals) | `mobile/__tests__/us1/enrichment.test.ts` | Unit | ✅ |
| Map exploration | `mobile/__tests__/e2e/map-exploration.yaml` | E2E | ✅ |
| Map + list panel | `mobile/__tests__/e2e/map-list-panel.yaml` | E2E | ✅ |
| Product search | `mobile/__tests__/e2e/search-and-find.yaml` | E2E | ✅ |
| Product detail + price history | `mobile/__tests__/e2e/consumer-product-detail.yaml` | E2E | ✅ |
| Add product to shopping list | `mobile/__tests__/e2e/product-to-list.yaml` | E2E | ✅ |
| Shopping list optimization | `mobile/__tests__/e2e/list-optimization.yaml` | E2E | ✅ |
| Favorites (add/remove) | `mobile/__tests__/e2e/consumer-favorites.yaml` | E2E | ✅ |
| Alerts (create CTA → search, toggle) | `mobile/__tests__/e2e/consumer-alerts.yaml` | E2E | ✅ |
| Shopping list check-off item | `mobile/__tests__/e2e/consumer-list-check.yaml` | E2E | ✅ |
| Account screen | `mobile/__tests__/e2e/consumer-account.yaml` | E2E | ✅ |
| Paywall trigger | `mobile/__tests__/e2e/consumer-paywall.yaml` | E2E | ✅ |
| Plan gating logic | `mobile/__tests__/us6/b2c-subscriptions.test.ts` | Unit | ✅ |
| Favorites hook (CRUD, optimistic) | `mobile/__tests__/hooks/use-favorites-logic.test.ts` | Unit | ✅ |
| Alerts hook (CRUD) | `mobile/__tests__/hooks/use-alerts-logic.test.ts` | Unit | ✅ |
| Search hook (filter/debounce) | `mobile/__tests__/hooks/use-search-logic.test.ts` | Unit | ✅ |
| Shopping list hook | `mobile/__tests__/hooks/use-shopping-list-logic.test.ts` | Unit | ✅ |

## Consumer Plus

| Capability | Test File | Type | Status |
|---|---|---|---|
| Unlimited favorites (>10) | `mobile/__tests__/us6/b2c-subscriptions.test.ts` | Unit | ✅ |
| Unlimited alerts (>3) | `mobile/__tests__/us6/b2c-subscriptions.test.ts` | Unit | ✅ |
| Economy summary (Plus metrics) | `mobile/__tests__/hooks/use-economy-summary-logic.test.ts` | Unit | ✅ |

## Business

| Capability | Test File | Type | Status |
|---|---|---|---|
| Business dashboard | `mobile/__tests__/e2e/business-dashboard.yaml` | E2E | ✅ |
| AI importer | `mobile/__tests__/e2e/business-importer.yaml` | E2E | ✅ (shallow) |
| Offers list | `mobile/__tests__/e2e/business-offers-list.yaml` | E2E | ✅ |
| Store profile | `mobile/__tests__/e2e/business-profile.yaml` | E2E | ✅ |
| Business management hook | `mobile/__tests__/us4/business-management.test.ts` | Unit | ✅ |
| Billing / plan management | `mobile/__tests__/us5/billing-competitive.test.ts` | Unit | ✅ |
| Publish import API | `src/lib/__tests__/api/publish-import.test.ts` | Integration | ✅ |

## Admin Panel (Web)

| Capability | Test File | Type | Status |
|---|---|---|---|
| PDF import pipeline (schema/normalize) | `src/lib/__tests__/schema-normalization.test.ts` | Unit | ✅ |
| Product matching/dedup | `src/lib/__tests__/product-match.test.ts` | Unit | ✅ |
| Brand/category classification | `src/lib/__tests__/brand-category.test.ts` | Unit | ✅ |
| Import pipeline (multi-pass) | `src/lib/__tests__/import-pipeline.test.ts` | Unit | ✅ |
| Full E2E pipeline (mocked AI) | `src/lib/__tests__/pipeline-e2e.test.ts` | Integration | ✅ |
| Stripe webhook handler | `src/lib/__tests__/api/webhooks-stripe.test.ts` | Integration | ✅ |
| Cron: process single PDF | `src/lib/__tests__/api/cron-process-single-pdf.test.ts` | Integration | ✅ |
| Unsubscribe handler | `src/lib/__tests__/api/unsubscribe.test.ts` | Integration | ✅ |
| Admin panel pages (UI) | — | — | ❌ (Playwright — future) |
| Super admin moderation | — | — | ❌ (Playwright — future) |
| Price index generation | — | — | ❌ (Playwright — future) |
| Product/geo engagement ranking (query-shaping) | `src/app/painel/(protected)/super/engajamento/__tests__/engajamento-queries.test.ts` | Unit | ✅ |
| Product/geo engagement ranking (live RPCs) | `src/app/painel/(protected)/super/engajamento/__tests__/engajamento-queries.integration.test.ts` | Integration | ✅ (gated, `SUPABASE_INTEGRATION_TESTS=1`) |
| Business analytics store-scoping | `src/app/painel/(protected)/analytics/__tests__/analytics-queries.test.ts` | Unit | ✅ |
| Business analytics store isolation (live RPC) | `src/app/painel/(protected)/analytics/__tests__/analytics-queries.integration.test.ts` | Integration | ✅ (gated, `SUPABASE_INTEGRATION_TESTS=1`) |
| Analytics region fallback-guard (never persist GPS-denied default) | `mobile/__tests__/analytics/use-analytics.test.ts` | Unit | ✅ |
| Per-user engagement leaderboard/detail (query-shaping) | `src/app/painel/(protected)/super/engajamento/__tests__/engajamento-queries.test.ts` | Unit | ✅ |
| Per-user engagement leaderboard/detail (live RPCs) | `src/app/painel/(protected)/super/engajamento/__tests__/engajamento-queries.integration.test.ts` | Integration | ✅ (gated, `SUPABASE_INTEGRATION_TESTS=1`) |

## Edge Functions & RLS

| Capability | Test File | Type | Status |
|---|---|---|---|
| RLS policies (all tables) | — | — | ❌ (needs local Supabase) |
| Edge Functions (9 functions) | — | — | ❌ (Deno — future) |

---

**Legend:** ✅ = covered  ❌ = gap (noted for future)
