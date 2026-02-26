import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Outlier thresholds relative to reference_price
const OUTLIER_LOW_THRESHOLD = 0.3;   // <30% of reference = suspiciously low
const OUTLIER_HIGH_THRESHOLD = 1.5;  // >150% of reference = suspiciously high
const STALE_DAYS = 7;                // No data in 7+ days = stale
const RETENTION_DAYS = 365;          // Keep snapshots for YoY index calculation

interface PromoRow {
  product_id: string;
  promo_price: number;
  original_price: number;
  store_id: string;
}

interface ProductRow {
  id: string;
  name: string;
  reference_price: number | null;
}

serve(async () => {
  try {
    const today = new Date().toISOString().slice(0, 10);

    // Get all products with active promotions
    const { data: activePromos } = await supabase
      .from('promotions')
      .select('product_id, promo_price, original_price, store_id')
      .eq('status', 'active')
      .gt('end_date', new Date().toISOString());

    if (!activePromos?.length) {
      // Run staleness check even with no active promos
      await checkStaleness();

      return new Response(JSON.stringify({ snapshots: 0, flags: 0, message: 'No active promotions' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Group by product_id
    const productMap = new Map<
      string,
      { prices: number[]; stores: Set<string>; promos: PromoRow[] }
    >();

    for (const promo of activePromos as PromoRow[]) {
      const entry = productMap.get(promo.product_id) ?? {
        prices: [],
        stores: new Set(),
        promos: [],
      };
      entry.prices.push(promo.promo_price);
      entry.stores.add(promo.store_id);
      entry.promos.push(promo);
      productMap.set(promo.product_id, entry);
    }

    // Get product reference prices for outlier detection
    const productIds = Array.from(productMap.keys());
    const { data: products } = await supabase
      .from('products')
      .select('id, name, reference_price')
      .in('id', productIds);

    const productLookup = new Map<string, ProductRow>();
    for (const p of (products ?? []) as ProductRow[]) {
      productLookup.set(p.id, p);
    }

    let upsertCount = 0;
    let flagCount = 0;

    for (const [productId, data] of productMap) {
      const minPrice = Math.min(...data.prices);
      const avgPrice = data.prices.reduce((a, b) => a + b, 0) / data.prices.length;
      const storeCount = data.stores.size;

      const { error } = await supabase.from('price_snapshots').upsert(
        {
          product_id: productId,
          date: today,
          min_promo_price: Number(minPrice.toFixed(2)),
          avg_promo_price: Number(avgPrice.toFixed(2)),
          store_count: storeCount,
        },
        { onConflict: 'product_id,date' },
      );

      if (!error) upsertCount++;

      // --- Outlier detection ---
      const product = productLookup.get(productId);
      if (product?.reference_price) {
        const refPrice = product.reference_price;

        for (const promo of data.promos) {
          const ratio = promo.promo_price / refPrice;

          if (ratio < OUTLIER_LOW_THRESHOLD) {
            await insertQualityFlag({
              product_id: productId,
              store_id: promo.store_id,
              flag_type: 'outlier_low',
              severity: ratio < 0.15 ? 'critical' : 'high',
              detail: `Preco promocional R$${promo.promo_price.toFixed(2)} esta ${((1 - ratio) * 100).toFixed(0)}% abaixo do preco de referencia R$${refPrice.toFixed(2)}`,
              reference_value: refPrice,
              actual_value: promo.promo_price,
            });
            flagCount++;
          } else if (ratio > OUTLIER_HIGH_THRESHOLD) {
            await insertQualityFlag({
              product_id: productId,
              store_id: promo.store_id,
              flag_type: 'outlier_high',
              severity: ratio > 2.0 ? 'critical' : 'high',
              detail: `Preco promocional R$${promo.promo_price.toFixed(2)} esta ${((ratio - 1) * 100).toFixed(0)}% acima do preco de referencia R$${refPrice.toFixed(2)}`,
              reference_value: refPrice,
              actual_value: promo.promo_price,
            });
            flagCount++;
          }
        }
      }
    }

    // Update reference_price on products (rolling 30-day avg of min_promo_price)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    for (const [productId] of productMap) {
      const { data: snapshots } = await supabase
        .from('price_snapshots')
        .select('min_promo_price')
        .eq('product_id', productId)
        .gte('date', thirtyDaysAgo.toISOString().slice(0, 10));

      if (snapshots?.length) {
        const refPrice =
          snapshots.reduce((sum: number, s: { min_promo_price: number }) => sum + s.min_promo_price, 0) /
          snapshots.length;

        await supabase
          .from('products')
          .update({ reference_price: Number(refPrice.toFixed(2)) })
          .eq('id', productId);
      }
    }

    // Staleness check
    const staleFlags = await checkStaleness();
    flagCount += staleFlags;

    // Clean up old snapshots (>365 days for YoY index support)
    const retentionDate = new Date();
    retentionDate.setDate(retentionDate.getDate() - RETENTION_DAYS);

    await supabase
      .from('price_snapshots')
      .delete()
      .lt('date', retentionDate.toISOString().slice(0, 10));

    return new Response(
      JSON.stringify({ snapshots: upsertCount, flags: flagCount, date: today }),
      { headers: { 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});

async function insertQualityFlag(flag: {
  product_id: string;
  store_id?: string;
  promotion_id?: string;
  flag_type: string;
  severity: string;
  detail: string;
  reference_value?: number;
  actual_value?: number;
}) {
  // Avoid duplicate flags: check if same product+type+store exists unresolved in last 24h
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  const { data: existing } = await supabase
    .from('price_quality_flags')
    .select('id')
    .eq('product_id', flag.product_id)
    .eq('flag_type', flag.flag_type)
    .eq('is_resolved', false)
    .gte('created_at', yesterday.toISOString())
    .limit(1);

  if (existing?.length) return;

  await supabase.from('price_quality_flags').insert(flag);
}

async function checkStaleness(): Promise<number> {
  const staleDate = new Date();
  staleDate.setDate(staleDate.getDate() - STALE_DAYS);

  // Find products that have had snapshots before but none in the last 7 days
  const { data: allProducts } = await supabase
    .from('products')
    .select('id, name, reference_price');

  if (!allProducts?.length) return 0;

  let staleCount = 0;

  for (const product of allProducts) {
    const { data: recentSnaps } = await supabase
      .from('price_snapshots')
      .select('id')
      .eq('product_id', product.id)
      .gte('date', staleDate.toISOString().slice(0, 10))
      .limit(1);

    // Only flag if product has reference_price (meaning it had data before)
    if ((!recentSnaps || recentSnaps.length === 0) && product.reference_price) {
      await insertQualityFlag({
        product_id: product.id,
        flag_type: 'stale',
        severity: 'medium',
        detail: `Produto "${product.name}" sem dados de preco nos ultimos ${STALE_DAYS} dias`,
        reference_value: product.reference_price,
      });
      staleCount++;
    }
  }

  return staleCount;
}
