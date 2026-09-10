# Research: Modo Receita

**Branch**: `003-recipe-mode` | **Date**: 2026-05-15

---

## Decision 1: Ingredient-to-Product Matching Strategy

**Decision**: Reuse the existing `match_product_for_upsert` pattern — call Supabase's `search_products` RPC (pg_trgm similarity) per parsed ingredient name. No new NLP service or LLM needed.

**Rationale**: The project already has `ix_products_name_trgm` (GIN trigram index on `products.name`) and `product_synonyms` table, both used by `search_products(query)` and `match_product_for_upsert(query)`. A new `match_ingredient` RPC extends this pattern with a lower threshold (0.3) for recall + top-3 candidates so the user can swap. This is zero new infrastructure.

**Flow**:
1. Client parses ingredient text → `{quantity, unit, name}` (client-side)
2. Client calls Supabase RPC `match_ingredient(parsed_name)` per ingredient (parallel)
3. RPC returns up to 3 candidates with similarity scores; auto-select top if score ≥ 0.5
4. Client updates Zustand store as each resolves → progressive rendering

**Alternatives considered**:
- OpenAI embedding search — overkill, adds cost, slower, no existing infra
- Simple ILIKE — already in `search_products` as fallback; pg_trgm strictly better
- Client-side matching — catalog is too large; must stay in DB

---

## Decision 2: Store Totals + Split-Basket Calculation

**Decision**: Single Supabase Edge Function `recipe-calculate` called once after all ingredients are matched. Computes store totals and split-basket server-side.

**Rationale**: Store totals require joining `store_prices` + `promotions` across all matched products — a single SQL query is far more efficient than N client-side calls. Split-basket runs the O(M²N) enumeration in the Edge Function (< 1ms for M=10 stores, N=30 items — verified by complexity analysis).

**Split-basket algorithm** (exhaustive 2-store enumeration):
```
For each pair of stores (s1, s2):
  For each product: assign to whichever store is cheaper
  Sum total cost for this pair
Return pair with lowest total (if savings > R$5,00 vs. cheapest single store)
```
Time complexity: O(M² × N) = 10² × 30 = 3,000 ops — trivially fast.

**Input to Edge Function**: `{ matches: [{product_id, quantity}], lat, lng }`
**Output**: `{ stores: StoreTotals[], split_basket: SplitBasket | null }`

Price source priority (matches existing app logic):
1. Active promo (`promotions` where `status='active'` and within validity)
2. Last price (`promotions` where `status='last_price'`)
3. `store_prices` table (ERP/import prices)
4. `products.reference_price` (Cosmos catalog fallback)

**Alternatives considered**:
- Client-side split-basket — feasible but requires downloading all price data to device
- Per-ingredient Edge Function calls — would enable streaming but adds N round trips

---

## Decision 3: Progressive Rendering Pattern

**Decision**: Client fires N parallel calls to `match_ingredient` RPC, each updating a Zustand recipe store on resolution. Store totals fetched in a single follow-up call after all matches settle.

**Rationale**: `Promise.allSettled` + Zustand v5 maintains ingredient ordering while showing each result as it arrives. One match failure doesn't block others. Consistent with existing hook patterns in `mobile/hooks/use-promotions.ts`.

**Pattern** (pseudocode):
```typescript
// Initialize all as 'pending'
set({ lines: ingredients.map(i => ({ ...i, status: 'pending' })) })

// Fire all in parallel; update on each resolution
const promises = ingredients.map(i =>
  matchIngredient(i.parsedName)
    .then(result => updateLine(i.id, { status: 'matched', product: result }))
    .catch(() => updateLine(i.id, { status: 'unmatched' }))
)
await Promise.allSettled(promises)

// All settled → fire recipe-calculate
const totals = await calculateTotals(matchedLines, location)
```

**Timeout rule**: If a single `match_ingredient` call exceeds 15s, auto-mark as 'unmatched' (specified in spec).

---

## Decision 4: Client-Side Ingredient Parsing

**Decision**: Parse ingredient text on the client (React Native) using a regex + known-units approach. No server round-trip for parsing.

**Rationale**: Parsing is deterministic and cheap. Sending raw text to the server for parsing would add latency before matching even starts. A known-units list covers Brazilian cooking conventions (g, kg, ml, L, xícara, colher de sopa, colher de chá, unidade, dente, fatia, folha).

**Parser output**: `{ rawText: string, quantity: number | null, unit: string | null, parsedName: string }`

**Example**:
- `"500g de feijão preto"` → `{ quantity: 500, unit: 'g', parsedName: 'feijão preto' }`
- `"2 latas de tomate pelado"` → `{ quantity: 2, unit: 'lata', parsedName: 'tomate pelado' }`
- `"sal"` → `{ quantity: null, unit: null, parsedName: 'sal' }`

---

## Decision 5: New Tables vs. Existing Tables

**Decision**: Two new tables: `recipes` (user-owned recipe with name + serving size) and `recipe_ingredient_lines` (one row per ingredient, with product_id FK). No changes to existing tables.

**Rationale**: Recipes are a new domain entity with no overlap with existing `shopping_lists`. Clean separation; RLS ties recipes to `auth.users` the same way `user_favorites` and `user_alerts` do.

**Free tier limit** (3 recipes): enforced in the mobile hook before calling insert — check `count(*)` from `recipes` where `user_id = auth.uid()`. Not enforced at DB level to keep schema simple.
