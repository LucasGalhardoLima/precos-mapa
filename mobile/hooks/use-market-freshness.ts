import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

// The 4 documented Matão chains (docs/poup-mlp-decisoes.md: "4 redes em
// Matão (Savegnago, Jaú Serve, Tenda, Amarelinha)"). Verified live 2026-09-22:
// `stores` filtered to city='Matão' alone returns 13 rows, not 4 — it also
// holds independents (Mortari, Paulista, Simoni, São Lucas, Milla's) this
// MLP was never built around. `chain` is null for the two single-location
// entries (Savegnago, Jaú Serve), so this matches by name for those and by
// chain for the two multi-location ones, rather than by city.
// Exported (not just the derived labels/count below) so use-stores.ts can
// reuse the exact same 4-chain filter for the "trocar" store picker instead
// of redefining it — single source of truth for "what are the 4 chains".
export const MATAO_CHAINS = [
  { label: 'Savegnago', match: { name: 'Savegnago' } },
  { label: 'Jaú Serve', match: { name: 'Jaú Serve' } },
  { label: 'Tenda', match: { chain: 'Tenda Atacado' } },
  { label: 'Amarelinha', match: { chain: 'Amarelinha Supermercados' } },
] as const;

export const MATAO_CHAIN_LABELS = MATAO_CHAINS.map((c) => c.label);
export const MATAO_CHAIN_COUNT = MATAO_CHAINS.length;

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
