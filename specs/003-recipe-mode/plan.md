# Implementation Plan: Modo Receita

**Branch**: `003-recipe-mode` | **Date**: 2026-05-15 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/003-recipe-mode/spec.md`

## Summary

Modo Receita lets users enter a recipe ingredient list and see the cheapest store (or 2-store combination for Plus) to buy everything. Ingredients are parsed client-side, matched to the catalog via the existing pg_trgm infrastructure (`match_ingredient` RPC), and results are shown progressively using Promise.allSettled + Zustand. Store totals and split-basket are computed server-side in a new `recipe-calculate` Edge Function. Saved recipes persist in two new tables (`recipes`, `recipe_ingredient_lines`) with RLS.

## Technical Context

**Language/Version**: TypeScript 5.9 (strict) — mobile (React Native) + Edge Functions (Deno/TS)
**Primary Dependencies**: Expo SDK 54, React Native 0.81, NativeWind v4 (Tailwind 3.4.x), Expo Router v6, Zustand v5, Supabase (pg_trgm, RLS, Edge Functions)
**Storage**: Supabase PostgreSQL — two new tables (`recipes`, `recipe_ingredient_lines`); reads from existing `products`, `store_prices`, `promotions`, `stores`
**Testing**: Jest + `@testing-library/react-native` (unit + component); Supabase local CLI (integration)
**Target Platform**: iOS 15+ / Android API 26+ (mobile-first)
**Performance Goals**: Progressive matching — each ingredient resolves independently; store totals in < 5s; split-basket O(M²N) < 1ms server-side
**Constraints**: 30 ingredients max per recipe; 2-store max for split-basket; 3 saved recipes for Free tier (app-enforced); guest access for P1 flow only

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Type-Safe Clean Code | ✅ Pass | TypeScript strict throughout; all functions have explicit return types |
| II. Testing Discipline | ✅ Pass | Unit tests for `ingredient-parser`, `basket-optimizer`; integration tests for `match_ingredient` RPC and Edge Function |
| III. User Experience First | ✅ Pass | Progressive rendering, pt-BR, immediate per-ingredient feedback; 30s flow target |
| IV. Interface Consistency | ✅ Pass | NativeWind + lucide-react-native icons; moti animations; no new libraries |
| V. Simplicity & YAGNI | ✅ Pass | Reuses existing pg_trgm search infra; no LLM; no new state management library |

**Gate result**: All clear. No violations. No Complexity Tracking needed.

## Project Structure

### Documentation (this feature)

```text
specs/003-recipe-mode/
├── plan.md              ← this file
├── research.md          ← Phase 0 decisions
├── data-model.md        ← schema + transient types
├── quickstart.md        ← dev setup + test steps
├── contracts/
│   ├── match-ingredient.sql       ← RPC contract
│   └── recipe-calculate.ts        ← Edge Function contract
└── tasks.md             ← Phase 2 output (/speckit.tasks)
```

### Source Code

```text
supabase/
├── migrations/
│   └── 040_recipe_mode.sql          ← recipes + recipe_ingredient_lines + match_ingredient RPC
└── functions/
    └── recipe-calculate/
        └── index.ts                 ← store totals + split-basket Edge Function

packages/shared/src/
├── types/
│   └── recipe.ts                    ← Recipe, IngredientLine, RecipeResult, SplitBasket types
└── lib/
    ├── ingredient-parser.ts         ← "500g de feijão" → {quantity, unit, parsedName}
    └── basket-optimizer.ts          ← O(M²N) split-basket algorithm (pure TS, no side effects)

mobile/
├── app/(tabs)/
│   └── recipe.tsx                   ← new tab entry screen (ingredient input → results)
├── components/recipe/
│   ├── ingredient-input.tsx         ← multi-line text input + parse-on-submit
│   ├── ingredient-line-row.tsx      ← single ingredient with status (pending/matched/unmatched)
│   ├── match-swap-sheet.tsx         ← bottom sheet to swap auto-matched product
│   ├── store-totals-list.tsx        ← ranked store cards with totals
│   ├── store-total-card.tsx         ← individual store card (complete vs. incomplete badge)
│   ├── split-basket-card.tsx        ← Plus result card (2-store recommendation)
│   ├── split-basket-teaser.tsx      ← Free tier teaser with upgrade CTA
│   └── my-recipes-list.tsx          ← saved recipes browser
├── hooks/
│   ├── use-recipe-match.ts          ← orchestrates parallel matching + totals flow
│   └── use-recipe.ts                ← CRUD for saved recipes (Supabase)
└── store/
    └── recipe-store.ts              ← Zustand store: IngredientLineState[], RecipeResult
```

**Structure Decision**: Option 3 (Mobile + API). Mobile screens in `mobile/app/(tabs)/recipe.tsx`; shared business logic in `packages/shared/src/lib/`; persistence in Supabase via new Edge Function and migration.

## Implementation Phases

### Phase 1 — Foundation (DB + Shared Logic)

**Deliverables**: Migration 040, `ingredient-parser.ts`, `basket-optimizer.ts`, shared types, `match_ingredient` RPC tested

1. Write `supabase/migrations/040_recipe_mode.sql`:
   - Create `recipes` table with RLS
   - Create `recipe_ingredient_lines` table with RLS
   - Create `match_ingredient(query text)` RPC (see `contracts/match-ingredient.sql`)

2. Write `packages/shared/src/types/recipe.ts`:
   - `Recipe`, `IngredientLine`, `IngredientLineState`, `ProductCandidate`
   - `RecipeResult`, `StoreTotals`, `LineItem`, `SplitBasket`, `SplitBasketTeaser`

3. Write `packages/shared/src/lib/ingredient-parser.ts`:
   - Regex + known-units list (g, kg, ml, L, xícara, colher de sopa, colher de chá, unidade, dente, fatia, folha, lata, pacote, caixa)
   - Export: `parseIngredientLine(raw: string): ParsedIngredient`
   - Export: `parseIngredientBlock(block: string): ParsedIngredient[]` (splits on newlines + commas)

4. Write `packages/shared/src/lib/basket-optimizer.ts`:
   - Pure function, no I/O
   - Export: `findOptimalSplit(lines: MatchedLine[], stores: StoreWithPrices[]): SplitBasket | null`
   - Returns null if best 2-store saving ≤ R$5,00

5. Write unit tests for parser and optimizer:
   - `packages/shared/src/lib/__tests__/ingredient-parser.test.ts`
   - `packages/shared/src/lib/__tests__/basket-optimizer.test.ts`

### Phase 2 — Edge Function

**Deliverables**: `recipe-calculate` deployed locally, integration-tested

1. Write `supabase/functions/recipe-calculate/index.ts`:
   - Parse and validate request body (Zod)
   - Resolve JWT → check user tier (Plus vs. Free) from `profiles`
   - Query store prices for all product_ids in a single SQL join
   - Build `StoreTotals[]` using price priority: active promo → last_price → store_prices → reference
   - Run `basket-optimizer` (import from shared); gate on user tier
   - Return `RecipeCalculateResponse`

2. Integration test (`supabase functions serve`):
   - Happy path: N matched products → correct store totals ranking
   - Split-basket: savings > R$5 for Plus → `splitBasket` present
   - Split-basket: Free user → `splitBasketTeaser` present, `splitBasket` null
   - Edge: all products at single store only → no split-basket

### Phase 3 — Mobile: Matching Flow (P1)

**Deliverables**: Users can enter ingredients and see progressive results + store totals

1. Write `mobile/store/recipe-store.ts` (Zustand):
   - State: `lines: IngredientLineState[]`, `result: RecipeResult | null`, `status: 'idle' | 'matching' | 'calculating' | 'done' | 'error'`
   - Actions: `setLines`, `updateLine`, `setResult`, `reset`

2. Write `mobile/hooks/use-recipe-match.ts`:
   - `startMatching(rawText: string)`: parse → initialize lines as 'pending' → fire parallel `match_ingredient` RPC calls → update each line on resolution → after all settle, call `recipe-calculate` Edge Function → set result
   - 15s timeout per ingredient match (auto-mark as 'unmatched')
   - Guest flow: full matching + totals; split-basket teaser only if auth

3. Write `mobile/components/recipe/ingredient-input.tsx`:
   - Multi-line TextInput (max 30 lines enforced)
   - "Calcular" button triggers `startMatching`
   - Character hint: "Uma linha por ingrediente, ex: 500g de feijão preto"

4. Write `mobile/components/recipe/ingredient-line-row.tsx`:
   - Shows parsed name + matched product name + confidence badge
   - Tap → opens `match-swap-sheet.tsx` for manual product swap
   - Status: spinner (pending), check (matched), warning (unmatched)

5. Write `mobile/components/recipe/store-totals-list.tsx` + `store-total-card.tsx`:
   - Complete baskets first, incomplete below
   - "cesta incompleta — X produto(s) não encontrado(s)"

6. Write `mobile/components/recipe/split-basket-card.tsx` + `split-basket-teaser.tsx`

7. Write `mobile/app/(tabs)/recipe.tsx` — wires everything together

### Phase 4 — Mobile: Save & Reuse (P3)

**Deliverables**: Recipes save, persist, and recalculate with delta

1. Write `mobile/hooks/use-recipe.ts`:
   - `saveRecipe(name, lines)`: check Free tier limit → insert into `recipes` + `recipe_ingredient_lines`
   - `listRecipes()`: fetch user's recipes ordered by `updated_at DESC`
   - `loadRecipe(id)`: fetch recipe + lines → re-run matching flow
   - `deleteRecipe(id)`
   - `updateLastOpened(id, total)`: PATCH `last_opened_total` + `last_opened_at` after each view

2. Write `mobile/components/recipe/my-recipes-list.tsx`:
   - Card per saved recipe: name, last_opened_at, delta badge (↑/↓ vs. last_opened_total)
   - Swipe-to-delete

3. Add "Salvar receita" action to results screen (auth-gated — prompt sign-in if guest)

### Phase 5 — Mobile: Serving Size (P4)

**Deliverables**: Serving size slider scales quantities and totals

1. Add `servingSize` to recipe store and `use-recipe-match`
2. Quantity scaling: `adjustedQty = parsedQuantity * (servingSize / originalServingSize)`
3. Re-trigger `recipe-calculate` when serving size changes (debounced 500ms)

## Key Reuse Points

| Existing artifact | Used for |
|-------------------|----------|
| `search_products(query)` RPC | Basis for `match_ingredient` — same pg_trgm + synonym logic |
| `match_product_for_upsert(query)` | Reference for synonym priority pattern |
| `search_products_with_prices` RPC | Price source priority logic (replicated in Edge Function) |
| `use-subscription.ts` hook | Checking Plus tier in `use-recipe-match` for split-basket gate |
| `paywall.tsx` component | Triggered when Free user hits 3-recipe limit or taps teaser CTA |
| `@gorhom/bottom-sheet` | `match-swap-sheet.tsx` for product swap |
| `skeleton/search-skeleton.tsx` | Pattern for ingredient loading skeleton |
| `moti` | Animations on line-row status transitions (pending → matched) |
