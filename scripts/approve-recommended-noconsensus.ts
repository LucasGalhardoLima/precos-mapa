/**
 * One-off cleanup: auto-approve the "recommended" extraction pass for every
 * pdf_imports row stuck in needs_review — the same "Aprovar Pass N
 * (recomendado)" action available in /painel/super/moderacao, run in bulk.
 * Covers every needs_review reason the dashboard surfaces (no consensus,
 * duplicate product matches, low-confidence flags) since the dashboard
 * itself doesn't distinguish between them.
 *
 * "Recommended" pass = same selection the moderation UI highlights
 * (import-review-card.tsx): among the 3 extraction passes, the error-free one
 * with the most products (ties keep the first one found).
 *
 * Usage (Node 20+):
 *   npx tsx --env-file=.env.local scripts/approve-recommended-noconsensus.ts           # dry run
 *   npx tsx --env-file=.env.local scripts/approve-recommended-noconsensus.ts --apply    # publish for real
 *
 * Required env:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from "@supabase/supabase-js";
import { findOrCreateProduct } from "../src/lib/product-match";
import { normalizeCategory, type EncarteProduct } from "../src/lib/schemas";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const APPLY = process.argv.includes("--apply");

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const CATEGORY_DEFAULTS: Record<string, { name: string; icon: string; sort_order: number }> = {
  cat_alimentos: { name: "Alimentos", icon: "wheat", sort_order: 0 },
  cat_bebidas: { name: "Bebidas", icon: "cup-soda", sort_order: 1 },
  cat_limpeza: { name: "Limpeza", icon: "spray-can", sort_order: 2 },
  cat_hortifruti: { name: "Hortifruti", icon: "apple", sort_order: 3 },
  cat_padaria: { name: "Padaria", icon: "croissant", sort_order: 4 },
  cat_higiene: { name: "Higiene", icon: "sparkles", sort_order: 5 },
};

interface PassData {
  products?: EncarteProduct[];
  error?: string;
}

interface PdfImportRow {
  id: string;
  filename: string;
  store_id: string;
  extraction_pass_1: PassData | null;
  extraction_pass_2: PassData | null;
  extraction_pass_3: PassData | null;
}

function bestPass(row: PdfImportRow): { passNumber: 1 | 2 | 3; products: EncarteProduct[] } | null {
  const passes: [PassData | null, PassData | null, PassData | null] = [
    row.extraction_pass_1,
    row.extraction_pass_2,
    row.extraction_pass_3,
  ];

  const candidates = passes
    .map((p, i) => ({
      passNumber: (i + 1) as 1 | 2 | 3,
      products: p?.error ? [] : (p?.products ?? []),
      hasError: !!p?.error,
    }))
    .filter((p) => !p.hasError && p.products.length > 0);

  if (candidates.length === 0) return null;

  const winner = candidates.reduce((a, b) => (a.products.length >= b.products.length ? a : b));
  return { passNumber: winner.passNumber, products: winner.products };
}

async function ensureCategories(products: EncarteProduct[]) {
  const usedCategoryIds = new Set(products.map((p) => normalizeCategory(p.category)));
  for (const catId of usedCategoryIds) {
    const defaults = CATEGORY_DEFAULTS[catId];
    if (!defaults) continue;

    const { data: catCheck } = await supabase.from("categories").select("id").eq("id", catId).maybeSingle();
    if (!catCheck) {
      await supabase.from("categories").insert({ id: catId, ...defaults });
    }
  }
}

async function publishImport(row: PdfImportRow, passNumber: 1 | 2 | 3, products: EncarteProduct[]) {
  await ensureCategories(products);

  const now = new Date().toISOString();
  let published = 0;

  for (const product of products) {
    try {
      const { id: productId } = await findOrCreateProduct(supabase, {
        name: product.name,
        categoryId: normalizeCategory(product.category),
        referencePrice: product.original_price ?? product.price,
      });

      let endDate: string;
      if (product.validity) {
        endDate = new Date(product.validity + "T23:59:59Z").toISOString();
      } else {
        const future = new Date();
        future.setDate(future.getDate() + 7);
        endDate = future.toISOString();
      }

      const originalPrice = product.original_price ?? product.price;

      const { error: promoError } = await supabase.from("promotions").insert({
        store_id: row.store_id,
        product_id: productId,
        original_price: originalPrice,
        promo_price: product.price,
        start_date: now,
        end_date: endDate,
        source: "cron",
        status: "active",
        created_by: null,
        pdf_import_id: row.id,
      });

      if (!promoError) published++;
    } catch {
      continue;
    }
  }

  await supabase
    .from("pdf_imports")
    .update({
      status: "done",
      selected_pass: passNumber,
      reviewed_by: null,
      reviewed_at: now,
      ofertas_count: published,
      consensus_result: { products },
    })
    .eq("id", row.id);

  return published;
}

async function main() {
  const { data, error } = await supabase
    .from("pdf_imports")
    .select("id, filename, store_id, extraction_pass_1, extraction_pass_2, extraction_pass_3")
    .eq("status", "needs_review");

  if (error) {
    console.error("Failed to query pdf_imports:", error.message);
    process.exit(1);
  }

  const rows = (data ?? []) as PdfImportRow[];
  if (rows.length === 0) {
    console.log("No needs_review imports found. Nothing to do.");
    return;
  }

  console.log(`Found ${rows.length} needs_review import(s).\n`);

  let skipped = 0;
  let totalPublished = 0;

  for (const row of rows) {
    const best = bestPass(row);
    if (!best) {
      console.log(`- [SKIP] ${row.id} (${row.filename}): no valid pass with products.`);
      skipped++;
      continue;
    }

    console.log(
      `- ${APPLY ? "[APPLY]" : "[DRY RUN]"} ${row.id} (${row.filename}): pass ${best.passNumber}, ${best.products.length} product(s)`,
    );

    if (APPLY) {
      const published = await publishImport(row, best.passNumber, best.products);
      totalPublished += published;
      console.log(`  -> published ${published}/${best.products.length}`);
    }
  }

  console.log(`\nDone. ${rows.length - skipped}/${rows.length} eligible, ${skipped} skipped (no valid pass).`);
  if (APPLY) {
    console.log(`Total promotions published: ${totalPublished}`);
  } else {
    console.log("Dry run only — re-run with --apply to publish for real.");
  }
}

main();
