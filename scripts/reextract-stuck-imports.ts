/**
 * Bulk re-extraction for pdf_imports stuck in needs_review because every
 * extraction pass failed with a Vercel AI Gateway / Anthropic credit-balance
 * error (see git history around 2026-07-20 for the diagnosis). Only targets
 * PDF filenames — image imports (jpg/png/webp) fail for an unrelated reason
 * and are left alone.
 *
 * For each matching row: resets extraction_pass_1/2/3, consensus_result,
 * consensus_type, confidence_score, error_message, processed_at,
 * selected_pass to null and status to "pending" (same reset as the
 * dashboard's "Re-executar" button / reExtractImport()), then POSTs to
 * /api/cron/process-single-pdf and waits for the result. Runs with limited
 * concurrency against a local dev server, using the direct-Anthropic
 * fallback added to src/lib/crawler/service.ts (no Vercel AI Gateway
 * involved, so today's Gateway balance doesn't matter for this run).
 *
 * Usage (Node 20+, with `npm run dev` already running on :3000):
 *   npx tsx --env-file=.env.local scripts/reextract-stuck-imports.ts           # dry run (lists targets)
 *   npx tsx --env-file=.env.local scripts/reextract-stuck-imports.ts --apply    # actually re-extract
 *
 * Required env:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   CRON_SECRET
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CRON_SECRET = process.env.CRON_SECRET;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
if (!CRON_SECRET) {
  console.error("Missing CRON_SECRET");
  process.exit(1);
}

const APPLY = process.argv.includes("--apply");
const APP_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const CONCURRENCY = 4;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const IMAGE_EXT = /\.(jpe?g|png|webp)$/i;

interface Row {
  id: string;
  filename: string;
}

async function resetImport(id: string) {
  await supabase
    .from("pdf_imports")
    .update({
      status: "pending",
      extraction_pass_1: null,
      extraction_pass_2: null,
      extraction_pass_3: null,
      consensus_result: null,
      consensus_type: null,
      confidence_score: null,
      error_message: null,
      processed_at: null,
      selected_pass: null,
    })
    .eq("id", id);
}

async function reextractOne(row: Row): Promise<{ id: string; ok: boolean; status?: string; detail?: string }> {
  await resetImport(row.id);

  try {
    const res = await fetch(`${APP_URL}/api/cron/process-single-pdf`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${CRON_SECRET}`,
      },
      body: JSON.stringify({ importId: row.id }),
    });
    const body = await res.json().catch(() => ({}));
    return { id: row.id, ok: res.ok, status: body.status, detail: JSON.stringify(body) };
  } catch (err) {
    return { id: row.id, ok: false, detail: err instanceof Error ? err.message : String(err) };
  }
}

async function runPool<T, R>(items: T[], size: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;

  async function runner() {
    while (next < items.length) {
      const i = next++;
      results[i] = await worker(items[i]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(size, items.length) }, runner));
  return results;
}

async function main() {
  const { data, error } = await supabase
    .from("pdf_imports")
    .select("id, filename")
    .eq("status", "needs_review");

  if (error) {
    console.error("Failed to query pdf_imports:", error.message);
    process.exit(1);
  }

  const rows = ((data ?? []) as Row[]).filter((r) => !IMAGE_EXT.test(r.filename));

  if (rows.length === 0) {
    console.log("No stuck PDF imports found. Nothing to do.");
    return;
  }

  console.log(`Found ${rows.length} stuck PDF import(s) to re-extract.\n`);

  if (!APPLY) {
    for (const r of rows) console.log(`- [DRY RUN] ${r.id} (${r.filename})`);
    console.log("\nDry run only — re-run with --apply to actually re-extract.");
    return;
  }

  let doneCount = 0;
  let needsReviewCount = 0;
  let errorCount = 0;
  let processed = 0;

  const results = await runPool(rows, CONCURRENCY, async (row) => {
    const result = await reextractOne(row);
    processed++;
    console.log(`[${processed}/${rows.length}] ${row.filename}: ${result.ok ? result.status : "REQUEST FAILED"} ${result.detail ?? ""}`);
    if (result.status === "done") doneCount++;
    else if (result.status === "needs_review") needsReviewCount++;
    else errorCount++;
    return result;
  });

  console.log(`\nDone. ${doneCount} published, ${needsReviewCount} still needs_review, ${errorCount} errored.`);
  const failures = results.filter((r) => !r.ok || r.status !== "done");
  if (failures.length > 0) {
    console.log(`\n${failures.length} import(s) did not fully succeed:`);
    for (const f of failures) console.log(`  ${f.id}: ${f.detail}`);
  }
}

main();
