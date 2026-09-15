/**
 * Second-pass size backfill for products the regex parser
 * (src/lib/parse-product-size.ts) left NULL — ~17,236 products as of
 * 2026-09-15, measured after the regex backfill (scripts/backfill-product-size.ts).
 *
 * Uses a LOCAL Ollama model (no API cost, no external network call) rather
 * than a hosted LLM — this was explicitly a "don't spend on LLM API calls"
 * constraint. Idempotent by construction: it only ever selects products
 * WHERE size_unit IS NULL, so re-running after an interruption just picks
 * up wherever it left off — no separate checkpoint file needed.
 *
 * Requires: `ollama serve` running locally with the model pulled
 * (`ollama pull phi4:14b`).
 *
 * Usage (Node 20+):
 *   npx tsx --env-file=.env.local scripts/llm-backfill-product-size.ts
 *   npx tsx --env-file=.env.local scripts/llm-backfill-product-size.ts --dry-run
 *   npx tsx --env-file=.env.local scripts/llm-backfill-product-size.ts --limit 500
 *
 * Required env:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from "@supabase/supabase-js";
import { isSaneSize, type SizeUnit } from "../src/lib/parse-product-size";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const OLLAMA_URL = process.env.OLLAMA_URL ?? "http://localhost:11434";
const MODEL = process.env.OLLAMA_MODEL ?? "phi4:14b";
const FETCH_PAGE = 1000;
const BATCH_SIZE = Number(process.env.LLM_BATCH_SIZE ?? 60);
const DRY_RUN = process.argv.includes("--dry-run");
const limitArg = process.argv.indexOf("--limit");
const LIMIT = limitArg !== -1 ? Number(process.argv[limitArg + 1]) : undefined;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const VALID_UNITS: SizeUnit[] = ["g", "ml", "un", "m"];

const SYSTEM_PROMPT = `You extract package size from Brazilian Portuguese grocery/retail product names.
Only extract a size if a number+unit is LITERALLY present in the text — never invent or estimate typical sizes for a product type.
Normalize unit to exactly one of: g, ml, un, m. Convert kg->g x1000, l/lt->ml x1000, cm->m x0.01, mg->g x0.001, cl->ml x10.
Treat "C/50", "com 50", abbreviations like "1u" as count (un).
Treat a bare weight/volume unit with NO number ("Banana Terra Kg", "Queijo Fatiado Kg" — sold loose by weight) as null for both fields — that's a selling unit, not a pack size.
If no size is stated in the text, both fields are null.
You MUST respond with a single JSON ARRAY containing exactly one object per input item, in the same order, no extra text, no markdown code fences.
Each object: {"id": "<same id as input>", "value": <number|null>, "unit": "g"|"ml"|"un"|"m"|null}`;

interface ProductRow {
  id: string;
  name: string;
}

interface LlmResult {
  id: string;
  value: number | null;
  unit: string | null;
}

async function fetchUnsized(limit?: number): Promise<ProductRow[]> {
  const all: ProductRow[] = [];
  let from = 0;
  for (;;) {
    const pageSize = limit ? Math.min(FETCH_PAGE, limit - all.length) : FETCH_PAGE;
    if (pageSize <= 0) break;
    const { data, error } = await supabase
      .from("products")
      .select("id, name")
      .is("size_unit", null)
      .order("id", { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`fetch failed at offset ${from}: ${error.message}`);
    if (!data?.length) break;
    all.push(...(data as ProductRow[]));
    if (data.length < pageSize) break;
    from += pageSize;
    if (limit && all.length >= limit) break;
  }
  return all;
}

function stripCodeFence(text: string): string {
  const trimmed = text.trim();
  if (!trimmed.startsWith("```")) return trimmed;
  const withoutFirstFence = trimmed.replace(/^```(?:json)?\s*/, "");
  return withoutFirstFence.replace(/```\s*$/, "");
}

async function extractBatch(batch: ProductRow[]): Promise<LlmResult[]> {
  const items = batch.map((p) => ({ id: p.id, name: p.name }));
  const userMsg = `Extract size for these ${items.length} items:\n${JSON.stringify(items)}`;

  const res = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMsg },
      ],
      options: { temperature: 0 },
      stream: false,
    }),
  });
  if (!res.ok) throw new Error(`Ollama HTTP ${res.status}: ${await res.text()}`);
  const body = (await res.json()) as { message: { content: string } };
  const parsed = JSON.parse(stripCodeFence(body.message.content));
  if (!Array.isArray(parsed)) throw new Error("model did not return a JSON array");
  return parsed as LlmResult[];
}

/** Validates one LLM result against the batch it came from + the shared sanity ceilings. Returns null if untrustworthy. */
function validate(result: LlmResult, batchIds: Set<string>): { id: string; size_value: number; size_unit: SizeUnit } | null {
  if (!batchIds.has(result.id)) return null; // model echoed an id we didn't send — discard
  if (result.value === null || result.unit === null) return null;
  if (!VALID_UNITS.includes(result.unit as SizeUnit)) return null;
  const unit = result.unit as SizeUnit;
  if (typeof result.value !== "number" || !isSaneSize(result.value, unit)) return null;
  return { id: result.id, size_value: Math.round(result.value * 100) / 100, size_unit: unit };
}

async function main() {
  console.log(`Fetching products with no size${LIMIT ? ` (limited to ${LIMIT})` : ""}${DRY_RUN ? " — DRY RUN, no writes" : ""}...`);
  const products = await fetchUnsized(LIMIT);
  console.log(`Fetched ${products.length} products. Model: ${MODEL}, batch size: ${BATCH_SIZE}.`);

  const pending: { id: string; size_value: number; size_unit: SizeUnit }[] = [];
  let extracted = 0;
  let rejected = 0;
  let batchFailures = 0;

  const flush = async () => {
    if (DRY_RUN || pending.length === 0) return;
    const chunk = pending.splice(0, pending.length);
    const { error } = await supabase.rpc("bulk_update_product_size", { updates: chunk });
    if (error) console.warn(`  [write failed] ${error.message}`);
  };

  for (let i = 0; i < products.length; i += BATCH_SIZE) {
    const batch = products.slice(i, i + BATCH_SIZE);
    const batchIds = new Set(batch.map((p) => p.id));
    let results: LlmResult[];
    try {
      results = await extractBatch(batch);
    } catch (err) {
      batchFailures++;
      console.warn(`  [batch ${i}-${i + batch.length} failed] ${err instanceof Error ? err.message : err}`);
      continue;
    }

    for (const r of results) {
      const valid = validate(r, batchIds);
      if (valid) {
        extracted++;
        pending.push(valid);
      } else if (r.value !== null || r.unit !== null) {
        rejected++;
      }
    }

    // Flush after every LLM batch, not once WRITE_BATCH accumulates: this is a
    // multi-hour unattended run, and it already got killed once by the host
    // running low on memory mid-run — losing everything since the last flush
    // (WRITE_BATCH=500 meant up to ~6,300 processed items of extraction could
    // vanish unwritten). At most one batch's worth of work (60 items, ~2min)
    // is now at risk instead.
    await flush();

    const done = Math.min(i + BATCH_SIZE, products.length);
    console.log(`  ${done}/${products.length} processed — extracted ${extracted}, rejected ${rejected}, batch failures ${batchFailures}`);
  }

  await flush();
  console.log(`\nDone. Extracted: ${extracted}, rejected (failed validation): ${rejected}, batch failures: ${batchFailures}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
