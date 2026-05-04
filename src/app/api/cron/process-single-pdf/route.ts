import { NextRequest, NextResponse } from "next/server";
import { runMultiPassExtraction, runMultiPassImageExtraction } from "@/lib/import-pipeline";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { findOrCreateProduct } from "@/lib/product-match";
import { normalizeCategory, extractBrand, EncarteProduct } from "@/lib/schemas";
import { revalidatePath } from "next/cache";

const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "webp"]);

const CATEGORY_DEFAULTS: Record<string, { name: string; icon: string; sort_order: number }> = {
  cat_alimentos: { name: "Alimentos", icon: "wheat", sort_order: 0 },
  cat_bebidas: { name: "Bebidas", icon: "cup-soda", sort_order: 1 },
  cat_limpeza: { name: "Limpeza", icon: "spray-can", sort_order: 2 },
  cat_hortifruti: { name: "Hortifruti", icon: "apple", sort_order: 3 },
  cat_padaria: { name: "Padaria", icon: "croissant", sort_order: 4 },
  cat_higiene: { name: "Higiene", icon: "sparkles", sort_order: 5 },
};

// ---------------------------------------------------------------------------
// POST — Worker: processes a single pdf_imports record.
// Called by the dispatcher (/api/cron/process-import) via fire-and-forget.
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { importId } = await request.json();
  if (!importId) {
    return NextResponse.json({ error: "importId is required" }, { status: 400 });
  }

  // 1. Load import record
  const { data: record, error: fetchError } = await getSupabaseAdmin()
    .from("pdf_imports")
    .select("id, store_id, source_id, filename, storage_path, status")
    .eq("id", importId)
    .single();

  if (fetchError || !record) {
    return NextResponse.json({ error: "Import not found" }, { status: 404 });
  }

  if (record.status === "done") {
    return NextResponse.json({ status: "skipped_already_done" });
  }

  // 2. Mark as processing
  await getSupabaseAdmin()
    .from("pdf_imports")
    .update({ status: "processing", error_message: null })
    .eq("id", importId);

  try {
    // 3. Determine file type and download from correct bucket
    const fileExt = record.storage_path.split(".").pop()?.toLowerCase() ?? "";
    const isImage = IMAGE_EXTENSIONS.has(fileExt);
    const bucket = isImage ? "image-imports" : "pdf-imports";

    const { data: fileData, error: downloadError } = await getSupabaseAdmin()
      .storage.from(bucket)
      .download(record.storage_path);

    if (downloadError || !fileData) {
      throw new Error(`Failed to download ${record.storage_path} from ${bucket}: ${JSON.stringify(downloadError)}`);
    }

    const fileBuffer = Buffer.from(await fileData.arrayBuffer());
    const typeLabel = isImage ? "image" : "PDF";
    console.log(`[WORKER] Processing ${typeLabel} import ${importId} (${record.filename}, ${fileBuffer.byteLength} bytes)`);

    // 4. Run 3-pass extraction (PDF via Claude Sonnet, images via GPT-4o vision)
    const consensus = isImage
      ? await runMultiPassImageExtraction(fileBuffer, record.filename, 3)
      : await runMultiPassExtraction(fileBuffer, record.filename, 3);
    console.log(`[WORKER] Import ${importId}: consensus=${consensus.type}, confidence=${consensus.confidenceScore}, products=${consensus.consensusProducts?.length ?? 0}`);

    // 5. Save extraction passes
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
      // 6. Auto-publish
      const published = await publishProducts(record.store_id, importId, consensus.consensusProducts);
      const totalProducts = consensus.consensusProducts.length;
      const allFailed = totalProducts > 0 && published === 0;

      await getSupabaseAdmin()
        .from("pdf_imports")
        .update({
          ...passData,
          status: allFailed ? "needs_review" : "done",
          ofertas_count: published,
          processed_at: new Date().toISOString(),
          ...(allFailed
            ? { needs_review_reason: `all ${totalProducts} products failed to publish` }
            : {}),
        })
        .eq("id", importId);

      await getSupabaseAdmin().from("ai_import_logs").insert({
        store_id: record.store_id,
        accuracy_percent: consensus.confidenceScore,
        total_ai_products: totalProducts,
        total_manual_products: totalProducts,
        total_deleted_products: 0,
      });

      revalidatePath("/painel/ofertas");
      if (allFailed) {
        console.error(`[WORKER] Import ${importId}: needs_review — all ${totalProducts} products failed to publish`);
        return NextResponse.json({ status: "needs_review", published: 0, total: totalProducts });
      }
      console.log(`[WORKER] Import ${importId}: published ${published}/${totalProducts} promotions`);
      return NextResponse.json({ status: "done", published });
    } else {
      // 7. No consensus
      await getSupabaseAdmin()
        .from("pdf_imports")
        .update({
          ...passData,
          status: "needs_review",
          processed_at: new Date().toISOString(),
        })
        .eq("id", importId);

      console.log(`[WORKER] Import ${importId}: needs_review`);
      return NextResponse.json({ status: "needs_review" });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    console.error(`[WORKER] Import ${importId}: error — ${message}`);

    await getSupabaseAdmin()
      .from("pdf_imports")
      .update({ status: "error", error_message: message })
      .eq("id", importId);

    return NextResponse.json({ error: message }, { status: 500 });
  }
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
  const lowConfidenceProducts: string[] = [];

  for (const product of products) {
    try {
      const categoryId = normalizeCategory(product.category);
      const brand = product.brand ?? extractBrand(product.name);

      const result = await findOrCreateProduct(getSupabaseAdmin(), {
        name: product.name,
        categoryId,
        brand: brand ?? undefined,
        referencePrice: product.original_price ?? product.price,
      });

      // Track low-confidence matches for review flagging
      if (result.matched && result.confidence < 0.7) {
        lowConfidenceProducts.push(
          `${product.name} (confidence: ${(result.confidence * 100).toFixed(0)}%)`,
        );
      }

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
        product_id: result.id,
        original_price: originalPrice,
        promo_price: product.price,
        start_date: now,
        end_date: endDate,
        source: "cron",
        status: "active",
        created_by: null,
        pdf_import_id: importId,
      });

      if (promoError) {
        console.error(
          `[WORKER] ${importId} promo insert failed for "${product.name}" (product_id=${result.id}): ${promoError.code ?? ""} ${promoError.message}`,
        );
      } else {
        published++;
      }
    } catch (err) {
      const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
      console.error(`[WORKER] ${importId} product "${product.name}" threw: ${msg}`);
      continue;
    }
  }

  // Flag import for review if any products had low-confidence matches
  if (lowConfidenceProducts.length > 0) {
    await getSupabaseAdmin()
      .from("pdf_imports")
      .update({
        needs_review_reason: `${lowConfidenceProducts.length} produto(s) com baixa confiança: ${lowConfidenceProducts.slice(0, 5).join("; ")}`,
      })
      .eq("id", importId);
  }

  return published;
}
