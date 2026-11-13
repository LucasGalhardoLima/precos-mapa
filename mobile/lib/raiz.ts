import type { TrackedRow } from '@/hooks/use-tracked-summary';
import { mapSearchRow, type RawSearchRow } from '@/hooks/use-search';
import type { SizeFilter } from '@/lib/onboarding';

function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase();
}

// A search row plus the product's normalized size (products.size_value /
// size_unit, base units g/ml/un — migration 074). search_products_with_prices
// does not return the size, so the generic-item fetcher builds these from
// `products` + get_product_prices.
export interface SizedSearchRow extends RawSearchRow {
  size_value: number | null;
  size_unit: string | null;
}

// A generic item is category + default size (docs/poup-mlp-decisoes.md,
// "Item genérico vs. item-produto"): the winner is the cheapest FRESH price
// among products of that size, never a product of another size. A name-prefix
// match alone let "Leite Fermentado Jamava 120g" answer "Leite · 1 L".
// Name prefix stays as the category proxy: a free-text search ranks by price,
// and dog food ("...Cordeiro E Arroz") outranked real rice (verified live
// 2026-09-22); every real hit starts with the label.
// Products without a normalized size (~36% of the catalog) are never matched,
// and neither is a generic item whose default size has no parsable form
// (size === null: "kg", "12 rolos"): an honest "sem preço hoje" beats a
// confident wrong price. Matches with only stale prices are returned so the
// row still reads "sem preço hoje" for the right product.
export function pickGenericWinner(rows: SizedSearchRow[], label: string, size: SizeFilter | null): SizedSearchRow | null {
  if (!size) return null;
  const target = normalize(label);
  const matches = rows.filter(
    (r) =>
      normalize(r.product_name).startsWith(target) &&
      r.size_value != null &&
      r.size_unit === size.unit &&
      Number(r.size_value) === size.value,
  );
  let best: SizedSearchRow | null = null;
  let bestPrice = Infinity;
  for (const r of matches) {
    const m = mapSearchRow(r);
    if (m.hasPriceToday && m.price != null && m.price < bestPrice) {
      best = r;
      bestPrice = m.price;
    }
  }
  return best ?? matches[0] ?? null;
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

// What Raiz renders below the header. A failed sync or a failed read with no
// rows is NOT "dia zero": the empty list is our gap, not the user's.
export type RaizBodyState = 'items' | 'loading' | 'sync-pending' | 'read-failed' | 'dia-zero';

export function raizBodyState(input: { rowCount: number; isLoading: boolean; syncFailed: boolean; readFailed: boolean }): RaizBodyState {
  if (input.rowCount > 0) return 'items';
  // Failures outrank loading: a retry flips isLoading back on, and the failure
  // message must not flash back to a blank body while it runs. Sync first:
  // with the sync pending there is nothing for the read to find yet.
  if (input.syncFailed) return 'sync-pending';
  if (input.readFailed) return 'read-failed';
  if (input.isLoading) return 'loading';
  return 'dia-zero';
}
