"use server";

import { revalidatePath } from "next/cache";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { requirePermission } from "@/features/auth/session";
import {
  computeQualityScore,
  computeWeightedIndex,
  percentChange,
  type CategoryAgg,
  type ProductLookupEntry,
} from "@/lib/index-engine";

const supabaseAdmin = createSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

interface GenerateInput {
  month?: number;
  year?: number;
}

interface GenerateResult {
  indicesCreated: number;
  cities: string[];
  error?: string;
}

interface SnapshotRow {
  product_id: string;
  date: string;
  min_promo_price: number;
  avg_promo_price: number;
  store_count: number;
}

export async function generateIndexNow(input?: GenerateInput): Promise<GenerateResult> {
  await requirePermission("moderation:manage");

  const now = new Date();
  const targetMonth = input?.month ?? now.getMonth() + 1; // 1-indexed
  const targetYear = input?.year ?? now.getFullYear();

  const periodStart = new Date(targetYear, targetMonth - 1, 1);
  const periodEnd = new Date(targetYear, targetMonth, 0); // last day of month

  const periodStartStr = periodStart.toISOString().slice(0, 10);
  const periodEndStr = periodEnd.toISOString().slice(0, 10);

  // Get all distinct cities from active stores
  const { data: cities } = await supabaseAdmin
    .from("stores")
    .select("city, state")
    .eq("is_active", true);

  if (!cities?.length) {
    return { indicesCreated: 0, cities: [], error: "Nenhum mercado ativo encontrado." };
  }

  // Deduplicate city/state combos
  const uniqueCities = Array.from(
    new Map(cities.map((c: { city: string; state: string }) => [`${c.city}|${c.state}`, c])).values(),
  );

  let indicesCreated = 0;
  const createdCities: string[] = [];

  for (const { city, state } of uniqueCities) {
    // Skip if index already exists for this period+city
    const { data: existing } = await supabaseAdmin
      .from("price_indices")
      .select("id")
      .eq("city", city)
      .eq("state", state)
      .eq("period_start", periodStartStr)
      .limit(1);

    if (existing?.length) continue;

    // Get stores in this city
    const { data: cityStores } = await supabaseAdmin
      .from("stores")
      .select("id")
      .eq("city", city)
      .eq("state", state)
      .eq("is_active", true);

    const storeIds = (cityStores ?? []).map((s: { id: string }) => s.id);
    if (!storeIds.length) continue;

    // Get promotions from these stores in the period
    const { data: promotions } = await supabaseAdmin
      .from("promotions")
      .select("product_id, promo_price, store_id")
      .in("store_id", storeIds)
      .eq("status", "active")
      .gte("end_date", periodStartStr)
      .lte("start_date", periodEndStr);

    // Get price snapshots for the month
    const { data: snapshots } = await supabaseAdmin
      .from("price_snapshots")
      .select("product_id, date, min_promo_price, avg_promo_price, store_count")
      .gte("date", periodStartStr)
      .lte("date", periodEndStr);

    if (!snapshots?.length && !promotions?.length) continue;

    // Collect all product IDs
    const allProductIds = new Set<string>();
    for (const s of (snapshots ?? []) as SnapshotRow[]) allProductIds.add(s.product_id);
    for (const p of promotions ?? []) allProductIds.add(p.product_id);

    if (!allProductIds.size) continue;

    // Fetch product details
    const { data: products } = await supabaseAdmin
      .from("products")
      .select("id, name, category_id, reference_price")
      .in("id", Array.from(allProductIds));

    const productLookup = new Map<string, ProductLookupEntry>();
    for (const p of (products ?? []) as ProductLookupEntry[]) {
      productLookup.set(p.id, p);
    }

    // Aggregate by category using snapshots
    const categoryAggs = new Map<string, CategoryAgg>();
    const productSnapshots = new Map<string, SnapshotRow[]>();
    for (const s of (snapshots ?? []) as SnapshotRow[]) {
      const arr = productSnapshots.get(s.product_id) ?? [];
      arr.push(s);
      productSnapshots.set(s.product_id, arr);
    }

    for (const [productId, snaps] of productSnapshots) {
      const product = productLookup.get(productId);
      if (!product) continue;

      const catId = product.category_id;
      const agg = categoryAggs.get(catId) ?? {
        categoryId: catId,
        productCount: 0,
        avgPrice: 0,
        minPrice: Infinity,
        maxPrice: 0,
        totalWeight: 0,
        productDetails: [],
      };

      const avgPrice = snaps.reduce((sum, s) => sum + s.avg_promo_price, 0) / snaps.length;
      const minPrice = Math.min(...snaps.map((s) => s.min_promo_price));
      const maxPrice = Math.max(...snaps.map((s) => s.avg_promo_price));

      agg.productCount++;
      agg.avgPrice += avgPrice;
      agg.minPrice = Math.min(agg.minPrice, minPrice);
      agg.maxPrice = Math.max(agg.maxPrice, maxPrice);
      agg.productDetails.push({
        productId,
        avgPrice: Number(avgPrice.toFixed(2)),
        minPrice: Number(minPrice.toFixed(2)),
        maxPrice: Number(maxPrice.toFixed(2)),
        snapshotDays: snaps.length,
      });

      categoryAggs.set(catId, agg);
    }

    // If no snapshots, fall back to promotions data
    if (categoryAggs.size === 0 && promotions?.length) {
      const productPromos = new Map<string, number[]>();
      for (const p of promotions) {
        const arr = productPromos.get(p.product_id) ?? [];
        arr.push(Number(p.promo_price));
        productPromos.set(p.product_id, arr);
      }

      for (const [productId, prices] of productPromos) {
        const product = productLookup.get(productId);
        if (!product) continue;

        const catId = product.category_id;
        const agg = categoryAggs.get(catId) ?? {
          categoryId: catId,
          productCount: 0,
          avgPrice: 0,
          minPrice: Infinity,
          maxPrice: 0,
          totalWeight: 0,
          productDetails: [],
        };

        const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
        const minPrice = Math.min(...prices);
        const maxPrice = Math.max(...prices);

        agg.productCount++;
        agg.avgPrice += avgPrice;
        agg.minPrice = Math.min(agg.minPrice, minPrice);
        agg.maxPrice = Math.max(agg.maxPrice, maxPrice);
        agg.productDetails.push({
          productId,
          avgPrice: Number(avgPrice.toFixed(2)),
          minPrice: Number(minPrice.toFixed(2)),
          maxPrice: Number(maxPrice.toFixed(2)),
          snapshotDays: 0,
        });

        categoryAggs.set(catId, agg);
      }
    }

    if (categoryAggs.size === 0) continue;

    // Finalize category averages
    for (const [, agg] of categoryAggs) {
      if (agg.productCount > 0) {
        agg.avgPrice = agg.avgPrice / agg.productCount;
      }
      if (agg.minPrice === Infinity) agg.minPrice = 0;
    }

    const totalProducts = Array.from(categoryAggs.values()).reduce((s, a) => s + a.productCount, 0);
    const totalDays = periodEnd.getDate();

    // Compute quality score
    const qualityScore = computeQualityScore({
      productCount: totalProducts,
      totalPossibleProducts: allProductIds.size,
      snapshotCount: (snapshots ?? []).length,
      totalDays,
      storeCount: storeIds.length,
      categoryCount: categoryAggs.size,
    });

    // Compute weighted index value
    const indexValue = computeWeightedIndex(categoryAggs, productLookup);

    // Get previous month's index for MoM
    const prevMonthStart = new Date(periodStart.getFullYear(), periodStart.getMonth() - 1, 1);
    const prevMonthStartStr = prevMonthStart.toISOString().slice(0, 10);

    const { data: prevIndex } = await supabaseAdmin
      .from("price_indices")
      .select("id, index_value")
      .eq("city", city)
      .eq("state", state)
      .eq("period_start", prevMonthStartStr)
      .limit(1);

    const momChange = prevIndex?.length
      ? percentChange(indexValue, prevIndex[0].index_value)
      : null;

    // Get YoY (12 months ago)
    const yoyStart = new Date(periodStart.getFullYear() - 1, periodStart.getMonth(), 1);
    const { data: yoyIndex } = await supabaseAdmin
      .from("price_indices")
      .select("index_value")
      .eq("city", city)
      .eq("state", state)
      .eq("period_start", yoyStart.toISOString().slice(0, 10))
      .limit(1);

    const yoyChange = yoyIndex?.length
      ? percentChange(indexValue, yoyIndex[0].index_value)
      : null;

    // INSERT index row — always draft for manual trigger
    const { data: newIndex, error: indexError } = await supabaseAdmin
      .from("price_indices")
      .insert({
        city,
        state,
        period_start: periodStartStr,
        period_end: periodEndStr,
        index_value: Number(indexValue.toFixed(4)),
        mom_change_percent: momChange,
        yoy_change_percent: yoyChange,
        data_quality_score: qualityScore,
        product_count: totalProducts,
        store_count: storeIds.length,
        snapshot_count: (snapshots ?? []).length,
        status: "draft",
        published_at: null,
      })
      .select("id")
      .single();

    if (indexError || !newIndex) {
      return {
        indicesCreated: 0,
        cities: [],
        error: `Erro ao inserir indice para ${city}/${state}: ${indexError?.message ?? "sem dados retornados"}`,
      };
    }

    // Get previous month category prices for category MoM
    const prevCatPrices = new Map<string, number>();
    if (prevIndex?.length) {
      const { data: prevCats } = await supabaseAdmin
        .from("price_index_categories")
        .select("category_id, avg_price")
        .eq("index_id", prevIndex[0].id);

      if (prevCats) {
        for (const pc of prevCats) {
          prevCatPrices.set(pc.category_id, pc.avg_price);
        }
      }
    }

    // Bulk insert category breakdowns
    const categoryRows = Array.from(categoryAggs.entries()).map(([catId, agg]) => {
      const prevCatAvg = prevCatPrices.get(catId);
      const catMom = prevCatAvg ? percentChange(agg.avgPrice, prevCatAvg) : null;

      return {
        index_id: newIndex.id,
        category_id: catId,
        avg_price: Number(agg.avgPrice.toFixed(2)),
        min_price: Number(agg.minPrice.toFixed(2)),
        max_price: Number(agg.maxPrice.toFixed(2)),
        product_count: agg.productCount,
        mom_change_percent: catMom,
        weight: agg.totalWeight,
      };
    });

    if (categoryRows.length > 0) {
      await supabaseAdmin.from("price_index_categories").insert(categoryRows);
    }

    // Get previous month product prices for product MoM
    const prevProductPrices = new Map<string, number>();
    if (prevIndex?.length) {
      const { data: prevProducts } = await supabaseAdmin
        .from("price_index_products")
        .select("product_id, avg_price")
        .eq("index_id", prevIndex[0].id);

      if (prevProducts) {
        for (const pp of prevProducts) {
          prevProductPrices.set(pp.product_id, pp.avg_price);
        }
      }
    }

    // Bulk insert product details
    const productRows: Array<Record<string, unknown>> = [];
    for (const [, agg] of categoryAggs) {
      for (const pd of agg.productDetails) {
        const prevAvg = prevProductPrices.get(pd.productId);
        const prodMom = prevAvg ? percentChange(pd.avgPrice, prevAvg) : null;

        productRows.push({
          index_id: newIndex.id,
          product_id: pd.productId,
          avg_price: pd.avgPrice,
          min_price: pd.minPrice,
          max_price: pd.maxPrice,
          snapshot_days: pd.snapshotDays,
          mom_change_percent: prodMom,
        });
      }
    }

    if (productRows.length > 0) {
      await supabaseAdmin.from("price_index_products").insert(productRows);
    }

    indicesCreated++;
    createdCities.push(`${city}`);
  }

  revalidatePath("/painel/super/indice");

  if (indicesCreated === 0 && uniqueCities.length > 0) {
    return {
      indicesCreated: 0,
      cities: [],
      error: "Indices ja existem para todas as cidades neste periodo, ou dados insuficientes.",
    };
  }

  return { indicesCreated, cities: createdCities };
}
