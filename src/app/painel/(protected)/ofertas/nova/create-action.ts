"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase-server";
import { findOrCreateProduct } from "@/lib/product-match";

interface CreateOfferInput {
  storeId: string;
  productName: string;
  brand: string;
  category: string;
  unit: string;
  promoPrice: number;
  originalPrice: number;
  endDate: string;
  note: string;
}

export async function createOffer(
  input: CreateOfferInput,
): Promise<{ error?: string }> {
  const supabase = await createClient();

  if (input.promoPrice >= input.originalPrice) {
    return { error: "Preco promocional deve ser menor que o preco de referencia" };
  }

  // Resolve category
  const { data: cat } = await supabase
    .from("categories")
    .select("id")
    .ilike("name", input.category)
    .limit(1)
    .maybeSingle();

  // Find or create the product via fuzzy matching + size guard
  let productId: string;
  try {
    const { id } = await findOrCreateProduct(supabase, {
      name: input.productName,
      categoryId: cat?.id ?? undefined,
      brand: input.brand || undefined,
      referencePrice: input.originalPrice,
    });
    productId = id;
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erro ao criar produto" };
  }

  const now = new Date().toISOString();
  const { error } = await supabase.from("promotions").insert({
    store_id: input.storeId,
    product_id: productId,
    original_price: input.originalPrice,
    promo_price: input.promoPrice,
    start_date: now,
    end_date: new Date(input.endDate + "T23:59:59Z").toISOString(),
    source: "manual",
    status: "active",
  });

  if (error) {
    return { error: "Erro ao criar oferta: " + error.message };
  }

  revalidatePath("/painel/ofertas");
  return {};
}
