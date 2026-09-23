import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { MATAO_CHAINS, MATAO_CHAIN_LABELS, MATAO_CHAIN_COUNT } from '@/lib/chains';

// Re-exported for existing callers (app/index.tsx, use-stores.ts) — the
// definition itself now lives in lib/chains.ts, the single source of truth
// also used by lib/resposta.ts (ONDE groups by chain).
export { MATAO_CHAINS, MATAO_CHAIN_LABELS, MATAO_CHAIN_COUNT };

// "preços de hoje, 03:00 · N de 4 mercados" (Raiz, artifact 2a) — N is how
// many of the 4 chains have a store_prices row from today, not from any
// tracked item specifically: a market-wide freshness fact, per mobile/
// CLAUDE.md's "Frescor" rule (never show a stale round as if it were today's).
export function useMarketFreshness() {
  const [freshCount, setFreshCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const today = new Date().toISOString().slice(0, 10);
      const results = await Promise.all(
        MATAO_CHAINS.map(async (chain) => {
          let query = supabase.from('stores').select('id').eq('city', 'Matão');
          query = 'chain' in chain.match ? query.eq('chain', chain.match.chain) : query.eq('name', chain.match.name);
          const { data: stores } = await query;
          const ids = (stores ?? []).map((s) => s.id as string);
          if (ids.length === 0) return false;

          const { data: prices } = await supabase
            .from('store_prices')
            .select('updated_at')
            .in('store_id', ids)
            .gte('updated_at', `${today}T00:00:00Z`)
            .limit(1);
          return (prices?.length ?? 0) > 0;
        }),
      );
      if (!cancelled) setFreshCount(results.filter(Boolean).length);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return freshCount;
}
