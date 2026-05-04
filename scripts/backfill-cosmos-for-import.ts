/**
 * One-off backfill: enrich every product attached to a given pdf_import via
 * Cosmos by Bluesoft. Pulls product rows referenced by the import's
 * promotions, skips rows that already have an EAN, and calls
 * enrichProductFromCosmos for the rest.
 *
 * Usage (Node 20+):
 *   npx tsx --env-file=.env.local scripts/backfill-cosmos-for-import.ts <importId>
 *
 * Required env:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   COSMOS_API_TOKEN
 */

import { createClient } from "@supabase/supabase-js";
import { enrichProductFromCosmos } from "../src/lib/product-match";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
if (!process.env.COSMOS_API_TOKEN) {
  console.error("Missing COSMOS_API_TOKEN");
  process.exit(1);
}

const importId = process.argv[2];
if (!importId) {
  console.error("Usage: npx tsx scripts/backfill-cosmos-for-import.ts <importId>");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

interface ProductRow {
  id: string;
  name: string;
  brand: string | null;
  ean: string | null;
}

async function main() {
  const { data, error } = await supabase
    .from("promotions")
    .select("products(id, name, brand, ean)")
    .eq("pdf_import_id", importId);

  if (error) {
    console.error("Query failed:", error);
    process.exit(1);
  }

  const unique = new Map<string, ProductRow>();
  for (const row of data ?? []) {
    const product = (row as { products: ProductRow | ProductRow[] | null }).products;
    if (!product) continue;
    const p = Array.isArray(product) ? product[0] : product;
    if (!p || p.ean) continue;
    unique.set(p.id, p);
  }

  if (unique.size === 0) {
    console.log(`No products to enrich for import ${importId} (all have EAN or import has no promotions).`);
    return;
  }

  console.log(`Enriching ${unique.size} product(s) from import ${importId}...`);
  let enriched = 0;
  let unchanged = 0;

  for (const product of unique.values()) {
    process.stdout.write(`  ${product.name.padEnd(60)} ... `);
    await enrichProductFromCosmos(supabase, product.id, product.name, product.brand);

    const { data: after } = await supabase
      .from("products")
      .select("ean")
      .eq("id", product.id)
      .maybeSingle();

    if (after?.ean) {
      console.log(`ean=${after.ean}`);
      enriched++;
    } else {
      console.log("(no Cosmos match)");
      unchanged++;
    }

    await new Promise((r) => setTimeout(r, 400));
  }

  console.log(`\nDone. Enriched ${enriched}, unchanged ${unchanged}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
