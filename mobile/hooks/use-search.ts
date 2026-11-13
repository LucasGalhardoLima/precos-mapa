import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { daysAgo, isStale } from '@/lib/resposta';

// Raw shape of one row inside search_products_with_prices' jsonb array
// (supabase/migrations/072_hide_promotions_from_consumer_app.sql, the
// current definition — tier order crawler > crowdsourced > reference-only >
// nothing, already sorted best-first).
export interface RawPriceEntry {
  store_id: string;
  store_name: string;
  price: number;
  // Both RPCs emit it (migration 072); optional so a row without it is read
  // as undated rather than crashing — see isFreshEntry.
  last_price_date?: string;
}

// mobile/CLAUDE.md "Frescor": >3 days is never today's price. The RPCs apply
// no (crawler) or a 14-day (crowdsourced) cutoff, so the client enforces the
// same rule the Resposta uses. An entry with no date can't be shown as
// today's, so it is treated as stale.
export function isFreshEntry(p: RawPriceEntry): boolean {
  if (!p.last_price_date) return false;
  const days = daysAgo(p.last_price_date);
  // An unparseable date yields NaN, and isStale(NaN) is false — don't let it pass as fresh.
  return !Number.isNaN(days) && !isStale(days);
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
  const base = { productId: row.product_id, name: row.product_name, brand: row.brand, imageUrl: row.image_url };
  // Recomputed from fresh entries only: the RPC's cheapest_price and
  // has_active_price also count stale rows (and the reference price).
  const fresh = row.has_active_price && row.cheapest_price != null ? row.prices.filter(isFreshEntry) : [];
  if (fresh.length === 0) {
    return { ...base, hasPriceToday: false, price: null, winnerStoreName: null, singleStore: row.prices.length <= 1 };
  }
  const winner = fresh.reduce((best, p) => (p.price < best.price ? p : best));
  return { ...base, hasPriceToday: true, price: winner.price, winnerStoreName: winner.store_name, singleStore: fresh.length <= 1 };
}

// "Sem preço hoje" goes to the end of the list (docs/poup-mlp-decisoes.md,
// Resultado 5a–5c). The RPC orders by tier on rows that may only be stale, so
// once stale prices are dropped a no-price row can outrank priced ones.
// Stable: Array.prototype.sort keeps the RPC order within each group.
export function sortPricedFirst(results: SearchResult[]): SearchResult[] {
  return [...results].sort((a, b) => Number(b.hasPriceToday) - Number(a.hasPriceToday));
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

export type SearchOutcome = { results: SearchResult[]; error: null } | { results: []; error: Error };

const RETRY_DELAY_MS = 400;

// Never throws. A failed attempt (dropped request, 5xx, statement timeout, or a
// rejected promise) is retried once after a short pause, silently: "Sem conexão"
// only appears if the second attempt fails too. Before this, one transient blip
// showed the offline state with the network fine, and a rejection left the
// screen on "searching" forever. All errors are retried alike — the RPC is a
// read-only, idempotent search, so a retry is harmless even for a real 4xx.
// shortcut: no error classification (4xx retried too) — upgrade: skip the retry
// for non-network/non-5xx codes if the extra ~400ms on a real failure matters.
export async function runSearch(
  call: () => PromiseLike<{ data: unknown; error: { message: string } | null }>,
  opts: { isCancelled?: () => boolean } = {},
): Promise<SearchOutcome> {
  const attempt = async (): Promise<SearchOutcome> => {
    try {
      const { data, error } = await call();
      if (error) return { results: [], error: new Error(error.message) };
      return { results: sortPricedFirst(((data as RawSearchRow[] | null) ?? []).map(mapSearchRow)), error: null };
    } catch (e) {
      return { results: [], error: e instanceof Error ? e : new Error(String(e)) };
    }
  };

  const first = await attempt();
  if (!first.error || opts.isCancelled?.()) return first;
  await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
  if (opts.isCancelled?.()) return first;
  return attempt();
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
    // A new query (or "tentar de novo") must not keep showing the previous
    // query's "Sem conexão" while its own request is in flight.
    setError(null);
    let cancelled = false;

    const timer = setTimeout(async () => {
      const outcome = await runSearch(() =>
        supabase.rpc('search_products_with_prices', {
          query: trimmed,
          user_lat: userLat,
          user_lng: userLng,
          page_size: pageSize,
        }),
        { isCancelled: () => cancelled },
      );

      if (cancelled) return;

      setError(outcome.error);
      setResults(outcome.results);
      setIsSearching(false);
    }, 200);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, userLat, userLng, pageSize, attempt]);

  return { results, isSearching, error, retry };
}
