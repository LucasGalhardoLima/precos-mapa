// Shared product resolution for scan-created products — used by NFC-e
// receipt scan (Mode B, via sefaz-nfce-fetch/persist.ts) to resolve a
// scraped line-item description to a catalog product. This is a Deno port
// of src/lib/product-match.ts's fuzzy-match + create logic (the same code
// path the PDF-import cron and publish-import route use), so scan-created
// products reuse the exact same dedup mechanism instead of a second,
// colliding one. Keep the matching/creation logic here in sync with
// src/lib/product-match.ts if either changes.

// Kept in sync with src/lib/product-match.ts's SIZE_REGEX — see its comment
// for why `unidades?` must precede `un` in the alternation.
const SIZE_REGEX = /(\d+(?:[.,]\d+)?)\s*(ml|l|g|kg|unidades?|un|pct|pack|dz|cx|bd)\b/i;

/** Extract normalized size token: "350ml", "2l", "5kg", etc. */
export function extractSize(name: string): string | null {
  const m = name.match(SIZE_REGEX);
  if (!m) return null;
  return (m[1] + m[2]).toLowerCase();
}

/**
 * Reject a match only when both brands are non-null and clearly differ.
 * Returns true (compatible) when either side is missing — the matcher's
 * composite confidence already de-weights null/null and null/non-null cases.
 */
export function isBrandCompatible(
  queryBrand: string | null | undefined,
  candidateBrand: string | null | undefined,
): boolean {
  if (!queryBrand || !candidateBrand) return true;
  return queryBrand.trim().toLowerCase() === candidateBrand.trim().toLowerCase();
}

/**
 * Reject a match only when both EANs are non-null and differ. Currently a
 * no-op here since no caller of this file populates FindOrCreateInput.ean
 * (a receipt scan's "looks like an EAN" code is too low-confidence to trust
 * — see the create-path comment below), but kept in sync with the same
 * guard in src/lib/product-match.ts per this file's header contract.
 */
export function isEanCompatible(
  queryEan: string | null | undefined,
  candidateEan: string | null | undefined,
): boolean {
  if (!queryEan || !candidateEan) return true;
  return queryEan.trim() === candidateEan.trim();
}

const GROCERY_ACRONYMS = new Set(['UHT', 'PC', 'UN', 'CX', 'LT', 'SC', 'PT']);

export function toTitleCase(str: string): string {
  return str
    .split(/\s+/)
    .map((word) => {
      if (GROCERY_ACRONYMS.has(word.toUpperCase())) return word.toUpperCase();
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

// deno-lint-ignore no-explicit-any
export interface MinimalSupabaseClient {
  // deno-lint-ignore no-explicit-any
  from(table: string): any;
  // deno-lint-ignore no-explicit-any
  rpc(fn: string, args: Record<string, unknown>): any;
}

export interface FindOrCreateInput {
  name: string;
  categoryId?: string;
  brand?: string | null;
  ean?: string | null;
  referencePrice?: number | null;
}

export interface FindOrCreateResult {
  id: string;
  /** Resolved product's canonical name — the actual matched/created row's name, not just the input's normalized text (they can differ when a match is reused). */
  name: string;
  matched: boolean;
  isNew: boolean;
}

interface MatchCandidate {
  id: string;
  name: string;
  brand: string | null;
  ean: string | null;
  match_type: string;
  match_score: number;
  confidence: number;
}

export async function findOrCreateProduct(
  supabase: MinimalSupabaseClient,
  input: FindOrCreateInput,
): Promise<FindOrCreateResult> {
  const normalizedName = toTitleCase(input.name.trim().replace(/\s+/g, ' '));
  const inputSize = extractSize(normalizedName);

  const { data: candidates } = await supabase.rpc('match_product_for_upsert', {
    query: normalizedName,
    query_brand: input.brand ?? null,
    query_category_id: input.categoryId ?? null,
    query_size_token: inputSize,
  });

  for (const match of (candidates ?? []) as MatchCandidate[]) {
    if (match.match_type === 'synonym') {
      return { id: match.id, name: match.name, matched: true, isNew: false };
    }
    if (!isBrandCompatible(input.brand, match.brand)) continue;
    if (!isEanCompatible(input.ean, match.ean)) continue;
    const matchSize = extractSize(match.name);
    const sizesCompatible = !inputSize || !matchSize || inputSize === matchSize;
    if (sizesCompatible) {
      return { id: match.id, name: match.name, matched: true, isNew: false };
    }
  }

  // No match — create a new product, same shape as findOrCreateProduct in
  // src/lib/product-match.ts (name/category/brand/reference_price only; ean
  // is deliberately never set here — a scraped receipt item's "looks like an
  // EAN" code is too low-confidence to write into the shared catalog).
  const { data, error } = await supabase
    .from('products')
    .insert({
      name: normalizedName,
      category_id: input.categoryId ?? 'cat_alimentos',
      brand: input.brand ?? null,
      reference_price: input.referencePrice ?? null,
    })
    .select('id')
    .single();

  if (error) {
    if (error.code === '23505') {
      // Concurrent caller created the same product — re-fetch the winner.
      const { data: existing } = await supabase
        .from('products')
        .select('id, name')
        .eq('name', normalizedName)
        .maybeSingle();
      if (existing) return { id: existing.id, name: existing.name, matched: true, isNew: false };
    }
    throw new Error(`Erro ao criar produto: ${error.message}`);
  }
  if (!data) throw new Error('Erro ao criar produto: desconhecido');

  // Learn this exact phrasing as a synonym for the product we just created,
  // so the next receipt using the same short/abbreviated description (very
  // common — many stores share the same POS/ERP vendor and print near-
  // identical item text) hits the RPC's synonym fast-path (confidence 1.0)
  // instead of re-running fuzzy matching, which can miss a real match when
  // wording varies (e.g. "Suco Fruit Shoot 150ml" vs. the catalog's
  // "Bebida Mista Fruit Shoot Maguary 150ml" — same product, similarity
  // score too low to clear the fuzzy threshold) and silently create another
  // near-duplicate product. Never done for a *matched* (non-new) product:
  // a fuzzy match is a guess, and baking a wrong guess in as a permanent
  // synonym would entrench it instead of just risking it once.
  // Awaited (not fire-and-forget) — a Deno edge function isolate can be torn
  // down as soon as the response is sent, so an un-awaited call here could
  // get cut off before the insert actually reaches Postgres.
  try {
    await supabase.from('product_synonyms').insert({ term: normalizedName, product_id: data.id });
  } catch {
    // best-effort — a term collision or transient error here is harmless to ignore
  }

  return { id: data.id, name: normalizedName, matched: false, isNew: true };
}
