import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// CPI-like category weights (sum = 1.0)
// Based on Brazilian IPCA grocery subcategories
const CATEGORY_WEIGHTS: Record<string, number> = {
  cat_alimentos: 0.30,
  cat_bebidas: 0.15,
  cat_hortifruti: 0.20,
  cat_padaria: 0.10,
  cat_limpeza: 0.10,
  cat_higiene: 0.10,
  cat_todos: 0.05,    // generic / uncategorized
};

const AUTO_PUBLISH_THRESHOLD = 70;

interface SnapshotRow {
  product_id: string;
  date: string;
  min_promo_price: number;
  avg_promo_price: number;
  store_count: number;
}

interface ProductRow {
  id: string;
  name: string;
  category_id: string;
  reference_price: number | null;
}

interface CategoryAgg {
  categoryId: string;
  productCount: number;
  avgPrice: number;
  minPrice: number;
  maxPrice: number;
  totalWeight: number;
  productDetails: Array<{
    productId: string;
    avgPrice: number;
    minPrice: number;
    maxPrice: number;
    snapshotDays: number;
  }>;
}

serve(async () => {
  try {
    // Calculate for previous month
    const now = new Date();
    const periodEnd = new Date(now.getFullYear(), now.getMonth(), 0); // last day of prev month
    const periodStart = new Date(periodEnd.getFullYear(), periodEnd.getMonth(), 1);

    const periodStartStr = periodStart.toISOString().slice(0, 10);
    const periodEndStr = periodEnd.toISOString().slice(0, 10);

    // Get all distinct cities from stores
    const { data: cities } = await supabase
      .from('stores')
      .select('city, state')
      .eq('is_active', true);

    if (!cities?.length) {
      return json({ indices: 0, message: 'No active stores found' });
    }

    // Deduplicate city/state combos
    const uniqueCities = Array.from(
      new Map(cities.map((c: { city: string; state: string }) => [`${c.city}|${c.state}`, c])).values()
    );

    let indicesCreated = 0;

    for (const { city, state } of uniqueCities) {
      // Check if index already exists for this period
      const { data: existing } = await supabase
        .from('price_indices')
        .select('id')
        .eq('city', city)
        .eq('state', state)
        .eq('period_start', periodStartStr)
        .limit(1);

      if (existing?.length) continue;

      // Get stores in this city
      const { data: cityStores } = await supabase
        .from('stores')
        .select('id')
        .eq('city', city)
        .eq('state', state)
        .eq('is_active', true);

      const storeIds = (cityStores ?? []).map((s: { id: string }) => s.id);
      if (!storeIds.length) continue;

      // Get all products with promotions from these stores in the period
      const { data: promotions } = await supabase
        .from('promotions')
        .select('product_id, promo_price, store_id')
        .in('store_id', storeIds)
        .eq('status', 'active')
        .gte('end_date', periodStartStr)
        .lte('start_date', periodEndStr);

      // Get price snapshots for the month
      const { data: snapshots } = await supabase
        .from('price_snapshots')
        .select('product_id, date, min_promo_price, avg_promo_price, store_count')
        .gte('date', periodStartStr)
        .lte('date', periodEndStr);

      if (!snapshots?.length && !promotions?.length) continue;

      // Get product details
      const allProductIds = new Set<string>();
      for (const s of (snapshots ?? []) as SnapshotRow[]) allProductIds.add(s.product_id);
      for (const p of (promotions ?? [])) allProductIds.add(p.product_id);

      if (!allProductIds.size) continue;

      const { data: products } = await supabase
        .from('products')
        .select('id, name, category_id, reference_price')
        .in('id', Array.from(allProductIds));

      const productLookup = new Map<string, ProductRow>();
      for (const p of (products ?? []) as ProductRow[]) {
        productLookup.set(p.id, p);
      }

      // Aggregate by category
      const categoryAggs = new Map<string, CategoryAgg>();

      // Process snapshots (preferred — daily aggregated data)
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

      // Finalize category averages
      for (const [, agg] of categoryAggs) {
        if (agg.productCount > 0) {
          agg.avgPrice = agg.avgPrice / agg.productCount;
        }
        if (agg.minPrice === Infinity) agg.minPrice = 0;
      }

      const totalProducts = Array.from(categoryAggs.values()).reduce((s, a) => s + a.productCount, 0);
      const totalDays = periodEnd.getDate(); // days in month

      // Compute data quality score
      const qualityScore = computeQualityScore({
        productCount: totalProducts,
        totalPossibleProducts: allProductIds.size,
        snapshotCount: (snapshots ?? []).length,
        totalDays,
        storeCount: storeIds.length,
        categoryCount: categoryAggs.size,
      });

      // Compute weighted index value
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
        indexValue = indexValue / totalWeight;
      } else {
        indexValue = 100; // base if no reference data
      }

      // Get previous month's index for MoM calculation
      const prevMonthStart = new Date(periodStart.getFullYear(), periodStart.getMonth() - 1, 1);
      const { data: prevIndex } = await supabase
        .from('price_indices')
        .select('index_value')
        .eq('city', city)
        .eq('state', state)
        .eq('period_start', prevMonthStart.toISOString().slice(0, 10))
        .limit(1);

      let momChange: number | null = null;
      if (prevIndex?.length && prevIndex[0].index_value > 0) {
        momChange = Number(
          (((indexValue - prevIndex[0].index_value) / prevIndex[0].index_value) * 100).toFixed(2)
        );
      }

      // Get YoY (12 months ago)
      const yoyStart = new Date(periodStart.getFullYear() - 1, periodStart.getMonth(), 1);
      const { data: yoyIndex } = await supabase
        .from('price_indices')
        .select('index_value')
        .eq('city', city)
        .eq('state', state)
        .eq('period_start', yoyStart.toISOString().slice(0, 10))
        .limit(1);

      let yoyChange: number | null = null;
      if (yoyIndex?.length && yoyIndex[0].index_value > 0) {
        yoyChange = Number(
          (((indexValue - yoyIndex[0].index_value) / yoyIndex[0].index_value) * 100).toFixed(2)
        );
      }

      const shouldAutoPublish = qualityScore >= AUTO_PUBLISH_THRESHOLD;

      // Insert the index
      const { data: newIndex, error: indexError } = await supabase
        .from('price_indices')
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
          status: shouldAutoPublish ? 'published' : 'draft',
          published_at: shouldAutoPublish ? new Date().toISOString() : null,
        })
        .select('id')
        .single();

      if (indexError || !newIndex) continue;

      // Insert category breakdowns
      // Get previous month categories for MoM
      const prevCatQuery = prevIndex?.length
        ? await supabase
            .from('price_index_categories')
            .select('category_id, avg_price')
            .eq('index_id', (await supabase
              .from('price_indices')
              .select('id')
              .eq('city', city)
              .eq('state', state)
              .eq('period_start', prevMonthStart.toISOString().slice(0, 10))
              .single()).data?.id)
        : null;

      const prevCatPrices = new Map<string, number>();
      if (prevCatQuery?.data) {
        for (const pc of prevCatQuery.data) {
          prevCatPrices.set(pc.category_id, pc.avg_price);
        }
      }

      for (const [catId, agg] of categoryAggs) {
        const prevCatAvg = prevCatPrices.get(catId);
        let catMom: number | null = null;
        if (prevCatAvg && prevCatAvg > 0) {
          catMom = Number(
            (((agg.avgPrice - prevCatAvg) / prevCatAvg) * 100).toFixed(2)
          );
        }

        await supabase.from('price_index_categories').insert({
          index_id: newIndex.id,
          category_id: catId,
          avg_price: Number(agg.avgPrice.toFixed(2)),
          min_price: Number(agg.minPrice.toFixed(2)),
          max_price: Number(agg.maxPrice.toFixed(2)),
          product_count: agg.productCount,
          mom_change_percent: catMom,
          weight: agg.totalWeight,
        });
      }

      // Insert product-level details
      // Get previous month product prices for MoM
      let prevProductPrices = new Map<string, number>();
      if (prevIndex?.length) {
        const prevIdQuery = await supabase
          .from('price_indices')
          .select('id')
          .eq('city', city)
          .eq('state', state)
          .eq('period_start', prevMonthStart.toISOString().slice(0, 10))
          .single();

        if (prevIdQuery.data) {
          const { data: prevProducts } = await supabase
            .from('price_index_products')
            .select('product_id, avg_price')
            .eq('index_id', prevIdQuery.data.id);

          if (prevProducts) {
            for (const pp of prevProducts) {
              prevProductPrices.set(pp.product_id, pp.avg_price);
            }
          }
        }
      }

      for (const [, agg] of categoryAggs) {
        for (const pd of agg.productDetails) {
          const prevAvg = prevProductPrices.get(pd.productId);
          let prodMom: number | null = null;
          if (prevAvg && prevAvg > 0) {
            prodMom = Number(
              (((pd.avgPrice - prevAvg) / prevAvg) * 100).toFixed(2)
            );
          }

          await supabase.from('price_index_products').insert({
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

      indicesCreated++;
    }

    return json({ indices: indicesCreated, period: periodStartStr });
  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});

function computeQualityScore(params: {
  productCount: number;
  totalPossibleProducts: number;
  snapshotCount: number;
  totalDays: number;
  storeCount: number;
  categoryCount: number;
}): number {
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

function json(data: unknown): Response {
  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json' },
  });
}
