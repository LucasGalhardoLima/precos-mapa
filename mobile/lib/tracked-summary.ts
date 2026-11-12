import { formatBRL, mapSearchRow, type RawSearchRow, type RawPriceEntry } from '@/hooks/use-search';
import type { TrackedRow } from '@/hooks/use-tracked-summary';
import { displayProductName, formatSize } from '@/lib/onboarding';
import { pickGenericWinner } from '@/lib/raiz';

// Raiz's "Seus itens": one TrackedRow per tracked_items row, same source as
// Ajustes. Pure resolution lives here; the hook only injects the Supabase
// calls.

// Wide enough that the label's actual category products (price-ordered
// within their tier) are reliably present alongside any irrelevant
// ingredient-mention matches ranked ahead of them by price — see
// pickGenericWinner for the concrete case this covers.
export const GENERIC_SEARCH_PAGE_SIZE = 15;

// tracked_items row joined with its product (null for generic rows).
export interface TrackedRecordWithProduct {
  id: string;
  product_id: string | null;
  category_label: string | null;
  category_size: string | null;
  products: { name: string; size_value: number | null; size_unit: string | null } | null;
}

export interface SummaryFetchers {
  productPrices(productId: string): Promise<RawPriceEntry[]>;
  genericSearch(label: string): Promise<RawSearchRow[]>;
}

export async function resolveTrackedRow(rec: TrackedRecordWithProduct, fetch: SummaryFetchers): Promise<TrackedRow> {
  if (rec.product_id) {
    const prices = await fetch.productPrices(rec.product_id);
    const winner = prices[0] ?? null;
    const p = rec.products;
    const size = p && p.size_value != null && p.size_unit ? formatSize(p.size_value, p.size_unit) : null;
    return {
      key: rec.id,
      productId: rec.product_id,
      name: p ? displayProductName(p.name, size) : '',
      size,
      hasPriceToday: !!winner,
      priceLabel: winner ? formatBRL(winner.price) : '—',
      winnerStoreName: winner?.store_name ?? null,
    };
  }

  const label = rec.category_label ?? '';
  const rawRow = pickGenericWinner(await fetch.genericSearch(label), label);
  if (!rawRow) {
    return { key: rec.id, productId: null, name: label, size: rec.category_size, hasPriceToday: false, priceLabel: '—', winnerStoreName: null };
  }
  const result = mapSearchRow(rawRow);
  return {
    key: rec.id,
    productId: result.productId,
    name: result.name,
    // Not the category's default size here: the resolved product is whichever
    // size actually won today, and appending the default ("5 kg" for any
    // "Arroz") produced "Arroz Branco Camil Tipo 1 1kg · 5 kg" — a wrong
    // number, not just a redundant one. The catalog name carries its own size.
    size: null,
    hasPriceToday: result.hasPriceToday,
    priceLabel: result.hasPriceToday && result.price != null ? formatBRL(result.price) : '—',
    winnerStoreName: result.winnerStoreName,
  };
}

export interface SummaryDeps extends SummaryFetchers {
  // null = no session (nobody tracked anything); throws on a failed read.
  listTracked(): Promise<TrackedRecordWithProduct[] | null>;
}

export type SummaryResult = { ok: true; rows: TrackedRow[] } | { ok: false };

// No session is a real empty list; a failed read is NOT empty (the screen
// must not claim "no items" because our request failed). One row failing to
// price degrades only that row to "sem preço hoje".
export async function loadTrackedSummary(deps: SummaryDeps): Promise<SummaryResult> {
  let records: TrackedRecordWithProduct[] | null;
  try {
    records = await deps.listTracked();
  } catch {
    return { ok: false };
  }
  if (!records) return { ok: true, rows: [] };
  const rows = await Promise.all(
    records.map((rec) =>
      resolveTrackedRow(rec, deps).catch(
        (): TrackedRow => ({
          key: rec.id,
          productId: rec.product_id,
          name: rec.products ? displayProductName(rec.products.name, null) : (rec.category_label ?? ''),
          size: null,
          hasPriceToday: false,
          priceLabel: '—',
          winnerStoreName: null,
        }),
      ),
    ),
  );
  return { ok: true, rows };
}
