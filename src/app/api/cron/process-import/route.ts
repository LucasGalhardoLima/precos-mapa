import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHash } from "crypto";
import { discoverAndDownloadPdf } from "@/lib/crawler/service";
import { runMultiPassExtraction } from "@/lib/import-pipeline";
import { findOrCreateProduct } from "@/lib/product-match";
import { normalizeCategory, EncarteProduct } from "@/lib/schemas";
import { revalidatePath } from "next/cache";

const supabaseAdmin = createClient(
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

export async function POST(request: NextRequest) {
  // 1. Validate CRON_SECRET
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const sourceId: string | undefined = body.sourceId;

  if (!sourceId) {
    return NextResponse.json({ error: "sourceId is required" }, { status: 400 });
  }

  // 2. Fetch the store_pdf_sources record
  const { data: source, error: fetchError } = await supabaseAdmin
    .from("store_pdf_sources")
    .select("id, store_id, url, label, last_hash")
    .eq("id", sourceId)
    .single();

  if (fetchError || !source) {
    return NextResponse.json(
      { error: `Source not found: ${fetchError?.message ?? "unknown"}` },
      { status: 404 },
    );
  }

  try {
    // 3. Discover and download PDF (handles HTML pages + direct PDF URLs)
    const { pdfBuffer, filename: discoveredFilename } = await discoverAndDownloadPdf(source.url);

    // 4. SHA-256 hash
    const hash = createHash("sha256").update(pdfBuffer).digest("hex");

    // 5. Dedup: same hash as last time → skip
    if (source.last_hash === hash) {
      await supabaseAdmin
        .from("store_pdf_sources")
        .update({ last_checked_at: new Date().toISOString() })
        .eq("id", source.id);

      return NextResponse.json({ status: "skipped_same_hash" });
    }

    // 6. DB dedup: already processed this exact PDF for this store?
    const { data: existing } = await supabaseAdmin
      .from("pdf_imports")
      .select("id, status")
      .eq("store_id", source.store_id)
      .eq("file_hash", hash)
      .maybeSingle();

    if (existing && existing.status === "done") {
      await supabaseAdmin
        .from("store_pdf_sources")
        .update({ last_hash: hash, last_checked_at: new Date().toISOString() })
        .eq("id", source.id);

      return NextResponse.json({ status: "skipped_already_done" });
    }

    // 7. Upload PDF to Storage
    const storagePath = `${source.store_id}/${hash}.pdf`;
    const filename = source.label
      ? `${source.label.replace(/[^a-zA-Z0-9_-]/g, "_")}.pdf`
      : discoveredFilename;

    await supabaseAdmin.storage
      .from("pdf-imports")
      .upload(storagePath, pdfBuffer, {
        contentType: "application/pdf",
        upsert: true,
      });

    // 8. Create or reuse pdf_imports record
    let importId: string;

    if (existing && (existing.status === "pending" || existing.status === "error")) {
      await supabaseAdmin
        .from("pdf_imports")
        .update({
          status: "processing",
          error_message: null,
          storage_path: storagePath,
          source_url: source.url,
        })
        .eq("id", existing.id);
      importId = existing.id;
    } else {
      const { data: inserted, error: insertError } = await supabaseAdmin
        .from("pdf_imports")
        .insert({
          store_id: source.store_id,
          source_id: source.id,
          filename,
          file_hash: hash,
          source_url: source.url,
          storage_path: storagePath,
          status: "processing",
        })
        .select("id")
        .single();

      if (insertError || !inserted) {
        throw new Error(`Failed to create import record: ${insertError?.message ?? "unknown"}`);
      }
      importId = inserted.id;
    }

    // 9. Run 3-pass extraction
    const consensus = await runMultiPassExtraction(pdfBuffer, filename, 3);

    // 10. Save extraction passes
    const passData: Record<string, unknown> = {
      extraction_pass_1: consensus.passes[0]
        ? { products: consensus.passes[0].products, error: consensus.passes[0].error }
        : null,
      extraction_pass_2: consensus.passes[1]
        ? { products: consensus.passes[1].products, error: consensus.passes[1].error }
        : null,
      extraction_pass_3: consensus.passes[2]
        ? { products: consensus.passes[2].products, error: consensus.passes[2].error }
        : null,
      consensus_result: consensus.consensusProducts
        ? { products: consensus.consensusProducts }
        : null,
      consensus_type: consensus.type === "none" ? null : consensus.type,
      confidence_score: consensus.confidenceScore,
    };

    if (consensus.type !== "none" && consensus.consensusProducts) {
      // 11. Auto-publish: create products and promotions
      const published = await publishProducts(
        source.store_id,
        importId,
        consensus.consensusProducts,
      );

      await supabaseAdmin
        .from("pdf_imports")
        .update({
          ...passData,
          status: "done",
          ofertas_count: published,
          processed_at: new Date().toISOString(),
        })
        .eq("id", importId);

      // Log accuracy
      await supabaseAdmin.from("ai_import_logs").insert({
        store_id: source.store_id,
        accuracy_percent: consensus.confidenceScore,
        total_ai_products: consensus.consensusProducts.length,
        total_manual_products: consensus.consensusProducts.length,
        total_deleted_products: 0,
      });

      revalidatePath("/painel/ofertas");

      // 12. Update source tracking
      await supabaseAdmin
        .from("store_pdf_sources")
        .update({ last_hash: hash, last_checked_at: new Date().toISOString() })
        .eq("id", source.id);

      return NextResponse.json({
        status: "done",
        consensus: consensus.type,
        published,
      });
    } else {
      // 13. No consensus → needs_review
      await supabaseAdmin
        .from("pdf_imports")
        .update({
          ...passData,
          status: "needs_review",
          processed_at: new Date().toISOString(),
        })
        .eq("id", importId);

      await supabaseAdmin
        .from("store_pdf_sources")
        .update({ last_hash: hash, last_checked_at: new Date().toISOString() })
        .eq("id", source.id);

      return NextResponse.json({
        status: "needs_review",
        consensus: "none",
      });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// Publish products + promotions (reuses patterns from publish-action.ts)
// ---------------------------------------------------------------------------

async function publishProducts(
  storeId: string,
  importId: string,
  products: EncarteProduct[],
): Promise<number> {
  // Ensure categories exist
  const usedCategoryIds = new Set(
    products.map((p) => normalizeCategory(p.category)),
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
        store_id: storeId,
        product_id: productId,
        original_price: originalPrice,
        promo_price: product.price,
        start_date: now,
        end_date: endDate,
        source: "cron",
        status: "active",
        created_by: null,
        pdf_import_id: importId,
      });

      if (!promoError) {
        published++;
      }
    } catch {
      // Skip individual product errors to maximize throughput
      continue;
    }
  }

  return published;
}
