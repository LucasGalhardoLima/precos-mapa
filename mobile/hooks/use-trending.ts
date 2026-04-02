import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export interface TrendingProduct {
  id: string;
  name: string;
  minPrice: number;
  maxPrice: number;
  storeCount: number;
  discountPercent: number;
}

export function useTrending() {
  const [trending, setTrending] = useState<TrendingProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      const { data, error } = await supabase.rpc('get_trending_products', {
        result_limit: 3,
      });

      if (!error && data) {
        setTrending(
          (data as any[]).map((row) => ({
            id: row.id,
            name: row.name,
            minPrice: row.min_price,
            maxPrice: row.max_price,
            storeCount: row.store_count,
            discountPercent: row.discount_pct,
          })),
        );
      }

      // Fallback: direct query if RPC doesn't exist
      if (error) {
        const { data: fallback } = await supabase
          .from('promotions')
          .select('product_id, promo_price, product:products!inner(id, name, reference_price)')
          .eq('status', 'active')
          .gt('end_date', new Date().toISOString())
          .limit(100);

        if (fallback && fallback.length > 0) {
          // Group by product
          const productMap = new Map<string, { name: string; prices: number[]; refPrice: number }>();
          for (const row of fallback as any[]) { // eslint-disable-line @typescript-eslint/no-explicit-any
            const pid = row.product_id as string;
            const entry = productMap.get(pid) ?? {
              name: row.product.name as string,
              prices: [] as number[],
              refPrice: row.product.reference_price as number,
            };
            entry.prices.push(row.promo_price as number);
            productMap.set(pid, entry);
          }

          const items = [...productMap.entries()]
            .map(([id, entry]) => ({
              id,
              name: entry.name,
              minPrice: Math.min(...entry.prices),
              maxPrice: Math.max(...entry.prices),
              storeCount: entry.prices.length,
              discountPercent: Math.round(
                (1 - Math.min(...entry.prices) / entry.refPrice) * 100,
              ),
            }))
            .sort((a, b) => b.storeCount - a.storeCount || b.discountPercent - a.discountPercent)
            .slice(0, 3);

          setTrending(items);
        }
      }

      setIsLoading(false);
    }

    fetch();
  }, []);

  return { trending, isLoading };
}
