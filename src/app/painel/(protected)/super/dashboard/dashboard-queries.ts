/**
 * Server-side aggregation functions for the Super Dashboard.
 * All functions receive the raw promotions array from a single unified query.
 */

export interface RawPromotion {
  product_id: string;
  store_id: string;
  original_price: number;
  promo_price: number;
  source: string;
  end_date: string;
  product: { name: string; category_id: string; category: { name: string } | null } | null;
  store: { name: string; city: string; state: string } | null;
}

// ─── Offer Analytics ───────────────────────────────────────────

export interface OfferAnalytics {
  avgDiscountPercent: number;
  sourceBreakdown: { manual: number; importador_ia: number; crawler: number };
  expiringIn48h: number;
  categoryBreakdown: Array<{ name: string; count: number }>;
}

export function computeOfferAnalytics(promos: RawPromotion[]): OfferAnalytics {
  if (promos.length === 0) {
    return {
      avgDiscountPercent: 0,
      sourceBreakdown: { manual: 0, importador_ia: 0, crawler: 0 },
      expiringIn48h: 0,
      categoryBreakdown: [],
    };
  }

  // Average discount
  let totalDiscount = 0;
  let discountCount = 0;
  for (const p of promos) {
    const orig = Number(p.original_price);
    const promo = Number(p.promo_price);
    if (orig > 0) {
      totalDiscount += ((orig - promo) / orig) * 100;
      discountCount++;
    }
  }
  const avgDiscountPercent = discountCount > 0 ? totalDiscount / discountCount : 0;

  // Source breakdown
  const sourceBreakdown = { manual: 0, importador_ia: 0, crawler: 0 };
  for (const p of promos) {
    if (p.source === "manual") sourceBreakdown.manual++;
    else if (p.source === "importador_ia") sourceBreakdown.importador_ia++;
    else if (p.source === "crawler") sourceBreakdown.crawler++;
  }

  // Expiring in 48h
  const in48h = new Date();
  in48h.setHours(in48h.getHours() + 48);
  const in48hStr = in48h.toISOString();
  const nowStr = new Date().toISOString();
  let expiringIn48h = 0;
  for (const p of promos) {
    if (p.end_date >= nowStr && p.end_date <= in48hStr) {
      expiringIn48h++;
    }
  }

  // Category breakdown
  const catMap = new Map<string, number>();
  for (const p of promos) {
    const catName = p.product?.category?.name ?? "Sem categoria";
    catMap.set(catName, (catMap.get(catName) ?? 0) + 1);
  }
  const categoryBreakdown = Array.from(catMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  return { avgDiscountPercent, sourceBreakdown, expiringIn48h, categoryBreakdown };
}

// ─── Store Ranking ─────────────────────────────────────────────

export interface StoreRankEntry {
  storeName: string;
  city: string;
  state: string;
  activeOffers: number;
  avgDiscountPercent: number;
  categoryCount: number;
}

export function computeStoreRanking(promos: RawPromotion[]): StoreRankEntry[] {
  const storeMap = new Map<string, {
    storeName: string;
    city: string;
    state: string;
    discounts: number[];
    categories: Set<string>;
  }>();

  for (const p of promos) {
    const storeId = p.store_id;
    const entry = storeMap.get(storeId) ?? {
      storeName: p.store?.name ?? "—",
      city: p.store?.city ?? "",
      state: p.store?.state ?? "",
      discounts: [],
      categories: new Set<string>(),
    };

    const orig = Number(p.original_price);
    const promo = Number(p.promo_price);
    if (orig > 0) {
      entry.discounts.push(((orig - promo) / orig) * 100);
    }

    const catName = p.product?.category?.name;
    if (catName) entry.categories.add(catName);

    storeMap.set(storeId, entry);
  }

  return Array.from(storeMap.values())
    .map((e) => ({
      storeName: e.storeName,
      city: e.city,
      state: e.state,
      activeOffers: e.discounts.length,
      avgDiscountPercent:
        e.discounts.length > 0
          ? e.discounts.reduce((a, b) => a + b, 0) / e.discounts.length
          : 0,
      categoryCount: e.categories.size,
    }))
    .sort((a, b) => b.activeOffers - a.activeOffers)
    .slice(0, 10);
}

// ─── Comparison Coverage ───────────────────────────────────────

export interface ComparisonCoverage {
  comparisonReady: number;
  totalWithOffers: number;
  topCoverage: Array<{ productName: string; storeCount: number }>;
  needingData: Array<{ productName: string; storeCount: number }>;
}

export function computeComparisonCoverage(promos: RawPromotion[]): ComparisonCoverage {
  // Group by product, count distinct stores
  const productStores = new Map<string, { productName: string; stores: Set<string> }>();

  for (const p of promos) {
    const productName = p.product?.name;
    if (!productName) continue;
    const entry = productStores.get(p.product_id) ?? {
      productName,
      stores: new Set<string>(),
    };
    entry.stores.add(p.store_id);
    productStores.set(p.product_id, entry);
  }

  const all = Array.from(productStores.values()).map((e) => ({
    productName: e.productName,
    storeCount: e.stores.size,
  }));

  const comparisonReady = all.filter((p) => p.storeCount >= 2).length;
  const totalWithOffers = all.length;

  const topCoverage = [...all]
    .sort((a, b) => b.storeCount - a.storeCount)
    .slice(0, 10);

  const needingData = all
    .filter((p) => p.storeCount === 1)
    .slice(0, 10);

  return { comparisonReady, totalWithOffers, topCoverage, needingData };
}

// ─── Benchmarks (replaces inline logic from page.tsx) ──────────

export interface BenchmarkEntry {
  productName: string;
  bestPrice: number;
  bestStore: string;
  worstPrice: number;
  worstStore: string;
}

export function computeBenchmarks(promos: RawPromotion[]): BenchmarkEntry[] {
  const productMap = new Map<string, BenchmarkEntry>();

  for (const p of promos) {
    const productName = p.product?.name;
    if (!productName) continue;
    const price = Number(p.promo_price);
    const storeName = p.store?.name ?? "—";

    const entry = productMap.get(productName);
    if (!entry) {
      productMap.set(productName, {
        productName,
        bestPrice: price,
        bestStore: storeName,
        worstPrice: price,
        worstStore: storeName,
      });
    } else {
      if (price < entry.bestPrice) { entry.bestPrice = price; entry.bestStore = storeName; }
      if (price > entry.worstPrice) { entry.worstPrice = price; entry.worstStore = storeName; }
    }
  }

  return Array.from(productMap.values())
    .filter((b) => b.bestPrice !== b.worstPrice)
    .slice(0, 10);
}
