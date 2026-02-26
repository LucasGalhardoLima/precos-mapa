import { SupabaseClient } from "@supabase/supabase-js";

const SIZE_REGEX = /(\d+(?:[.,]\d+)?)\s*(ml|l|g|kg|un|pct|pack)\b/i;

/** Extract normalized size token: "350ml", "2l", "5kg", etc. */
function extractSize(name: string): string | null {
  const m = name.match(SIZE_REGEX);
  if (!m) return null;
  return (m[1] + m[2]).toLowerCase();
}

interface FindOrCreateInput {
  name: string;
  categoryId?: string;
  brand?: string;
  referencePrice: number;
}

export async function findOrCreateProduct(
  supabase: SupabaseClient,
  input: FindOrCreateInput,
): Promise<{ id: string; matched: boolean }> {
  const normalizedName = input.name.trim().replace(/\s+/g, " ");
  const inputSize = extractSize(normalizedName);

  // 1. Query candidates: exact synonym + fuzzy name matches
  const { data: candidates } = await supabase.rpc("match_product_for_upsert", {
    query: normalizedName,
  });

  // 2. Pick first size-compatible match
  for (const match of candidates ?? []) {
    if (match.match_type === "synonym") {
      return { id: match.id, matched: true };
    }
    const matchSize = extractSize(match.name);
    const sizesCompatible = !inputSize || !matchSize || inputSize === matchSize;
    if (sizesCompatible) {
      return { id: match.id, matched: true };
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

  return { id: data.id, matched: false };
}
