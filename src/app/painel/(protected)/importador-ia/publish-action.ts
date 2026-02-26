"use server";

import { revalidatePath } from "next/cache";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase-server";
import { requirePermission } from "@/features/auth/session";
import { findOrCreateProduct } from "@/lib/product-match";

const supabaseAdmin = createSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

interface ProductInput {
  name: string;
  price: number;
  original_price?: number;
  unit: string;
  validity: string | null;
  category_id?: string;
}

interface AccuracyData {
  accuracyPercent: number;
  totalAiProducts: number;
  totalManualProducts: number;
  totalDeletedProducts: number;
}

interface PublishInput {
  storeId: string;
  products: ProductInput[];
  accuracyData?: AccuracyData;
}

export async function publishImportAction(
  input: PublishInput,
): Promise<{ count: number; error?: string }> {
  await requirePermission("importer:use");

  if (!input.storeId) {
    return { count: 0, error: "ID do mercado e obrigatorio." };
  }

  if (input.products.length === 0) {
    return { count: 0, error: "Nenhum produto para publicar." };
  }

  // Get authenticated user ID for created_by / imported_by
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const userId = user?.id ?? null;

  // Ensure required categories exist
  const CATEGORY_DEFAULTS: Record<string, { name: string; icon: string; sort_order: number }> = {
    cat_alimentos: { name: "Alimentos", icon: "wheat", sort_order: 0 },
    cat_bebidas: { name: "Bebidas", icon: "cup-soda", sort_order: 1 },
    cat_limpeza: { name: "Limpeza", icon: "spray-can", sort_order: 2 },
    cat_hortifruti: { name: "Hortifruti", icon: "apple", sort_order: 3 },
    cat_padaria: { name: "Padaria", icon: "croissant", sort_order: 4 },
    cat_higiene: { name: "Higiene", icon: "sparkles", sort_order: 5 },
  };

  const usedCategoryIds = new Set(
    input.products.map((p) => p.category_id ?? "cat_alimentos"),
  );

  for (const catId of usedCategoryIds) {
    const defaults = CATEGORY_DEFAULTS[catId];
    if (!defaults) continue;

    const { data: catCheck } = await supabaseAdmin
      .from("categories")
      .select("id")
      .eq("id", catId)
      .maybeSingle();

    if (!catCheck) {
      await supabaseAdmin.from("categories").insert({
        id: catId,
        ...defaults,
      });
    }
  }

  const now = new Date().toISOString();
  let published = 0;
  const errors: string[] = [];

  for (const product of input.products) {
    // Find or create product via fuzzy matching + size guard
    let productId: string;

    try {
      const { id } = await findOrCreateProduct(supabaseAdmin, {
        name: product.name,
        categoryId: product.category_id ?? "cat_alimentos",
        referencePrice: product.original_price ?? product.price,
      });
      productId = id;
    } catch (err) {
      errors.push(`Produto "${product.name}": ${err instanceof Error ? err.message : "erro desconhecido"}`);
      continue;
    }

    // Calculate end date from validity or +7 days
    let endDate: string;
    if (product.validity) {
      endDate = new Date(product.validity + "T23:59:59Z").toISOString();
    } else {
      const future = new Date();
      future.setDate(future.getDate() + 7);
      endDate = future.toISOString();
    }

    const originalPrice = product.original_price ?? product.price;

    const { error: promoError } = await supabaseAdmin.from("promotions").insert({
      store_id: input.storeId,
      product_id: productId,
      original_price: originalPrice,
      promo_price: product.price,
      start_date: now,
      end_date: endDate,
      source: "importador_ia",
      status: "active",
      created_by: userId,
    });

    if (promoError) {
      errors.push(`Promocao "${product.name}": ${promoError.message}`);
      continue;
    }

    published++;
  }

  // Log accuracy data
  if (input.accuracyData) {
    await supabaseAdmin.from("ai_import_logs").insert({
      store_id: input.storeId,
      accuracy_percent: input.accuracyData.accuracyPercent,
      total_ai_products: input.accuracyData.totalAiProducts,
      total_manual_products: input.accuracyData.totalManualProducts,
      total_deleted_products: input.accuracyData.totalDeletedProducts,
      imported_by: userId,
    });
  }

  revalidatePath("/painel/ofertas");

  if (published === 0 && errors.length > 0) {
    return { count: 0, error: `Falha ao publicar. ${errors[0]}` };
  }

  if (errors.length > 0) {
    return { count: published, error: `${published} publicadas, ${errors.length} falharam. ${errors[0]}` };
  }

  return { count: published };
}
