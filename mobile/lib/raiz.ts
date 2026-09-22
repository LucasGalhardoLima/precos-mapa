import type { TrackedRow } from '@/hooks/use-tracked-summary';
import type { RawSearchRow } from '@/hooks/use-search';

function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase();
}

// A generic item's category search (e.g. "Arroz") ranks by price tier, not
// text relevance — verified live 2026-09-22: querying "Arroz" with a small
// page returns dog food ("Dog Chow Cordeiro E Arroz") ahead of actual rice,
// because "arroz" is a listed ingredient in the pet food's own name and it
// happens to be cheaper. Every real rice result in that same response
// (Arroz Branco Camil, Arroz Solito, ...) starts with the label; every false
// positive doesn't. Requiring a name-starts-with match is a real filter, not
// a guess — it's what actually distinguished them in the live data.
// Returns null rather than a wrong product when nothing qualifies: an
// honest "sem preço hoje" beats a confident wrong price.
export function pickGenericWinner(rows: RawSearchRow[], label: string): RawSearchRow | null {
  const target = normalize(label);
  return rows.find((r) => normalize(r.product_name).startsWith(target)) ?? null;
}

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
