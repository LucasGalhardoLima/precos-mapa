import { SupabaseClient } from "@supabase/supabase-js";

// `unidades?` must precede `un` in the alternation — "Unidades" would
// otherwise satisfy the shorter `un` branch up to the `\b` check, which
// fails mid-word and forces a backtrack; listing the longer form first
// avoids relying on that. Without it, pack-count phrasing ("Bandeja C/20
// Unidades", "com 10 unidades") extracted no size token at all, so
// different-count products could pass the size-compatibility check as
// merge candidates — see the Jaú Serve trial run that mismatched a 10-egg
// and a 20-egg carton this way.
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
 * Reject a match only when both EANs are non-null and differ. Unlike brand
 * (which the composite confidence already soft-weights), a differing real
 * EAN is a hard signal these are different physical products no matter how
 * similar the names are — e.g. two wine flavors from the same brand+size
 * family. See migration 064 for the data loss this gap caused.
 */
export function isEanCompatible(
  queryEan: string | null | undefined,
  candidateEan: string | null | undefined,
): boolean {
  if (!queryEan || !candidateEan) return true;
  return queryEan.trim() === candidateEan.trim();
}

interface FindOrCreateInput {
  name: string;
  categoryId?: string;
  brand?: string;
  ean?: string;
  referencePrice: number;
  /**
   * When true and this item has no EAN, only reuse an existing product on
   * an exact (normalized) name match — never on fuzzy similarity alone.
   * For scraper callers, which write straight to the DB with no human
   * review: two genuinely different unbranded/no-EAN items (e.g. deli
   * items sold under a near-identical name template, differing only by
   * flavor) can clear the fuzzy threshold easily once brand and size both
   * match. See migration 067 for the pizza-flavor incident this fixes.
   * Left off for PDF-import-family callers, which need fuzzy tolerance for
   * OCR/receipt phrasing variance and already have a lower-stakes safety
   * net (confidence-based flagging for manual review).
   */
  strictNoEanMatch?: boolean;
}

export interface FindOrCreateResult {
  id: string;
  matched: boolean;
  confidence: number;
  isNew: boolean;
}

export async function findOrCreateProduct(
  supabase: SupabaseClient,
  input: FindOrCreateInput,
): Promise<FindOrCreateResult> {
  const normalizedName = input.name.trim().replace(/\s+/g, " ");
  const inputSize = extractSize(normalizedName);

  // 1. Query candidates with brand/category/size scoring
  const { data: candidates } = await supabase.rpc("match_product_for_upsert", {
    query: normalizedName,
    query_brand: input.brand ?? null,
    query_category_id: input.categoryId ?? null,
    query_size_token: inputSize,
  });

  // 2. Pick first size-compatible, brand-compatible match
  for (const match of candidates ?? []) {
    if (match.match_type === "synonym") {
      return { id: match.id, matched: true, confidence: 1.0, isNew: false };
    }
    if (!isBrandCompatible(input.brand, match.brand)) {
      continue;
    }
    if (!isEanCompatible(input.ean, match.ean)) {
      continue;
    }
    if (input.strictNoEanMatch && !input.ean) {
      const candidateNormalized = match.name.trim().replace(/\s+/g, " ").toLowerCase();
      if (candidateNormalized !== normalizedName.toLowerCase()) {
        continue;
      }
    }
    const matchSize = extractSize(match.name);
    const sizesCompatible = !inputSize || !matchSize || inputSize === matchSize;
    if (sizesCompatible) {
      return {
        id: match.id,
        matched: true,
        confidence: match.confidence ?? match.match_score,
        isNew: false,
      };
    }
  }

  // 3. No match — create new product
  const { data, error } = await supabase
    .from("products")
    .insert({
      name: normalizedName,
      category_id: input.categoryId ?? "cat_alimentos",
      brand: input.brand ?? null,
      reference_price: input.referencePrice,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      // Concurrent worker created the same product — re-fetch the winner
      const { data: existing } = await supabase
        .from("products")
        .select("id")
        .eq("name", normalizedName)
        .maybeSingle();
      if (existing) return { id: existing.id, matched: true, confidence: 0.95, isNew: false };
    }
    throw new Error(`Erro ao criar produto: ${error.message}`);
  }
  if (!data) throw new Error("Erro ao criar produto: desconhecido");

  // Fire-and-forget Cosmos enrichment for new products
  enrichProductFromCosmos(supabase, data.id, input.name, input.brand ?? null).catch(() => {});

  return { id: data.id, matched: false, confidence: 1.0, isNew: true };
}

interface CosmosProduct {
  gtin:        string | number;
  description: string;
  brand?:      { name: string };
  thumbnail?:  string;
  avg_price?:  number;
}

function pickBestCosmosMatch(
  results: CosmosProduct[],
  productName: string,
  brand: string | null,
): CosmosProduct | null {
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, ' ').trim();
  const nameLower = normalize(productName);

  let best: CosmosProduct | null = null;
  let bestScore = 0;

  for (const r of results) {
    // Disqualify if size tokens are present and differ — avoids matching wrong volume variant
    const inputSize = extractSize(productName);
    const rSize = extractSize(r.description);
    if (inputSize && rSize && inputSize !== rSize) continue;

    const rName = normalize(r.description);
    // Simple overlap score: count shared words
    const nameWords = new Set(nameLower.split(' ').filter(Boolean));
    const rWords = rName.split(' ').filter(Boolean);
    const overlap = rWords.filter(w => nameWords.has(w)).length;
    const score = overlap / Math.max(nameWords.size, rWords.length, 1);

    // Brand bonus
    const brandBonus = brand && r.brand?.name &&
      normalize(r.brand.name).includes(normalize(brand)) ? 0.2 : 0;

    const total = score + brandBonus;
    if (total > bestScore && total > 0.3) {
      best = r;
      bestScore = total;
    }
  }

  return best;
}

export async function enrichProductFromCosmos(
  supabase: SupabaseClient,
  productId: string,
  productName: string,
  brand: string | null,
): Promise<void> {
  const cosmosToken = process.env.COSMOS_API_TOKEN;
  if (!cosmosToken) return;

  try {
    const res = await fetch(
      `https://api.cosmos.bluesoft.com.br/products?query=${encodeURIComponent(productName)}&per_page=5`,
      {
        headers: {
          'X-Cosmos-Token': cosmosToken,
          'User-Agent': 'Cosmos-API-Request',
          'Content-Type': 'application/json',
        },
      }
    );

    if (!res.ok) return;

    const data = await res.json();
    const results: CosmosProduct[] = Array.isArray(data) ? data : (data.products ?? []);
    if (results.length === 0) return;

    // Pick the best match: highest name similarity, filter by brand if provided
    const match = pickBestCosmosMatch(results, productName, brand);
    if (!match) return;

    if (!match.gtin || match.gtin === 0) return;

    const updates: Record<string, unknown> = {
      ean:              String(match.gtin),
      image_url:        match.thumbnail ?? null,
      cosmos_synced_at: new Date().toISOString(),
    };
    if (match.avg_price && match.avg_price > 0) {
      updates.reference_price = match.avg_price;
    }

    await supabase
      .from('products')
      .update(updates)
      .eq('id', productId)
      .is('ean', null); // only update if EAN not already set
  } catch {
    // Cosmos enrichment is best-effort — never fail the import
  }
}
