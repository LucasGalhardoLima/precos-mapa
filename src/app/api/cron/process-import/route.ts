import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import {
  discoverAndDownloadAllPdfs,
  discoverAndDownloadImages,
  getPdfPageCount,
  renderPdfPagesIncrementally,
  NATIVE_PDF_MAX_BYTES,
  RenderConfig,
} from "@/lib/crawler/service";
import { getSupabaseAdmin } from "@/lib/supabase-server";

// A many-page flyer rendered and sent as one multi-image AI call can exceed
// Vercel's 300s function limit before a single progress log line fires
// (confirmed against a real 30-page, 14MB flyer that timed out with zero
// intermediate output). PDFs with more rendered pages than this are split
// into one pdf_imports row per page instead, reusing the single-image
// worker path that's already proven to finish comfortably within budget.
const CHUNK_PAGE_THRESHOLD = 6;

// Cap on how many times discoverAndPrepare will reset a non-done row back to
// 'pending' and redispatch it. Without this, a row that fails the same way
// every time (e.g. still too slow even after chunking) gets retried forever,
// burning a worker invocation + AI call each cron run for no chance of success.
const MAX_ATTEMPTS = 3;

interface PdfSource {
  id: string;
  store_id: string;
  url: string;
  label: string | null;
  last_hash: string | null;
  source_type: "pdf" | "image";
  render_config: RenderConfig | null;
}

function validateCronSecret(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 32) {
    console.error(
      "[CRON] CRON_SECRET is missing or too weak (must be 32+ chars). " +
      "Generate one with: openssl rand -base64 32",
    );
    return false;
  }
  const authHeader = request.headers.get("authorization");
  return authHeader === `Bearer ${secret}`;
}

function getAppUrl(): string {
  const url =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
  return url.replace(/\/+$/, "");
}

/**
 * Dispatch worker invocations in parallel and await all responses.
 * Each worker runs in its own Vercel serverless invocation (~1 min each).
 * Running in parallel, total time ≈ slowest worker (well within 5 min).
 */
async function dispatchWorkers(importIds: string[]): Promise<void> {
  const appUrl = getAppUrl();
  const cronSecret = process.env.CRON_SECRET;
  const workerUrl = `${appUrl}/api/cron/process-single-pdf`;

  console.log(`[CRON] Dispatching ${importIds.length} workers to ${workerUrl}`);

  const results = await Promise.allSettled(
    importIds.map(async (importId) => {
      try {
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          Authorization: `Bearer ${cronSecret}`,
        };
        // Bypass Vercel Deployment Protection on preview deployments
        if (process.env.VERCEL_AUTOMATION_BYPASS_SECRET) {
          headers["x-vercel-protection-bypass"] = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
        }
        const res = await fetch(workerUrl, {
          method: "POST",
          headers,
          body: JSON.stringify({ importId }),
        });
        const contentType = res.headers.get("content-type") ?? "";
        if (!contentType.includes("application/json")) {
          const text = (await res.text()).slice(0, 200);
          throw new Error(`Worker returned ${res.status} (${contentType}): ${text}`);
        }
        const body = await res.json();
        console.log(`[CRON] Worker ${importId}: ${res.status} — ${JSON.stringify(body)}`);
        return body;
      } catch (err) {
        const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
        console.error(`[CRON] Worker ${importId} dispatch error: ${msg}`);
        throw err;
      }
    }),
  );

  const failed = results.filter((r) => r.status === "rejected");
  if (failed.length > 0) {
    console.error(`[CRON] ${failed.length}/${importIds.length} worker(s) failed`);
  }
}

// ---------------------------------------------------------------------------
// GET — Called by Vercel Cron. Discovers PDFs and dispatches workers.
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  if (!validateCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: sources } = await getSupabaseAdmin()
    .from("store_pdf_sources")
    .select("id, store_id, url, label, last_hash, source_type, render_config")
    .eq("is_active", true);

  const activeSources = (sources ?? []) as PdfSource[];
  console.log(`[CRON] Found ${activeSources.length} active sources`);

  if (activeSources.length === 0) {
    return NextResponse.json({ status: "no_active_sources", processed: 0 });
  }

  const dispatched: { sourceId: string; importId: string; filename: string }[] = [];
  const skipped: { sourceId: string; filename: string; reason: string }[] = [];
  const errors: { sourceId: string; error: string }[] = [];

  for (const source of activeSources) {
    try {
      const result = await discoverAndPrepare(source);
      dispatched.push(...result.dispatched);
      skipped.push(...result.skipped);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro desconhecido";
      console.error(`[CRON] Source ${source.id}: error — ${message}`);
      errors.push({ sourceId: source.id, error: message });
    }
  }

  // Dispatch all pending imports to worker endpoint in parallel
  await dispatchWorkers(dispatched.map((d) => d.importId));

  console.log(`[CRON] Done. Dispatched ${dispatched.length}, skipped ${skipped.length}, errors ${errors.length}`);

  return NextResponse.json({
    dispatched: dispatched.length,
    skipped: skipped.length,
    errors: errors.length,
    details: { dispatched, skipped, errors },
  });
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
    .select("id, store_id, url, label, last_hash, source_type, render_config")
    .eq("id", sourceId)
    .single();

  if (fetchError || !source) {
    return NextResponse.json(
      { error: `Source not found: ${fetchError?.message ?? "unknown"}` },
      { status: 404 },
    );
  }

  try {
    const result = await discoverAndPrepare(source as PdfSource);

    // Dispatch workers in parallel
    await dispatchWorkers(result.dispatched.map((d) => d.importId));

    return NextResponse.json({
      dispatched: result.dispatched.length,
      skipped: result.skipped.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// Discover PDFs, dedup, create import records, upload to storage.
// Returns list of importIds ready for worker dispatch.
// ---------------------------------------------------------------------------

export interface DiscoveredFile {
  buffer: Buffer;
  filename: string;
  asImage: boolean;
}

// PDF discovery with oversized-flyer chunking: a PDF under NATIVE_PDF_MAX_BYTES
// goes through unchanged (native upload, one pdf_imports row). One over that
// size, and not already imported, gets its page count checked (cheap — no
// rendering) — above CHUNK_PAGE_THRESHOLD it's rendered one page at a time
// and split into one image entry per page (dispatched through the
// single-image worker path); at or under the threshold it's kept as one PDF
// entry, same as before (processPdfBuffer's existing oversized branch
// handles a small page count fine on its own).
//
// The already-imported check runs BEFORE any page-count/render work: an
// oversized PDF that's already 'done' would otherwise get rendered again on
// every single cron run just to make a decision whose outcome is thrown
// away a moment later — that redundant rendering (compounded when more than
// one oversized PDF shares a source) is what OOM-killed a real invocation.
export async function discoverAndPreparePdfFiles(url: string, storeId: string): Promise<DiscoveredFile[]> {
  const pdfs = await discoverAndDownloadAllPdfs(url);
  const files: DiscoveredFile[] = [];

  for (const pdf of pdfs) {
    if (pdf.pdfBuffer.byteLength <= NATIVE_PDF_MAX_BYTES) {
      files.push({ buffer: pdf.pdfBuffer, filename: pdf.filename, asImage: false });
      continue;
    }

    const hash = createHash("sha256").update(pdf.pdfBuffer).digest("hex");
    const { data: existing } = await getSupabaseAdmin()
      .from("pdf_imports")
      .select("status")
      .eq("store_id", storeId)
      .eq("file_hash", hash)
      .maybeSingle();

    if ((existing as { status: string } | null)?.status === "done") {
      // Already imported — skip page count/rendering. The main loop below
      // hashes this same buffer again and will correctly skip it as
      // already_done, with zero rendering cost paid here.
      files.push({ buffer: pdf.pdfBuffer, filename: pdf.filename, asImage: false });
      continue;
    }

    const pageCount = await getPdfPageCount(pdf.pdfBuffer);

    if (pageCount <= CHUNK_PAGE_THRESHOLD) {
      files.push({ buffer: pdf.pdfBuffer, filename: pdf.filename, asImage: false });
      continue;
    }

    console.log(`[CRON] ${pdf.filename}: ${pageCount} pages > ${CHUNK_PAGE_THRESHOLD} — chunking into per-page imports`);
    await renderPdfPagesIncrementally(pdf.pdfBuffer, async (page) => {
      files.push({
        buffer: page.buffer,
        filename: pdf.filename.replace(/\.pdf$/i, `_p${page.pageNumber}.png`),
        asImage: true,
      });
    });
  }

  return files;
}

async function discoverAndPrepare(source: PdfSource): Promise<{
  dispatched: { sourceId: string; importId: string; filename: string }[];
  skipped: { sourceId: string; filename: string; reason: string }[];
}> {
  const isImageSource = source.source_type === "image";

  // Discover files based on source type
  const files: DiscoveredFile[] = isImageSource
    ? (await discoverAndDownloadImages(source.url, source.render_config ?? undefined)).map((f) => ({
        buffer: f.imageBuffer,
        filename: f.filename,
        asImage: true,
      }))
    : await discoverAndPreparePdfFiles(source.url, source.store_id);

  console.log(`[CRON] Source ${source.id}: discovered ${files.length} file(s)`);

  const dispatched: { sourceId: string; importId: string; filename: string }[] = [];
  const skipped: { sourceId: string; filename: string; reason: string }[] = [];

  for (let i = 0; i < files.length; i++) {
    const { buffer, filename: discoveredFilename, asImage } = files[i];
    const typeLabel = asImage ? "image" : "PDF";
    const hash = createHash("sha256").update(buffer).digest("hex");
    const ext = asImage ? discoveredFilename.split(".").pop() ?? "png" : "pdf";
    const filename = source.label
      ? `${source.label.replace(/[^a-zA-Z0-9_-]/g, "_")}_${i + 1}.${ext}`
      : discoveredFilename;

    console.log(`[CRON] ${typeLabel} ${i + 1}/${files.length}: ${filename} (hash: ${hash.slice(0, 8)}, ${buffer.byteLength} bytes)`);

    // DB dedup
    const { data: existing } = await getSupabaseAdmin()
      .from("pdf_imports")
      .select("id, status, attempt_count")
      .eq("store_id", source.store_id)
      .eq("file_hash", hash)
      .maybeSingle();

    const existingRecord = existing as { id: string; status: string; attempt_count: number } | null;

    if (existingRecord?.status === "done") {
      console.log(`[CRON] ${typeLabel} ${i + 1}/${files.length}: skipped (already done)`);
      skipped.push({ sourceId: source.id, filename, reason: "already_done" });
      continue;
    }

    if (existingRecord && existingRecord.attempt_count >= MAX_ATTEMPTS) {
      console.warn(`[CRON] ${typeLabel} ${i + 1}/${files.length}: skipped (${existingRecord.attempt_count} failed attempts — needs manual review)`);
      if (existingRecord.status !== "needs_review") {
        await getSupabaseAdmin()
          .from("pdf_imports")
          .update({
            status: "needs_review",
            error_message: `Excedeu ${MAX_ATTEMPTS} tentativas — última: ${existingRecord.status}`,
          })
          .eq("id", existingRecord.id);
      }
      skipped.push({ sourceId: source.id, filename, reason: "max_attempts_exceeded" });
      continue;
    }

    // Upload to storage (images go to image-imports bucket, PDFs to pdf-imports)
    const bucket = asImage ? "image-imports" : "pdf-imports";
    const storagePath = `${source.store_id}/${hash}.${ext}`;
    const contentType = asImage
      ? (ext === "jpg" ? "image/jpeg" : ext === "webp" ? "image/webp" : "image/png")
      : "application/pdf";

    const { error: uploadError } = await getSupabaseAdmin().storage
      .from(bucket)
      .upload(storagePath, buffer, { contentType, upsert: true });

    if (uploadError) {
      console.error(`[CRON] ${typeLabel} ${i + 1}/${files.length}: upload failed — ${JSON.stringify(uploadError)}`);
      continue;
    }

    // Create or reuse import record
    let importId: string;

    if (existingRecord) {
      await getSupabaseAdmin()
        .from("pdf_imports")
        .update({
          status: "pending",
          error_message: null,
          storage_path: storagePath,
          source_url: source.url,
          attempt_count: existingRecord.attempt_count + 1,
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
          status: "pending",
          attempt_count: 1,
        })
        .select("id")
        .single();

      if (insertError || !inserted) {
        console.error(`[CRON] ${typeLabel} ${i + 1}/${files.length}: failed to create record: ${insertError?.message}`);
        continue;
      }
      importId = (inserted as { id: string }).id;
    }

    dispatched.push({ sourceId: source.id, importId, filename });
  }

  // Update source tracking
  await getSupabaseAdmin()
    .from("store_pdf_sources")
    .update({ last_checked_at: new Date().toISOString() })
    .eq("id", source.id);

  return { dispatched, skipped };
}
