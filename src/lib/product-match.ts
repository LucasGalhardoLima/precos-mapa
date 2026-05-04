import { SupabaseClient } from "@supabase/supabase-js";

const SIZE_REGEX = /(\d+(?:[.,]\d+)?)\s*(ml|l|g|kg|un|pct|pack|dz|cx|bd)\b/i;

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

interface FindOrCreateInput {
  name: string;
  categoryId?: string;
  brand?: string;
  referencePrice: number;
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

  if (error || !data) {
    throw new Error(
      `Erro ao criar produto: ${error?.message ?? "desconhecido"}`,
    );
  }

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
