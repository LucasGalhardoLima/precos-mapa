import { NextRequest, NextResponse } from "next/server";
import { runIncrementalExtraction, runIncrementalImageExtraction } from "@/lib/import-pipeline";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { findOrCreateProduct } from "@/lib/product-match";
import { normalizeCategory, extractBrand, EncarteProduct } from "@/lib/schemas";
import { revalidatePath } from "next/cache";

const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "webp"]);

// Leaves ~40s of buffer before Vercel's 300s hard function-kill so the catch
// block below always gets to run and write a terminal status.
const SOFT_TIMEOUT_MS = 260_000;

function withSoftTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} exceeded ${Math.round(ms / 1000)}s soft budget`)), ms),
    ),
  ]);
}

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

    // 4. Incremental extraction: pass 1, then pass 2 if needed, then pass 3.
    // Raced against a soft deadline, well under Vercel's 300s hard kill —
    // without this, a slow extraction leaves the row stuck at "processing"
    // forever (the hard kill doesn't let the catch block below run), which
    // gets silently redispatched and retried on every future cron run.
    const consensus = await withSoftTimeout(
      isImage
        ? runIncrementalImageExtraction(fileBuffer, record.filename)
        : runIncrementalExtraction(fileBuffer, record.filename),
      SOFT_TIMEOUT_MS,
      `${typeLabel} extraction`,
    );
    console.log(`[WORKER] Import ${importId}: consensus=${consensus.type}, confidence=${consensus.confidenceScore}, products=${consensus.consensusProducts?.length ?? 0}, passes=${consensus.passes.length}`);

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
      const { published, duplicateMatches, lowConfidenceProducts } = await publishProducts(
        record.store_id,
        importId,
        consensus.consensusProducts,
      );
      const totalProducts = consensus.consensusProducts.length;
      const allFailed = totalProducts > 0 && published === 0;
      const hasDuplicates = duplicateMatches.length > 0;
      const needsReview = allFailed || hasDuplicates;

      const reviewReasons: string[] = [];
      if (allFailed) {
        reviewReasons.push(`all ${totalProducts} products failed to publish`);
      }
      if (hasDuplicates) {
        reviewReasons.push(
          `${duplicateMatches.length} duplicate match(es): ${duplicateMatches.slice(0, 3).join("; ")}`,
        );
      }
      if (lowConfidenceProducts.length > 0) {
        reviewReasons.push(
          `${lowConfidenceProducts.length} produto(s) com baixa confiança: ${lowConfidenceProducts.slice(0, 5).join("; ")}`,
        );
      }

      await getSupabaseAdmin()
        .from("pdf_imports")
        .update({
          ...passData,
          status: needsReview ? "needs_review" : "done",
          ofertas_count: published,
          processed_at: new Date().toISOString(),
          ...(reviewReasons.length > 0
            ? { needs_review_reason: reviewReasons.join(" | ") }
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
      if (needsReview) {
        console.error(
          `[WORKER] Import ${importId}: needs_review — ${reviewReasons.join(" | ")}`,
        );
        return NextResponse.json({
          status: "needs_review",
          published,
          total: totalProducts,
          duplicates: duplicateMatches.length,
        });
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

interface PublishResult {
  published: number;
  duplicateMatches: string[];
  lowConfidenceProducts: string[];
}

async function publishProducts(
  storeId: string,
  importId: string,
  products: EncarteProduct[],
): Promise<PublishResult> {
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
  const duplicateMatches: string[] = [];
  const seenProductIds = new Map<string, string>();

  // Step 1: resolve all products in parallel — findOrCreateProduct is the
  // expensive step (fuzzy text matching + DB round-trips)
  const resolvedResults = await Promise.allSettled(
    products.map(async (product) => {
      const categoryId = normalizeCategory(product.category);
      const brand = product.brand ?? extractBrand(product.name);
      const result = await findOrCreateProduct(getSupabaseAdmin(), {
        name: product.name,
        categoryId,
        brand: brand ?? undefined,
        referencePrice: product.original_price ?? product.price,
      });
      return { product, result };
    }),
  );

  // Step 2: expire + insert sequentially to satisfy the partial unique index
  // on (store_id, product_id) WHERE status = 'active'
  for (const settled of resolvedResults) {
    if (settled.status === "rejected") {
      const msg =
        settled.reason instanceof Error
          ? `${settled.reason.name}: ${settled.reason.message}`
          : String(settled.reason);
      console.error(`[WORKER] ${importId} product resolution threw: ${msg}`);
      continue;
    }

    const { product, result } = settled.value;

    if (result.matched && result.confidence < 0.7) {
      lowConfidenceProducts.push(
        `${product.name} (confidence: ${(result.confidence * 100).toFixed(0)}%)`,
      );
    }

    const previousName = seenProductIds.get(result.id);
    if (previousName) {
      duplicateMatches.push(
        `"${product.name}" → already published as "${previousName}" (product_id=${result.id})`,
      );
    } else {
      seenProductIds.set(result.id, product.name);
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

    // Expire any existing active promotion for this product+store before inserting
    await getSupabaseAdmin()
      .from("promotions")
      .update({ status: "expired", updated_at: now })
      .eq("store_id", storeId)
      .eq("product_id", result.id)
      .eq("status", "active");

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
      if (promoError.code === "23505") {
        // Another concurrent worker won the race and inserted first — update that row
        const { error: updateError } = await getSupabaseAdmin()
          .from("promotions")
          .update({ promo_price: product.price, original_price: originalPrice, end_date: endDate, updated_at: now, pdf_import_id: importId })
          .eq("store_id", storeId)
          .eq("product_id", result.id)
          .eq("status", "active");
        if (!updateError) {
          published++;
        } else {
          console.error(`[WORKER] ${importId} upsert fallback failed for "${product.name}": ${updateError.message}`);
        }
      } else {
        console.error(
          `[WORKER] ${importId} promo insert failed for "${product.name}" (product_id=${result.id}): ${promoError.code ?? ""} ${promoError.message}`,
        );
      }
    } else {
      published++;
    }
  }

  return { published, duplicateMatches, lowConfidenceProducts };
}
