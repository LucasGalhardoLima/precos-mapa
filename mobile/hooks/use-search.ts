import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

// Raw shape of one row inside search_products_with_prices' jsonb array
// (supabase/migrations/072_hide_promotions_from_consumer_app.sql, the
// current definition — tier order crawler > crowdsourced > reference-only >
// nothing, already sorted best-first).
export interface RawPriceEntry {
  store_id: string;
  store_name: string;
  price: number;
}

// Exported for use-tracked-summary.ts, which reuses mapSearchRow for its
// generic-item branch rather than duplicating the winner-selection logic.
export interface RawSearchRow {
  product_id: string;
  product_name: string;
  brand: string | null;
  image_url: string | null;
  has_active_price: boolean;
  cheapest_price: number | null;
  prices: RawPriceEntry[];
}

export interface SearchResult {
  productId: string;
  name: string;
  brand: string | null;
  imageUrl: string | null;
  // Never render reference_price as if it were today's — has_active_price
  // false means no live price, "sem preço hoje" (mobile/CLAUDE.md "Frescor").
  hasPriceToday: boolean;
  price: number | null;
  winnerStoreName: string | null;
  // Comparação entre mercados só com EAN (decisão 3) — the data layer
  // already enforces this at product-dedup time, so ">1 store priced" is
  // sufficient here to tell "menor no X" from "só no X".
  singleStore: boolean;
}

// Exported for direct unit testing, same pattern as use-analytics.ts's
// resolveTrackedRegion — real logic under test, not a hand-copied replica.
export function mapSearchRow(row: RawSearchRow): SearchResult {
  if (!row.has_active_price || row.cheapest_price == null) {
    return {
      productId: row.product_id,
      name: row.product_name,
      brand: row.brand,
      imageUrl: row.image_url,
      hasPriceToday: false,
      price: null,
      winnerStoreName: null,
      singleStore: row.prices.length <= 1,
    };
  }
  const winner = row.prices.find((p) => p.price === row.cheapest_price) ?? row.prices[0];
  return {
    productId: row.product_id,
    name: row.product_name,
    brand: row.brand,
    imageUrl: row.image_url,
    hasPriceToday: true,
    price: row.cheapest_price,
    winnerStoreName: winner?.store_name ?? null,
    singleStore: row.prices.length <= 1,
  };
}

export function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

interface UseSearchParams {
  query: string;
  userLat: number | null;
  userLng: number | null;
  pageSize?: number;
}

// Powers Resultado (esboços 5a–5c) via search_products_with_prices. 200ms
// debounce, 2-char minimum (matches the RPC's own floor — shorter queries
// return '[]' server-side).
export function useSearch({ query, userLat, userLng, pageSize = 30 }: UseSearchParams) {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((a) => a + 1), []);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setIsSearching(false);
      setError(null);
      return;
    }

    setIsSearching(true);
    let cancelled = false;

    const timer = setTimeout(async () => {
      const { data, error: rpcErr } = await supabase.rpc('search_products_with_prices', {
        query: trimmed,
        user_lat: userLat,
        user_lng: userLng,
        page_size: pageSize,
      });

      if (cancelled) return;

      if (rpcErr) {
        setError(new Error(rpcErr.message));
        setResults([]);
      } else {
        setError(null);
        setResults(((data as RawSearchRow[] | null) ?? []).map(mapSearchRow));
      }
      setIsSearching(false);
    }, 200);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, userLat, userLng, pageSize, attempt]);

  return { results, isSearching, error, retry };
}
