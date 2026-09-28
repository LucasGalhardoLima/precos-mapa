/**
 * Catalog normalization, phase B — assigns products.category_l2 without an LLM.
 *
 *   1. savegnago_tree: walks Savegnago's whole category tree (same requests as
 *      the daily scraper) and, for every product with a valid EAN, resolves its
 *      category_l2 from the leaves it is listed under (see
 *      src/lib/savegnago-leaf-category.ts; conflicting leaves assign nothing).
 *      Products are matched to our catalog by exact EAN; Savegnago items
 *      without an EAN are left for the LLM pass.
 *   2. ean_inherit: a product with no category whose EAN equals a
 *      tree-assigned product's EAN after zero-padding to 14 digits (products.ean
 *      is unique, so the same EAN can only be a *different row* when the
 *      retailers wrote it with different padding) inherits that category.
 *
 * Idempotent: a row with normalized_by set is never touched unless --force.
 *
 * Usage (Node 20+):
 *   npx tsx --env-file=.env.local scripts/backfill-category-l2.ts --dry-run
 *   npx tsx --env-file=.env.local scripts/backfill-category-l2.ts
 *   npx tsx --env-file=.env.local scripts/backfill-category-l2.ts --force
 */

import { createClient } from "@supabase/supabase-js";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  DELAY_MS, MATAO_POSTAL_CODE, MAX_RESULTS_PER_CATEGORY, PAGE_SIZE,
  buildVtexSegmentCookie, fetchCategoryPage, fetchLeafCategories, isValidEan, resolveSellerId, sleep,
} from "../src/lib/savegnago-vtex";
import { loadLeafCategoryMap, resolveCategoryL2 } from "../src/lib/savegnago-leaf-category";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const DRY_RUN = process.argv.includes("--dry-run");
const FORCE = process.argv.includes("--force");
const CHUNK = 200;
const REVIEW_FILE = resolve(process.cwd(), "scripts/.scrape-category-l2-review.csv");

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

function chunks<T>(xs: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += n) out.push(xs.slice(i, i + n));
  return out;
}

const pad14 = (ean: string) => ean.padStart(14, "0");

async function walkTree(): Promise<{ bySlug: Map<string, Set<string>>; stats: Record<string, number>; review: string[] }> {
  const leafMap = loadLeafCategoryMap();
  const leaves = await fetchLeafCategories();
  const cookie = buildVtexSegmentCookie(await resolveSellerId(MATAO_POSTAL_CODE));

  const seen = new Set<string>();
  const bySlug = new Map<string, Set<string>>();
  const stats: Record<string, number> = { products: 0, withEan: 0, noEan: 0, assigned: 0, conflict: 0, unmapped: 0, unknown_leaf: 0 };
  const review = ["ean,name,decision,categories_ids"];

  for (const [i, leaf] of leaves.entries()) {
    let from = 0;
    let count = 0;
    while (from < MAX_RESULTS_PER_CATEGORY) {
      const page = await fetchCategoryPage(leaf.idPath, from, from + PAGE_SIZE - 1, cookie);
      await sleep(DELAY_MS);
      if (page.length === 0) break;
      for (const p of page) {
        count++;
        if (seen.has(p.productId)) continue;
        seen.add(p.productId);
        stats.products++;
        const ean = (p.items ?? []).map((it) => it.ean).find((e) => isValidEan(e));
        if (!ean) {
          stats.noEan++;
          continue;
        }
        stats.withEan++;
        const decision = resolveCategoryL2(p.categoriesIds, leafMap);
        if (decision.slug !== null) {
          stats.assigned++;
          if (!bySlug.has(decision.slug)) bySlug.set(decision.slug, new Set());
          bySlug.get(decision.slug)!.add(ean);
        } else {
          stats[decision.reason]++;
          review.push([ean, `"${p.productName.replace(/"/g, '""')}"`, decision.reason, `"${(p.categoriesIds ?? []).join(" ")}"`].join(","));
        }
      }
      if (page.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }
    if (count >= MAX_RESULTS_PER_CATEGORY) console.warn(`  [WARNING] "${leaf.path}" hit the ${MAX_RESULTS_PER_CATEGORY}-result cap`);
    if ((i + 1) % 25 === 0) console.log(`  ${i + 1}/${leaves.length} leaves, ${stats.products} products`);
  }
  return { bySlug, stats, review };
}

async function writeByEan(bySlug: Map<string, Set<string>>): Promise<number> {
  let written = 0;
  for (const [slug, eans] of bySlug) {
    for (const part of chunks([...eans], CHUNK)) {
      const q = supabase
        .from("products")
        .update({ category_l2: slug, normalized_by: "savegnago_tree", normalized_at: new Date().toISOString() })
        .in("ean", part);
      const { data, error } = await (FORCE ? q : q.is("normalized_by", null)).select("id");
      if (error) throw new Error(`update ${slug}: ${error.message}`);
      written += data?.length ?? 0;
    }
  }
  return written;
}

interface EanRow {
  id: string;
  ean: string;
  category_l2: string | null;
  normalized_by: string | null;
}

async function inheritByPaddedEan(): Promise<{ groups: number; written: number }> {
  const rows: EanRow[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("products")
      .select("id, ean, category_l2, normalized_by")
      .not("ean", "is", null)
      .order("id")
      .range(from, from + 999);
    if (error) throw new Error(`read products: ${error.message}`);
    rows.push(...(data as EanRow[]));
    if (data.length < 1000) break;
  }

  const groups = new Map<string, EanRow[]>();
  for (const r of rows) {
    if (!/^\d+$/.test(r.ean)) continue;
    const key = pad14(r.ean);
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }

  const idsBySlug = new Map<string, string[]>();
  let matched = 0;
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const donors = new Set(group.filter((r) => r.normalized_by === "savegnago_tree" && r.category_l2).map((r) => r.category_l2!));
    if (donors.size !== 1) continue;
    const slug = [...donors][0];
    for (const r of group) {
      if (FORCE ? r.normalized_by === "savegnago_tree" : r.normalized_by !== null) continue;
      matched++;
      idsBySlug.set(slug, [...(idsBySlug.get(slug) ?? []), r.id]);
    }
  }

  let written = 0;
  if (!DRY_RUN) {
    for (const [slug, ids] of idsBySlug) {
      for (const part of chunks(ids, CHUNK)) {
        const q = supabase
          .from("products")
          .update({ category_l2: slug, normalized_by: "ean_inherit", normalized_at: new Date().toISOString() })
          .in("id", part);
        const { data, error } = await (FORCE ? q : q.is("normalized_by", null)).select("id");
        if (error) throw new Error(`inherit ${slug}: ${error.message}`);
        written += data?.length ?? 0;
      }
    }
  }
  return { groups: matched, written };
}

async function main() {
  console.log(`${DRY_RUN ? "DRY RUN — no writes" : FORCE ? "LIVE --force" : "LIVE"}\n`);
  const { bySlug, stats, review } = await walkTree();
  writeFileSync(REVIEW_FILE, review.join("\n"));
  console.log("Tree walk:", stats, `\nUnassigned-product review: ${REVIEW_FILE}`);

  if (DRY_RUN) {
    console.log(`Would write ${[...bySlug.values()].reduce((n, s) => n + s.size, 0)} EANs across ${bySlug.size} categories.`);
  } else {
    console.log(`savegnago_tree: ${await writeByEan(bySlug)} products updated.`);
  }
  const inherit = await inheritByPaddedEan();
  console.log(`ean_inherit: ${inherit.groups} candidate rows, ${inherit.written} updated.`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
