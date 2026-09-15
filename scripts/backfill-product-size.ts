/**
 * One-off backfill: parses size_value/size_unit for every product from its
 * name via src/lib/parse-product-size.ts (regex + unit normalization, no
 * LLM). Only writes rows where the parser found a confident match — the
 * rest stay NULL for a future LLM pass over the harder ~36%.
 *
 * Usage (Node 20+):
 *   npx tsx --env-file=.env.local scripts/backfill-product-size.ts
 *   npx tsx --env-file=.env.local scripts/backfill-product-size.ts --dry-run
 *
 * Required env:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from "@supabase/supabase-js";
import { parseProductSize } from "../src/lib/parse-product-size";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const DRY_RUN = process.argv.includes("--dry-run");
const PAGE = 1000;
const WRITE_BATCH = 1000;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

interface ProductRow {
  id: string;
  name: string;
}

async function fetchAllProducts(): Promise<ProductRow[]> {
  const all: ProductRow[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from("products")
      .select("id, name")
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`fetch products failed at offset ${from}: ${error.message}`);
    if (!data?.length) break;
    all.push(...(data as ProductRow[]));
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

async function main() {
  console.log(`Fetching products${DRY_RUN ? " (DRY RUN — no writes)" : ""}...`);
  const products = await fetchAllProducts();
  console.log(`Fetched ${products.length} products.`);

  const byUnit: Record<string, number> = { g: 0, ml: 0, un: 0, m: 0 };
  const updates: { id: string; size_value: number; size_unit: string }[] = [];

  for (const p of products) {
    const parsed = parseProductSize(p.name);
    if (!parsed) continue;
    byUnit[parsed.unit]++;
    updates.push({ id: p.id, size_value: parsed.value, size_unit: parsed.unit });
  }

  console.log(`\nParsed: ${updates.length}/${products.length} (${((updates.length / products.length) * 100).toFixed(1)}%)`);
  console.log("By unit:", byUnit);

  if (DRY_RUN) {
    console.log("\nDry run — no writes performed.");
    return;
  }

  console.log(`\nWriting ${updates.length} rows in batches of ${WRITE_BATCH}...`);
  let written = 0;
  let failed = 0;
  for (let i = 0; i < updates.length; i += WRITE_BATCH) {
    const chunk = updates.slice(i, i + WRITE_BATCH);
    const { error } = await supabase.rpc("bulk_update_product_size", { updates: chunk });
    if (error) {
      console.warn(`  [batch ${i}-${i + chunk.length} failed] ${error.message}`);
      failed += chunk.length;
      continue;
    }
    written += chunk.length;
    console.log(`  ${written}/${updates.length} written`);
  }

  console.log(`\nDone. Written: ${written}, failed: ${failed}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
