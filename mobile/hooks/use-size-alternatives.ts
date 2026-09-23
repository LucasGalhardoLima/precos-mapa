import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { daysAgo, isStale, normalizeBaseName, type ProductInfo, type SizeCandidate } from '@/lib/resposta';

// QUAL TAMANHO's data side (rule from Lucas, 2026-09-23): same brand + same
// normalized base name (size tokens stripped) + same size_unit, excluding
// the current product, priced today (≤3 days, same rule as ONDE). Two
// queries, not a new RPC — the candidate set for one brand+unit is small
// (a handful of pack sizes, not a full-catalog scan), so this stays cheap
// without inventing SQL-side name normalization.
export function useSizeAlternatives(product: ProductInfo | null) {
  const [candidates, setCandidates] = useState<SizeCandidate[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!product || product.brand == null || product.sizeUnit == null) {
      setCandidates([]);
      return;
    }
    let cancelled = false;
    setIsLoading(true);

    (async () => {
      const { data: siblings } = await supabase
        .from('products')
        .select('id, name, size_value')
        .eq('brand', product.brand)
        .eq('size_unit', product.sizeUnit)
        .neq('id', product.id);

      const targetBase = normalizeBaseName(product.name);
      const matched = (siblings ?? []).filter((s) => s.size_value != null && normalizeBaseName(s.name) === targetBase);

      if (matched.length === 0) {
        if (!cancelled) {
          setCandidates([]);
          setIsLoading(false);
        }
        return;
      }

      const { data: prices } = await supabase
        .from('store_prices')
        .select('product_id, price, updated_at, stores(name)')
        .in(
          'product_id',
          matched.map((m) => m.id),
        );

      const cheapestByProduct = new Map<string, { price: number; storeName: string }>();
      for (const row of prices ?? []) {
        if (isStale(daysAgo(row.updated_at))) continue;
        const existing = cheapestByProduct.get(row.product_id);
        const storeName = (row.stores as unknown as { name: string } | null)?.name ?? '';
        if (!existing || row.price < existing.price) {
          cheapestByProduct.set(row.product_id, { price: row.price, storeName });
        }
      }

      const result: SizeCandidate[] = matched.map((m) => {
        const cheapest = cheapestByProduct.get(m.id);
        return {
          id: m.id,
          name: m.name,
          sizeValue: m.size_value!,
          cheapestPriceToday: cheapest?.price ?? null,
          cheapestStoreName: cheapest?.storeName ?? null,
        };
      });

      if (!cancelled) {
        setCandidates(result);
        setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?.id, product?.brand, product?.sizeUnit, product?.name]);

  return { candidates, isLoading };
}
