"use server";

import { revalidatePath } from "next/cache";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase-server";
import { requirePermission } from "@/features/auth/session";
import { findOrCreateProduct } from "@/lib/product-match";
import { normalizeCategory, EncarteProduct } from "@/lib/schemas";

const supabaseAdmin = createSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const CATEGORY_DEFAULTS: Record<string, { name: string; icon: string; sort_order: number }> = {
  cat_alimentos: { name: "Alimentos", icon: "wheat", sort_order: 0 },
  cat_bebidas: { name: "Bebidas", icon: "cup-soda", sort_order: 1 },
  cat_limpeza: { name: "Limpeza", icon: "spray-can", sort_order: 2 },
  cat_hortifruti: { name: "Hortifruti", icon: "apple", sort_order: 3 },
  cat_padaria: { name: "Padaria", icon: "croissant", sort_order: 4 },
  cat_higiene: { name: "Higiene", icon: "sparkles", sort_order: 5 },
};

export async function approveImportPass(
  importId: string,
  passNumber: 1 | 2 | 3,
): Promise<{ count: number; error?: string }> {
  await requirePermission("moderation:manage");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Fetch the import
  const { data: pdfImport, error: fetchError } = await supabaseAdmin
    .from("pdf_imports")
    .select("*")
    .eq("id", importId)
    .single();

  if (fetchError || !pdfImport) {
    return { count: 0, error: "Importacao nao encontrada." };
  }

  if (pdfImport.status !== "needs_review") {
    return { count: 0, error: `Status invalido: ${pdfImport.status}` };
  }

  // Get the selected pass data
  const passKey = `extraction_pass_${passNumber}` as const;
  const passData = pdfImport[passKey] as { products?: unknown } | null;

  if (!passData?.products || !Array.isArray(passData.products)) {
    return { count: 0, error: `Pass ${passNumber} sem produtos validos.` };
  }

  const products = passData.products as EncarteProduct[];

  // Publish products
  const usedCategoryIds = new Set(
    products.map((p: EncarteProduct) => normalizeCategory(p.category)),
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
      await supabaseAdmin.from("categories").insert({ id: catId, ...defaults });
    }
  }

  const now = new Date().toISOString();
  let published = 0;

  for (const product of products) {
    try {
      const { id: productId } = await findOrCreateProduct(supabaseAdmin, {
        name: product.name,
        categoryId: normalizeCategory(product.category),
        referencePrice: product.original_price ?? product.price,
      });

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
        store_id: pdfImport.store_id,
        product_id: productId,
        original_price: originalPrice,
        promo_price: product.price,
        start_date: now,
        end_date: endDate,
        source: "cron",
        status: "active",
        created_by: user?.id ?? null,
        pdf_import_id: importId,
      });

      if (!promoError) {
        published++;
      }
    } catch {
      continue;
    }
  }

  // Update import status
  await supabaseAdmin
    .from("pdf_imports")
    .update({
      status: "done",
      selected_pass: passNumber,
      reviewed_by: user?.id ?? null,
      reviewed_at: now,
      ofertas_count: published,
      consensus_result: { products },
    })
    .eq("id", importId);

  revalidatePath("/painel/super/moderacao");
  revalidatePath("/painel/ofertas");

  return { count: published };
}

export async function rejectImport(importId: string): Promise<void> {
  await requirePermission("moderation:manage");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  await supabaseAdmin
    .from("pdf_imports")
    .update({
      status: "error",
      error_message: "Rejeitado por admin",
      reviewed_by: user?.id ?? null,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", importId);

  revalidatePath("/painel/super/moderacao");
}
