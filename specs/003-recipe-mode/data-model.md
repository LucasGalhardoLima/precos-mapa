# Data Model: Modo Receita

**Branch**: `003-recipe-mode` | **Date**: 2026-05-15

---

## New Tables

### `recipes`

Stores a user's named recipe with serving size and the last-opened price snapshot (for delta calculation).

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK, default `gen_random_uuid()` | |
| `user_id` | `uuid` | NOT NULL, FK → `auth.users(id)` ON DELETE CASCADE | RLS anchor |
| `name` | `text` | NOT NULL | User-defined name e.g. "Feijoada de domingo" |
| `serving_size` | `int` | NOT NULL, DEFAULT 1, CHECK > 0 | Multiplier for all quantities |
| `last_opened_total` | `numeric(10,2)` | NULLABLE | Cheapest-single-store total from last open session |
| `last_opened_at` | `timestamptz` | NULLABLE | Timestamp of last open (for delta display) |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT NOW() | |
| `updated_at` | `timestamptz` | NOT NULL, DEFAULT NOW() | Updated by trigger |

**RLS**: Users can SELECT, INSERT, UPDATE, DELETE their own rows (`auth.uid() = user_id`).

**Indexes**: `idx_recipes_user_id ON recipes(user_id)`

**Free tier enforcement**: Application-level — before INSERT, check `SELECT COUNT(*) FROM recipes WHERE user_id = auth.uid()`. If ≥ 3 and user is Free tier, reject with paywall prompt. Not enforced at DB level.

---

### `recipe_ingredient_lines`

One row per ingredient in a recipe. Stores the raw input, parsed fields, and the resolved catalog product.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK, default `gen_random_uuid()` | |
| `recipe_id` | `uuid` | NOT NULL, FK → `recipes(id)` ON DELETE CASCADE | |
| `raw_text` | `text` | NOT NULL | Original user input e.g. "500g de feijão preto" |
| `parsed_quantity` | `numeric` | NULLABLE | e.g. `500` |
| `parsed_unit` | `text` | NULLABLE | e.g. `"g"` |
| `parsed_name` | `text` | NOT NULL | e.g. `"feijão preto"` |
| `product_id` | `uuid` | NULLABLE, FK → `products(id)` ON DELETE SET NULL | NULL if unmatched |
| `sort_order` | `int` | NOT NULL, DEFAULT 0 | Preserves original ingredient order |
| `created_at` | `timestamptz` | NOT NULL, DEFAULT NOW() | |

**RLS**: Users can manage lines of their own recipes (subquery to `recipes.user_id = auth.uid()`).

**Indexes**: `idx_recipe_ingredient_lines_recipe_id ON recipe_ingredient_lines(recipe_id)`

---

## New RPC (PostgreSQL Function)

### `match_ingredient(query text)`

Extends existing `search_products` / `match_product_for_upsert` pattern. Returns up to 3 product candidates for an ingredient name.

**Returns**: `TABLE(product_id uuid, name text, brand text, ean text, reference_price numeric, similarity_score numeric)`

**Logic**:
1. Check `product_synonyms` for exact match (score 1.0) — highest priority
2. Query `products` where `similarity(name, query) > 0.3` OR `name ILIKE '%query%'`
3. Return top 3 by `similarity_score DESC`

**Used by**: Client-side matching loop (one call per ingredient, parallel).

---

## Transient Types (not persisted)

### `RecipeResult` (computed on demand)

```typescript
interface RecipeResult {
  stores: StoreTotals[]        // ranked cheapest → most expensive
  splitBasket: SplitBasket | null  // null if savings < R$5,00
  calculatedAt: string         // ISO timestamp
}

interface StoreTotals {
  storeId: string
  storeName: string
  storeLogo: { initial: string; color: string }
  total: number                // sum of cheapest available price per ingredient
  missingCount: number         // ingredients with no price at this store
  isComplete: boolean          // missingCount === 0
  distanceKm: number | null
}

interface SplitBasket {
  store1: { storeId: string; storeName: string; items: string[]; subtotal: number }
  store2: { storeId: string; storeName: string; items: string[]; subtotal: number }
  combinedTotal: number
  savingsVsCheapestSingle: number
}
```

### `IngredientMatchState` (Zustand store)

```typescript
type MatchStatus = 'pending' | 'matched' | 'unmatched' | 'timeout'

interface IngredientLineState {
  id: string                    // local UUID
  rawText: string
  parsedName: string
  parsedQuantity: number | null
  parsedUnit: string | null
  status: MatchStatus
  candidates: ProductCandidate[]   // up to 3, from match_ingredient RPC
  selectedProduct: ProductCandidate | null
}

interface ProductCandidate {
  productId: string
  name: string
  brand: string | null
  ean: string | null
  referencePrice: number | null
  similarityScore: number
}
```

---

## Existing Tables Used (read-only for this feature)

| Table | Usage |
|-------|-------|
| `products` | Product name, brand, EAN, reference_price |
| `product_synonyms` | Ingredient alias resolution |
| `store_prices` | ERP/import prices per store |
| `promotions` | Active and last_price promos per store |
| `stores` | Store name, logo, distance (lat/lng) |
| `profiles` | Check subscription tier for Plus gating |

---

## Migration File

`supabase/migrations/040_recipe_mode.sql`
