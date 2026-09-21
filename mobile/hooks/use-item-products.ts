import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
  parseDefaultSize,
  nameVariants,
  formatSize,
  type GenericItem,
  type PinnedProduct,
} from '../lib/onboarding';

// Teto da folha "escolher tipo" (esboço 8b): limite de carga, não promessa.
export const SHEET_LIMIT = 8;

export type ItemProductsStatus = 'idle' | 'loading' | 'ready' | 'error';

// Products of a generic item's category at its default size, for the
// onboarding "escolher tipo" sheet. Reads `products` directly instead of the
// search_products_with_prices RPC: the RPC returns neither size nor EAN, and
// it orders by cheapest price behind a page limit, so filtering its first page
// by size would usually leave the sheet empty (a 5 kg pack is never among the
// cheapest "arroz"). Ordered by name — the MLP never orders a list by price.
// Only products with an EAN are offered: a pinned item is an item-product.
export function useItemProducts(item: GenericItem | null) {
  const [products, setProducts] = useState<PinnedProduct[]>([]);
  const [status, setStatus] = useState<ItemProductsStatus>('idle');
  const [attempt, setAttempt] = useState(0);

  const label = item?.label;
  const defaultSize = item?.size;

  useEffect(() => {
    if (!label || !defaultSize) {
      setProducts([]);
      setStatus('idle');
      return;
    }

    let cancelled = false;
    setStatus('loading');

    (async () => {
      try {
        const size = parseDefaultSize(defaultSize);
        let query = supabase
          .from('products')
          .select('id, name, image_url, ean, size_value, size_unit')
          .or(nameVariants(label).map((v) => `name.ilike.%${v}%`).join(','))
          .not('ean', 'is', null);
        if (size) query = query.eq('size_value', size.value).eq('size_unit', size.unit);

        const { data, error } = await query.order('name').limit(SHEET_LIMIT);
        if (cancelled) return;
        if (error || !data) {
          setProducts([]);
          setStatus('error');
          return;
        }

        setProducts(
          data.map((row) => ({
            id: row.id as string,
            name: row.name as string,
            ean: row.ean as string,
            imageUrl: (row.image_url as string | null) ?? null,
            size: row.size_value != null && row.size_unit ? formatSize(Number(row.size_value), row.size_unit as string) : null,
          })),
        );
        setStatus('ready');
      } catch {
        if (cancelled) return;
        setProducts([]);
        setStatus('error');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [label, defaultSize, attempt]);

  const retry = useCallback(() => setAttempt((a) => a + 1), []);

  return { products, status, retry };
}
