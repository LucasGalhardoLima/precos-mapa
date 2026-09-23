// Single source of truth for "the 4 Matão chains" — was duplicated between
// use-market-freshness.ts and use-stores.ts; now also needed by
// lib/resposta.ts (ONDE groups by chain, not physical branch). Moved here
// so a lib/*.ts (no I/O) can depend on it without importing a hooks/*.ts file.

export interface ChainMatch {
  label: string;
  match: { name: string } | { chain: string };
}

// `stores.chain` is null for the two single-location entries (Savegnago,
// Jaú Serve), so those match by exact store name; the two multi-location
// chains (Tenda, Amarelinha) match by their `chain` column instead.
export const MATAO_CHAINS: readonly ChainMatch[] = [
  { label: 'Savegnago', match: { name: 'Savegnago' } },
  { label: 'Jaú Serve', match: { name: 'Jaú Serve' } },
  { label: 'Tenda', match: { chain: 'Tenda Atacado' } },
  { label: 'Amarelinha', match: { chain: 'Amarelinha Supermercados' } },
] as const;

export const MATAO_CHAIN_LABELS = MATAO_CHAINS.map((c) => c.label);
export const MATAO_CHAIN_COUNT = MATAO_CHAINS.length;

// Which of the 4 chains a specific physical location's name belongs to.
// store_name from get_product_prices/store_prices joins only ever carries
// the specific location's own name ("Amarelinha Loja 21 Flamboyant",
// "Tenda Atacado - Matão"), never a chain id — a prefix match against each
// label is enough, verified against every real store_name seen live
// 2026-09-23 (all 4 chains' locations start with their own chain label).
export function chainLabelForStore(storeName: string): string | null {
  for (const c of MATAO_CHAINS) {
    if (storeName.startsWith(c.label)) return c.label;
  }
  return null;
}
