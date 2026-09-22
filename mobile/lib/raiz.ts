import type { TrackedRow } from '@/hooks/use-tracked-summary';

export interface TitlePhrase {
  winner: string;
  count: number;
  total: number;
}

// "Hoje o {chain} tem o menor preço em N dos seus M itens" (Raiz, artifact
// 2a) — the chain that wins the most tracked rows today. Ties broken by
// Map insertion order (first winner encountered keeps the lead), not by an
// arbitrary re-sort. Null when no row has a price today: nothing to credit
// a store with, per mobile/CLAUDE.md's "nunca mostrar preço velho" spirit
// extended to not crediting a market win that didn't happen.
export function computeTitlePhrase(rows: TrackedRow[]): TitlePhrase | null {
  const priced = rows.filter((r) => r.hasPriceToday);
  if (priced.length === 0) return null;

  const tally = new Map<string, number>();
  for (const r of priced) {
    if (!r.winnerStoreName) continue;
    tally.set(r.winnerStoreName, (tally.get(r.winnerStoreName) ?? 0) + 1);
  }

  let winner: string | null = null;
  let winnerCount = 0;
  for (const [name, count] of tally) {
    if (count > winnerCount) {
      winner = name;
      winnerCount = count;
    }
  }

  return winner ? { winner, count: winnerCount, total: rows.length } : null;
}
