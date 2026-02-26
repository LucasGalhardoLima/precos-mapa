/**
 * Pure computation logic for price index generation.
 * Ported from supabase/functions/monthly-price-index/index.ts — no DB access.
 */

// CPI-like category weights (sum ~ 1.0)
// Based on Brazilian IPCA grocery subcategories
export const CATEGORY_WEIGHTS: Record<string, number> = {
  cat_alimentos: 0.30,
  cat_bebidas: 0.15,
  cat_hortifruti: 0.20,
  cat_padaria: 0.10,
  cat_limpeza: 0.10,
  cat_higiene: 0.10,
  cat_todos: 0.05,
};

export interface QualityScoreParams {
  productCount: number;
  totalPossibleProducts: number;
  snapshotCount: number;
  totalDays: number;
  storeCount: number;
  categoryCount: number;
}

export interface CategoryAgg {
  categoryId: string;
  productCount: number;
  avgPrice: number;
  minPrice: number;
  maxPrice: number;
  totalWeight: number;
  productDetails: ProductDetail[];
}

export interface ProductDetail {
  productId: string;
  avgPrice: number;
  minPrice: number;
  maxPrice: number;
  snapshotDays: number;
}

export interface ProductLookupEntry {
  id: string;
  name: string;
  category_id: string;
  reference_price: number | null;
}

/**
 * Compute data quality score (0-100) based on coverage, density, store participation, and category diversity.
 */
export function computeQualityScore(params: QualityScoreParams): number {
  const { productCount, totalPossibleProducts, snapshotCount, totalDays, storeCount, categoryCount } = params;

  // Product coverage: what % of known products have data (0-30 points)
  const coverageRatio = totalPossibleProducts > 0 ? productCount / totalPossibleProducts : 0;
  const coverageScore = Math.min(30, Math.round(coverageRatio * 30));

  // Snapshot density: avg snapshots per product relative to days in month (0-25 points)
  const avgSnapsPerProduct = productCount > 0 ? snapshotCount / productCount : 0;
  const densityRatio = totalDays > 0 ? avgSnapsPerProduct / totalDays : 0;
  const densityScore = Math.min(25, Math.round(densityRatio * 25));

  // Store participation: more stores = better data (0-20 points)
  const storeScore = Math.min(20, storeCount * 5);

  // Category diversity: more categories = broader index (0-15 points)
  const categoryScore = Math.min(15, Math.round((categoryCount / 7) * 15));

  // Minimum thresholds bonus (0-10 points)
  let thresholdBonus = 0;
  if (productCount >= 5) thresholdBonus += 3;
  if (storeCount >= 2) thresholdBonus += 3;
  if (snapshotCount >= 10) thresholdBonus += 4;

  return Math.min(100, coverageScore + densityScore + storeScore + categoryScore + thresholdBonus);
}

/**
 * Compute weighted index value from category aggregations and product reference prices.
 * Returns the normalized index (base 100 = reference prices).
 */
export function computeWeightedIndex(
  categoryAggs: Map<string, CategoryAgg>,
  productLookup: Map<string, ProductLookupEntry>,
): number {
  let indexValue = 0;
  let totalWeight = 0;

  for (const [catId, agg] of categoryAggs) {
    const weight = CATEGORY_WEIGHTS[catId] ?? 0.05;
    agg.totalWeight = weight;

    // Index contribution = category avg relative to product reference prices
    let catIndex = 0;
    let catIndexCount = 0;
    for (const pd of agg.productDetails) {
      const product = productLookup.get(pd.productId);
      if (product?.reference_price && product.reference_price > 0) {
        catIndex += (pd.avgPrice / product.reference_price) * 100;
        catIndexCount++;
      }
    }
    if (catIndexCount > 0) {
      catIndex = catIndex / catIndexCount;
      indexValue += catIndex * weight;
      totalWeight += weight;
    }
  }

  // Normalize index by total weight used
  if (totalWeight > 0) {
    return indexValue / totalWeight;
  }
  return 100; // base if no reference data
}

/**
 * Calculate percentage change between current and previous values.
 */
export function percentChange(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Number((((current - previous) / previous) * 100).toFixed(2));
}
