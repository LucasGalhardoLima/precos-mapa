/**
 * Re-applies the size parser (src/lib/parse-product-size.ts) to products whose stored
 * size came from an earlier version of it. Needed after parser fixes (dimensions read
 * as size, per-item vs pack totals): new products are parsed at creation, existing rows
 * are not.
 *
 * Only rows whose stored size equals what the *previous* parser returned are touched
 * (regex-derived). A row whose size came from somewhere else — e.g. the local-LLM
 * backfill (scripts/llm-backfill-product-size.ts) — is left alone, even if the new
 * parser would return null for it.
 *
 * Usage (Node 20+):
 *   git show <commit before the parser change>:src/lib/parse-product-size.ts > /tmp/legacy-parser.ts
 *   npx tsx --env-file=.env.local scripts/reparse-product-size.ts --legacy-parser /tmp/legacy-parser.ts --dry-run
 *   npx tsx --env-file=.env.local scripts/reparse-product-size.ts --legacy-parser /tmp/legacy-parser.ts
 *
 * Writes scripts/.scrape-reparse-size-{dryrun,backup}.csv (id, name, old, new) — the
 * backup is the old values, enough to revert.
 */

import { createClient } from "@supabase/supabase-js";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseProductSize, type ParsedSize } from "../src/lib/parse-product-size";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const DRY_RUN = process.argv.includes("--dry-run");
const legacyArg = process.argv.indexOf("--legacy-parser");
if (legacyArg === -1 || !process.argv[legacyArg + 1]) {
  console.error("Missing --legacy-parser <file> (the previous parse-product-size.ts, see usage)");
  process.exit(1);
}
const PAGE = 1000;
const WRITE_BATCH = 1000;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

interface Row {
  id: string;
  name: string;
  size_value: number | null;
  size_unit: string | null;
}

const fmt = (s: { value: number; unit: string } | null) => (s ? `${s.value} ${s.unit}` : "");
const same = (a: ParsedSize | null, b: ParsedSize | null) => (a === null ? b === null : b !== null && a.value === b.value && a.unit === b.unit);

async function main() {
  const legacy = (await import(pathToFileURL(resolve(process.argv[legacyArg + 1])).href)) as {
    parseProductSize: (name: string) => ParsedSize | null;
  };

  const rows: Row[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase.from("products").select("id, name, size_value, size_unit").order("id").range(from, from + PAGE - 1);
    if (error) throw new Error(`read products: ${error.message}`);
    rows.push(...(data as Row[]));
    if (data.length < PAGE) break;
  }

  const changes: { row: Row; old: ParsedSize | null; next: ParsedSize | null }[] = [];
  let notRegexDerived = 0;
  for (const row of rows) {
    const stored: ParsedSize | null = row.size_unit ? { value: Number(row.size_value), unit: row.size_unit as ParsedSize["unit"] } : null;
    const old = legacy.parseProductSize(row.name);
    if (!same(stored, old)) {
      if (stored) notRegexDerived++; // e.g. filled by the LLM pass: not ours to redo
      continue;
    }
    const next = parseProductSize(row.name);
    if (!same(stored, next)) changes.push({ row, old: stored, next });
  }

  const kind = (c: (typeof changes)[number]) => (!c.next ? "size -> no size" : !c.old ? "no size -> size" : c.old.unit !== c.next.unit ? "unit changed" : "value changed");
  const byKind = new Map<string, number>();
  for (const c of changes) byKind.set(kind(c), (byKind.get(kind(c)) ?? 0) + 1);

  const csv = ["id,name,old,new", ...changes.map((c) => [c.row.id, `"${c.row.name.replace(/"/g, '""')}"`, fmt(c.old), fmt(c.next)].join(","))];
  const file = resolve(process.cwd(), `scripts/.scrape-reparse-size-${DRY_RUN ? "dryrun" : "backup"}.csv`);
  writeFileSync(file, csv.join("\n"));

  console.log(`${rows.length} products · ${notRegexDerived} with a stored size that is not the old parser's (left alone) · ${changes.length} would change`);
  for (const [k, n] of byKind) console.log(`  ${n}  ${k}`);
  console.log(`${DRY_RUN ? "Diff" : "Old values"}: ${file}`);
  if (DRY_RUN) return;

  let written = 0;
  for (let i = 0; i < changes.length; i += WRITE_BATCH) {
    const chunk = changes.slice(i, i + WRITE_BATCH).map((c) => ({ id: c.row.id, size_value: c.next?.value ?? null, size_unit: c.next?.unit ?? null }));
    const { error } = await supabase.rpc("bulk_update_product_size", { updates: chunk });
    if (error) throw new Error(`bulk_update_product_size at ${i}: ${error.message}`);
    written += chunk.length;
  }
  console.log(`${written} rows updated.`);
}

main().catch((err) => {
  console.error("Fatal error:", err instanceof Error ? err.message : err);
  process.exit(1);
});
