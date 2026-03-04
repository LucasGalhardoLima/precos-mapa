import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { discoverAndDownloadAllPdfs } from "@/lib/crawler/service";
import { getSupabaseAdmin } from "@/lib/supabase-server";

interface PdfSource {
  id: string;
  store_id: string;
  url: string;
  label: string | null;
  last_hash: string | null;
}

function validateCronSecret(request: NextRequest): boolean {
  const authHeader = request.headers.get("authorization");
  return authHeader === `Bearer ${process.env.CRON_SECRET}`;
}

function getAppUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")
  );
}

/**
 * Dispatch worker invocations in parallel and await all responses.
 * Each worker runs in its own Vercel serverless invocation (~1 min each).
 * Running in parallel, total time ≈ slowest worker (well within 5 min).
 */
async function dispatchWorkers(importIds: string[]): Promise<void> {
  const appUrl = getAppUrl();
  const cronSecret = process.env.CRON_SECRET;

  const results = await Promise.allSettled(
    importIds.map(async (importId) => {
      const res = await fetch(`${appUrl}/api/cron/process-single-pdf`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${cronSecret}`,
        },
        body: JSON.stringify({ importId }),
      });
      const body = await res.json();
      console.log(`[CRON] Worker ${importId}: ${res.status} — ${JSON.stringify(body)}`);
      return body;
    }),
  );

  const failed = results.filter((r) => r.status === "rejected");
  if (failed.length > 0) {
    console.error(`[CRON] ${failed.length} worker(s) failed to dispatch`);
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
    .select("id, store_id, url, label, last_hash")
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

async function discoverAndPrepare(source: PdfSource): Promise<{
  dispatched: { sourceId: string; importId: string; filename: string }[];
  skipped: { sourceId: string; filename: string; reason: string }[];
}> {
  const pdfs = await discoverAndDownloadAllPdfs(source.url);
  console.log(`[CRON] Source ${source.id}: discovered ${pdfs.length} PDF(s)`);

  const dispatched: { sourceId: string; importId: string; filename: string }[] = [];
  const skipped: { sourceId: string; filename: string; reason: string }[] = [];

  for (let i = 0; i < pdfs.length; i++) {
    const { pdfBuffer, filename: discoveredFilename } = pdfs[i];
    const hash = createHash("sha256").update(pdfBuffer).digest("hex");
    const filename = source.label
      ? `${source.label.replace(/[^a-zA-Z0-9_-]/g, "_")}_${i + 1}.pdf`
      : discoveredFilename;

    console.log(`[CRON] PDF ${i + 1}/${pdfs.length}: ${filename} (hash: ${hash.slice(0, 8)}, ${pdfBuffer.byteLength} bytes)`);

    // DB dedup
    const { data: existing } = await getSupabaseAdmin()
      .from("pdf_imports")
      .select("id, status")
      .eq("store_id", source.store_id)
      .eq("file_hash", hash)
      .maybeSingle();

    const existingRecord = existing as { id: string; status: string } | null;

    if (existingRecord?.status === "done") {
      console.log(`[CRON] PDF ${i + 1}/${pdfs.length}: skipped (already done)`);
      skipped.push({ sourceId: source.id, filename, reason: "already_done" });
      continue;
    }

    // Upload to storage
    const storagePath = `${source.store_id}/${hash}.pdf`;
    await getSupabaseAdmin().storage
      .from("pdf-imports")
      .upload(storagePath, pdfBuffer, {
        contentType: "application/pdf",
        upsert: true,
      });

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
        })
        .select("id")
        .single();

      if (insertError || !inserted) {
        console.error(`[CRON] PDF ${i + 1}/${pdfs.length}: failed to create record: ${insertError?.message}`);
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
