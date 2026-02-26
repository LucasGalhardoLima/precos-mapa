"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/features/auth/session";
import { createClient } from "@/lib/supabase-server";
import { generateIndexNow } from "./generate-index-action";

export async function updateIndexStatus(indexId: string, newStatus: "published" | "archived") {
  await requirePermission("moderation:manage");
  const supabase = await createClient();

  const updateData: Record<string, unknown> = { status: newStatus };
  if (newStatus === "published") {
    updateData.published_at = new Date().toISOString();
  }

  const { error } = await supabase
    .from("price_indices")
    .update(updateData)
    .eq("id", indexId);

  if (error) {
    throw new Error(`Erro ao atualizar indice: ${error.message}`);
  }

  revalidatePath("/painel/super/indice");
  revalidatePath("/indice");
}

export async function deleteIndex(indexId: string) {
  await requirePermission("moderation:manage");
  const supabase = await createClient();

  const { error } = await supabase
    .from("price_indices")
    .delete()
    .eq("id", indexId);

  if (error) {
    throw new Error(`Erro ao excluir indice: ${error.message}`);
  }

  revalidatePath("/painel/super/indice");
}

export async function recalculateIndex(indexId: string) {
  await requirePermission("moderation:manage");
  const supabase = await createClient();

  // Fetch existing index to get period info
  const { data: existing, error: fetchError } = await supabase
    .from("price_indices")
    .select("city, state, period_start")
    .eq("id", indexId)
    .single();

  if (fetchError || !existing) {
    throw new Error(`Indice nao encontrado: ${fetchError?.message ?? "sem dados"}`);
  }

  const periodDate = new Date(existing.period_start + "T00:00:00");
  const month = periodDate.getMonth() + 1;
  const year = periodDate.getFullYear();

  // Delete old index (cascade cleans children)
  const { error: deleteError } = await supabase
    .from("price_indices")
    .delete()
    .eq("id", indexId);

  if (deleteError) {
    throw new Error(`Erro ao excluir indice antigo: ${deleteError.message}`);
  }

  // Regenerate
  const result = await generateIndexNow({ month, year });

  if (result.error) {
    throw new Error(`Erro ao recalcular: ${result.error}`);
  }

  revalidatePath("/painel/super/indice");
}

export async function exportIndexCsv(indexId: string): Promise<string> {
  await requirePermission("moderation:manage");
  const supabase = await createClient();

  // Fetch index
  const { data: idx, error: idxError } = await supabase
    .from("price_indices")
    .select("*")
    .eq("id", indexId)
    .single();

  if (idxError || !idx) {
    throw new Error(`Indice nao encontrado: ${idxError?.message ?? "sem dados"}`);
  }

  // Fetch categories with category name
  const { data: categories } = await supabase
    .from("price_index_categories")
    .select("*, category:categories(name)")
    .eq("index_id", indexId)
    .order("avg_price", { ascending: false });

  // Fetch products with product and category name
  const { data: products } = await supabase
    .from("price_index_products")
    .select("*, product:products(name, category_id), product_category:products(category:categories(name))")
    .eq("index_id", indexId)
    .order("mom_change_percent", { ascending: false });

  const lines: string[] = [];

  // Summary header
  lines.push("Indice de Precos - Resumo");
  lines.push(`Periodo,${idx.period_start},${idx.period_end}`);
  lines.push(`Cidade,${idx.city}/${idx.state}`);
  lines.push(`Valor do Indice,${idx.index_value}`);
  lines.push(`Variacao MoM,${idx.mom_change_percent ?? "—"}`);
  lines.push(`Produtos,${idx.product_count}`);
  lines.push(`Mercados,${idx.store_count}`);
  lines.push(`Qualidade,${idx.data_quality_score}/100`);
  lines.push("");

  // Categories section
  lines.push("Categorias");
  lines.push("Nome,Preco Medio,Preco Min,Preco Max,Produtos,MoM%,Peso");
  for (const cat of categories ?? []) {
    const catName = (cat.category as { name?: string } | null)?.name ?? cat.category_id;
    lines.push(
      `${catName},${cat.avg_price},${cat.min_price},${cat.max_price},${cat.product_count},${cat.mom_change_percent ?? "—"},${cat.weight}`
    );
  }
  lines.push("");

  // Products section
  lines.push("Produtos");
  lines.push("Nome,Preco Medio,Preco Min,Preco Max,Dias Snapshot,MoM%");
  for (const prod of products ?? []) {
    const prodName = (prod.product as { name?: string } | null)?.name ?? prod.product_id;
    lines.push(
      `${prodName},${prod.avg_price},${prod.min_price},${prod.max_price},${prod.snapshot_days},${prod.mom_change_percent ?? "—"}`
    );
  }

  return lines.join("\n");
}
