/**
 * Prunes old files from the import buckets (pdf-imports, image-imports).
 *
 * Why: the daily process-import cron uploads every retailer flyer and never
 * deletes it, and the Storage quota (1 GiB on the Free plan) was exceeded.
 * Files are deleted through the Storage API, NEVER with SQL on
 * storage.objects — SQL only removes the rows and leaves the physical files
 * behind, freeing nothing.
 *
 * Safe by default: without --apply it only LISTS what would be deleted.
 * A file is a candidate only when it was both created AND last written before
 * --before (a re-uploaded old file is kept). --apply additionally needs
 * --expect=<N>, the number of files the dry run printed, so a list that
 * changed in between (or a typo in --before) aborts instead of deleting.
 * Only pdf-imports and image-imports are ever touched.
 *
 * Usage (Node 20+):
 *   npx tsx --env-file=.env.local scripts/prune-import-storage.ts --before=2026-08-01
 *   npx tsx --env-file=.env.local scripts/prune-import-storage.ts --before=2026-08-01 --out=prune-list.json
 *   npx tsx --env-file=.env.local scripts/prune-import-storage.ts --before=2026-08-01 --apply --expect=391
 *
 * Required env:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Side effect to know: pdf_imports.storage_path rows for deleted files keep
 * pointing at files that no longer exist, so re-processing those old imports
 * will fail to download. This script does not touch the database.
 */

import { writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import {
  IMPORT_BUCKETS,
  assertSafeCutoff,
  chunk,
  collectObjects,
  formatMB,
  selectForDeletion,
  summarize,
  type ListEntry,
  type StoredObject,
} from "../src/lib/storage-retention";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((a) => a.startsWith(prefix))?.slice(prefix.length);
}

const BEFORE = arg("before");
const APPLY = process.argv.includes("--apply");
const EXPECT = arg("expect");
const OUT = arg("out");
const DELETE_BATCH = 100;

if (!BEFORE) {
  console.error("Missing --before=YYYY-MM-DD (delete files older than this date)");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });

function explain(error: { message?: string }): string {
  const message = error.message ?? String(error);
  return /restricted|exceed_storage_size_quota|402/i.test(message)
    ? `${message}\n  (the project is restricted: the Storage API is blocked until usage is back under the quota or the plan changes)`
    : message;
}

async function listAll(): Promise<StoredObject[]> {
  const all: StoredObject[] = [];
  for (const bucket of IMPORT_BUCKETS) {
    const objects = await collectObjects(bucket, async (prefix, offset, limit) => {
      const { data, error } = await supabase.storage
        .from(bucket)
        .list(prefix, { limit, offset, sortBy: { column: "name", order: "asc" } });
      if (error) throw new Error(`list ${bucket}/${prefix} failed: ${explain(error)}`);
      return (data ?? []) as unknown as ListEntry[];
    });
    all.push(...objects);
  }
  return all;
}

function printSummary(label: string, objects: StoredObject[]) {
  const { perBucket, total } = summarize(objects);
  console.log(`${label}: ${total.count} files, ${formatMB(total.bytes)}`);
  for (const [bucket, t] of Object.entries(perBucket)) {
    console.log(`  ${bucket}: ${t.count} files, ${formatMB(t.bytes)}`);
  }
}

async function main() {
  assertSafeCutoff(BEFORE!, new Date());
  console.log(`Target: ${new URL(SUPABASE_URL!).host}`);
  console.log(`Buckets: ${IMPORT_BUCKETS.join(", ")} | before ${BEFORE} | ${APPLY ? "APPLY" : "DRY RUN (nothing is deleted)"}\n`);

  const all = await listAll();
  const doomed = selectForDeletion(all, BEFORE!);
  const doomedPaths = new Set(doomed.map((o) => `${o.bucket}/${o.path}`));
  const kept = all.filter((o) => !doomedPaths.has(`${o.bucket}/${o.path}`));

  printSummary("Current", all);
  printSummary("To delete", doomed);
  printSummary("Would remain", kept);

  const oldest = [...doomed].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  if (oldest.length > 0) {
    console.log(`\nOldest candidate: ${oldest[0].bucket}/${oldest[0].path} (${oldest[0].createdAt})`);
    console.log(`Newest candidate: ${oldest[oldest.length - 1].bucket}/${oldest[oldest.length - 1].path} (${oldest[oldest.length - 1].createdAt})`);
  }

  if (OUT) {
    writeFileSync(OUT, JSON.stringify(doomed, null, 2));
    console.log(`\nFull candidate list written to ${OUT}`);
  }

  if (!APPLY) {
    console.log(`\nDRY RUN — nothing was deleted. To delete exactly these ${doomed.length} files:`);
    console.log(`  add --apply --expect=${doomed.length}`);
    return;
  }

  if (EXPECT !== String(doomed.length)) {
    console.error(`\nAborting: --apply needs --expect=${doomed.length} (got ${EXPECT ?? "nothing"}). Nothing was deleted.`);
    process.exit(1);
  }

  let deleted = 0;
  for (const bucket of IMPORT_BUCKETS) {
    const paths = doomed.filter((o) => o.bucket === bucket).map((o) => o.path);
    for (const batch of chunk(paths, DELETE_BATCH)) {
      const { data, error } = await supabase.storage.from(bucket).remove(batch);
      if (error) {
        console.error(`\nStopped: remove from ${bucket} failed after ${deleted} deleted — ${explain(error)}`);
        process.exit(1);
      }
      deleted += data?.length ?? 0;
      console.log(`  ${bucket}: removed ${data?.length ?? 0}/${batch.length} (total ${deleted}/${doomed.length})`);
    }
  }

  console.log("\nRe-listing to confirm...");
  printSummary("Remaining", await listAll());
  if (deleted !== doomed.length) {
    console.error(`\nWarning: ${doomed.length} files were selected but the API reported ${deleted} removed. Check the bucket in the dashboard ("Inspect bucket").`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
