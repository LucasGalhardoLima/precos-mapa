/**
 * Contract: recipe-calculate Edge Function
 * Location: supabase/functions/recipe-calculate/index.ts
 *
 * Called ONCE after all ingredient matches settle.
 * Computes: store totals (ranked) + optional split-basket for Plus users.
 *
 * Auth: Bearer token (Supabase anon key). User tier checked inside.
 */

// ── Request ──────────────────────────────────────────────────────────────────

interface RecipeCalculateRequest {
  /** Matched ingredients with resolved product IDs and scaled quantities */
  matches: IngredientMatch[]
  /** User's current location for nearby store filtering. Null = national average */
  location: { lat: number; lng: number } | null
  /** Whether to compute split-basket (checked against user tier server-side) */
  requestSplitBasket: boolean
}

interface IngredientMatch {
  ingredientId: string       // local client UUID
  productId: string          // products.id
  parsedQuantity: number     // already scaled by serving_size
  parsedUnit: string | null
}

// ── Response ─────────────────────────────────────────────────────────────────

interface RecipeCalculateResponse {
  stores: StoreTotals[]            // ranked cheapest → most expensive (complete baskets first)
  splitBasket: SplitBasket | null  // null if: savings < R$5,00 OR user is Free tier
  splitBasketTeaser: SplitBasketTeaser | null  // non-null only for Free users when savings exist
  calculatedAt: string             // ISO 8601
}

interface StoreTotals {
  storeId: string
  storeName: string
  logoInitial: string
  logoColor: string
  distanceKm: number | null
  total: number              // sum of best available price per matched product
  missingCount: number       // products with no price at this store
  isComplete: boolean        // missingCount === 0
  lineItems: LineItem[]
}

interface LineItem {
  ingredientId: string
  productId: string
  productName: string
  price: number | null       // null if not available at this store
  priceType: 'active_promo' | 'last_price' | 'store_price' | 'reference'
}

interface SplitBasket {
  store1: SplitLeg
  store2: SplitLeg
  combinedTotal: number
  savingsVsCheapestSingle: number  // must be > R$5,00 to be included
}

interface SplitLeg {
  storeId: string
  storeName: string
  logoInitial: string
  logoColor: string
  ingredientIds: string[]  // which ingredients to buy here
  subtotal: number
}

interface SplitBasketTeaser {
  savingsAmount: number    // shown to Free users (not blurred) to motivate upgrade
}

// ── Internal algorithm notes ──────────────────────────────────────────────────
//
// Price source priority (same as search_products_with_prices):
//   1. promotions WHERE status='active' AND now() BETWEEN start_date AND end_date
//   2. promotions WHERE status='last_price'
//   3. store_prices (ERP/import)
//   4. products.reference_price (catalog fallback — shown as "preço sugerido")
//
// Split-basket algorithm (O(M² × N)):
//   For each pair of stores (s1, s2):
//     total = Σ min(price_s1[i], price_s2[i]) for each ingredient i
//   Return pair with lowest total.
//   Only return SplitBasket if combinedTotal < cheapestSingleStore - 5.00
//
// Store radius:
//   Uses same Haversine filter as search_products_with_prices.
//   If location is null, uses all stores (national).
//
// Authentication:
//   Auth header → Supabase JWT → profiles.id → check subscription tier for Plus gate.

// ── Error responses ───────────────────────────────────────────────────────────
//
// 400 Bad Request    — matches array empty or malformed
// 401 Unauthorized   — missing or invalid JWT
// 422 Unprocessable  — productId not found in catalog
// 500 Internal       — unexpected DB error
