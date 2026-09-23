import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { buildRespostaView, type ProductInfo, type RawStorePrice, type RespostaView } from '@/lib/resposta';

interface UseProductOptions {
  productId: string;
  userLat: number | null;
  userLng: number | null;
}

interface UseProductResult {
  view: RespostaView | null;
  product: ProductInfo | null;
  isLoading: boolean;
  error: Error | null;
  retry: () => void;
}

// get_product_prices (migration 072) returns price rows only — no product
// name/ean/image_url/size, so this is a two-read hook: `products` by id,
// composed client-side with the RPC's per-store rows. No single RPC covers
// both (search_products_with_prices is by text, not id, and doesn't return
// ean/size_value/size_unit either) — see [[live_price_scrapers_status]]-style
// investigation notes for why this wasn't invented as a new migration:
// simplest fit for two already-existing, already-indexed reads.
export function useProduct({ productId, userLat, userLng }: UseProductOptions): UseProductResult {
  const [view, setView] = useState<RespostaView | null>(null);
  const [product, setProduct] = useState<ProductInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    (async () => {
      const [productRes, pricesRes] = await Promise.all([
        supabase.from('products').select('id, name, brand, ean, image_url, size_value, size_unit').eq('id', productId).single(),
        supabase.rpc('get_product_prices', { product_id: productId, user_lat: userLat, user_lng: userLng }),
      ]);

      if (cancelled) return;

      if (productRes.error || pricesRes.error) {
        setError(new Error(productRes.error?.message ?? pricesRes.error?.message ?? 'unknown error'));
        setIsLoading(false);
        return;
      }

      const p: ProductInfo = {
        id: productRes.data.id,
        name: productRes.data.name,
        brand: productRes.data.brand,
        ean: productRes.data.ean,
        imageUrl: productRes.data.image_url,
        sizeValue: productRes.data.size_value,
        sizeUnit: productRes.data.size_unit,
      };
      const rows = (pricesRes.data as RawStorePrice[] | null) ?? [];

      setProduct(p);
      setView(buildRespostaView(p, rows));
      setIsLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [productId, userLat, userLng, attempt]);

  return { view, product, isLoading, error, retry: () => setAttempt((a) => a + 1) };
}
