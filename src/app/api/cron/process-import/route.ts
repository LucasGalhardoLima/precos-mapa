import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { discoverAndDownloadAllPdfs } from "@/lib/crawler/service";
import { runMultiPassExtraction } from "@/lib/import-pipeline";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { findOrCreateProduct } from "@/lib/product-match";
import { normalizeCategory, EncarteProduct } from "@/lib/schemas";
import { revalidatePath } from "next/cache";

const CATEGORY_DEFAULTS: Record<string, { name: string; icon: string; sort_order: number }> = {
  cat_alimentos: { name: "Alimentos", icon: "wheat", sort_order: 0 },
  cat_bebidas: { name: "Bebidas", icon: "cup-soda", sort_order: 1 },
  cat_limpeza: { name: "Limpeza", icon: "spray-can", sort_order: 2 },
  cat_hortifruti: { name: "Hortifruti", icon: "apple", sort_order: 3 },
  cat_padaria: { name: "Padaria", icon: "croissant", sort_order: 4 },
  cat_higiene: { name: "Higiene", icon: "sparkles", sort_order: 5 },
};

interface PdfSource {
  id: string;
  store_id: string;
  url: string;
  label: string | null;
  last_hash: string | null;
}

// ---------------------------------------------------------------------------
// Auth helper
// ---------------------------------------------------------------------------

function validateCronSecret(request: NextRequest): boolean {
  const authHeader = request.headers.get("authorization");
  return authHeader === `Bearer ${process.env.CRON_SECRET}`;
}

// ---------------------------------------------------------------------------
// GET — Called by Vercel Cron. Processes all active sources.
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  if (!validateCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: sources } = await getSupabaseAdmin()
    .from("store_pdf_sources")
    .select("id, store_id, url, label, last_hash")
    .eq("is_active", true);

  const activeSources = (sources ?? []) as PdfSource[];

  console.log(`[CRON] Found ${activeSources.length} active sources`);

  if (activeSources.length === 0) {
    return NextResponse.json({ status: "no_active_sources", processed: 0 });
  }

  const results: { sourceId: string; status: string; error?: string }[] = [];

  for (const source of activeSources) {
    try {
      const result = await processSource(source);
      console.log(`[CRON] Source ${source.id}: ${result.status}${result.published != null ? ` (${result.published} published)` : ""}`);
      results.push({ sourceId: source.id, ...result });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro desconhecido";
      console.error(`[CRON] Source ${source.id}: error — ${message}`);
      results.push({ sourceId: source.id, status: "error", error: message });
    }
  }

  console.log(`[CRON] Done. Processed ${results.length} sources.`);
  return NextResponse.json({ processed: results.length, results });
}

// ---------------------------------------------------------------------------
// POST — Manual trigger for a single source (admin panel).
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  if (!validateCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const sourceId: string | undefined = body.sourceId;

  if (!sourceId) {
    return NextResponse.json({ error: "sourceId is required" }, { status: 400 });
  }

  const { data: source, error: fetchError } = await getSupabaseAdmin()
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
    const result = await processSource(source as PdfSource);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// Core processing logic for a single PDF source
// ---------------------------------------------------------------------------

async function processSource(
  source: PdfSource,
): Promise<{ status: string; consensus?: string; published?: number }> {
  // 1. Discover and download all PDFs from the source URL
  const pdfs = await discoverAndDownloadAllPdfs(source.url);
  console.log(`[CRON] Discovered ${pdfs.length} PDF(s) from ${source.url}`);

  let totalPublished = 0;
  let lastStatus = "skipped_already_done";
  let lastConsensus: string | undefined;

  for (let pdfIndex = 0; pdfIndex < pdfs.length; pdfIndex++) {
    const { pdfBuffer, filename: discoveredFilename } = pdfs[pdfIndex];

    // 2. SHA-256 hash
    const hash = createHash("sha256").update(pdfBuffer).digest("hex");
    console.log(`[CRON] PDF ${pdfIndex + 1}/${pdfs.length}: ${discoveredFilename} (hash: ${hash.slice(0, 8)}, size: ${pdfBuffer.byteLength} bytes)`);

    // 3. DB dedup: already processed this exact PDF for this store?
    const { data: existing } = await getSupabaseAdmin()
      .from("pdf_imports")
      .select("id, status")
      .eq("store_id", source.store_id)
      .eq("file_hash", hash)
      .maybeSingle();

    const existingRecord = existing as { id: string; status: string } | null;

    if (existingRecord?.status === "done") {
      console.log(`[CRON] PDF ${pdfIndex + 1}/${pdfs.length}: skipped (already done)`);
      continue;
    }

    // 4. Upload PDF to Storage
    const storagePath = `${source.store_id}/${hash}.pdf`;
    const filename = source.label
      ? `${source.label.replace(/[^a-zA-Z0-9_-]/g, "_")}_${pdfIndex + 1}.pdf`
      : discoveredFilename;

    await getSupabaseAdmin().storage
      .from("pdf-imports")
      .upload(storagePath, pdfBuffer, {
        contentType: "application/pdf",
        upsert: true,
      });

    // 5. Create or reuse pdf_imports record
    let importId: string;

    if (existingRecord) {
      await getSupabaseAdmin()
        .from("pdf_imports")
        .update({
          status: "processing",
          error_message: null,
          storage_path: storagePath,
          source_url: source.url,
        })
        .eq("id", existingRecord.id);
      importId = existingRecord.id;
    } else {
      const { data: inserted, error: insertError } = await getSupabaseAdmin()
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

      const insertedRecord = inserted as { id: string } | null;

      if (insertError || !insertedRecord) {
        console.error(`[CRON] PDF ${pdfIndex + 1}/${pdfs.length}: failed to create import record: ${insertError?.message ?? "unknown"}`);
        continue;
      }
      importId = insertedRecord.id;
    }

    // 6. Run 3-pass extraction
    console.log(`[CRON] PDF ${pdfIndex + 1}/${pdfs.length}: running 3-pass extraction...`);
    const consensus = await runMultiPassExtraction(pdfBuffer, filename, 3);
    console.log(`[CRON] PDF ${pdfIndex + 1}/${pdfs.length}: consensus=${consensus.type}, confidence=${consensus.confidenceScore}, products=${consensus.consensusProducts?.length ?? 0}`);

    // 7. Save extraction passes
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
      // 8. Auto-publish: create products and promotions
      const published = await publishProducts(
        source.store_id,
        importId,
        consensus.consensusProducts,
      );

      await getSupabaseAdmin()
        .from("pdf_imports")
        .update({
          ...passData,
          status: "done",
          ofertas_count: published,
          processed_at: new Date().toISOString(),
        })
        .eq("id", importId);

      await getSupabaseAdmin().from("ai_import_logs").insert({
        store_id: source.store_id,
        accuracy_percent: consensus.confidenceScore,
        total_ai_products: consensus.consensusProducts.length,
        total_manual_products: consensus.consensusProducts.length,
        total_deleted_products: 0,
      });

      totalPublished += published;
      lastStatus = "done";
      lastConsensus = consensus.type;
      console.log(`[CRON] PDF ${pdfIndex + 1}/${pdfs.length}: published ${published} promotions`);
    } else {
      // 9. No consensus → needs_review
      await getSupabaseAdmin()
        .from("pdf_imports")
        .update({
          ...passData,
          status: "needs_review",
          processed_at: new Date().toISOString(),
        })
        .eq("id", importId);

      lastStatus = "needs_review";
      lastConsensus = "none";
      console.log(`[CRON] PDF ${pdfIndex + 1}/${pdfs.length}: needs_review`);
    }
  }

  // Update source tracking
  revalidatePath("/painel/ofertas");
  await getSupabaseAdmin()
    .from("store_pdf_sources")
    .update({ last_checked_at: new Date().toISOString() })
    .eq("id", source.id);

  if (totalPublished > 0) {
    console.log(`[CRON] Source ${source.id}: total ${totalPublished} promotions published from ${pdfs.length} PDFs`);
    return { status: "done", consensus: lastConsensus, published: totalPublished };
  }

  return { status: lastStatus, consensus: lastConsensus };
}

// ---------------------------------------------------------------------------
// Publish products + promotions
// ---------------------------------------------------------------------------

async function publishProducts(
  storeId: string,
  importId: string,
  products: EncarteProduct[],
): Promise<number> {
  const usedCategoryIds = new Set(
    products.map((p) => normalizeCategory(p.category)),
  );

  for (const catId of usedCategoryIds) {
    const defaults = CATEGORY_DEFAULTS[catId];
    if (!defaults) continue;

    const { data: catCheck } = await getSupabaseAdmin()
      .from("categories")
      .select("id")
      .eq("id", catId)
      .maybeSingle();

    if (!catCheck) {
      await getSupabaseAdmin().from("categories").insert({ id: catId, ...defaults });
    }
  }

  const now = new Date().toISOString();
  let published = 0;

  for (const product of products) {
    try {
      const { id: productId } = await findOrCreateProduct(getSupabaseAdmin(), {
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

      const { error: promoError } = await getSupabaseAdmin().from("promotions").insert({
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
