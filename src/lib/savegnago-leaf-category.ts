/**
 * Savegnago leaf → products.category_l2 (catalog normalization, phase B).
 *
 * The leaf table is scripts/savegnago-leaf-category-map.tsv. A VTEX product
 * carries `categoriesIds` — every category it is listed under, ancestors
 * included ("/15463/15466/15468/"), so one product can sit in several leaves.
 * Only ids that are leaves in the TSV vote; null leaves cast no vote. Leaves
 * that vote for different categories are a conflict and assign nothing — the
 * product stays unassigned and falls to the LLM pass (phase C).
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/** leaf id → category_l2 slug, or null when the leaf is ambiguous. */
export type LeafCategoryMap = Map<number, string | null>;

export function parseLeafCategoryTsv(text: string): LeafCategoryMap {
  const map: LeafCategoryMap = new Map();
  const [, ...lines] = text.trimEnd().split("\n"); // header row
  for (const line of lines) {
    const [leafId, , category] = line.split("\t");
    map.set(Number(leafId), category || null);
  }
  return map;
}

export function loadLeafCategoryMap(root = process.cwd()): LeafCategoryMap {
  return parseLeafCategoryTsv(readFileSync(resolve(root, "scripts/savegnago-leaf-category-map.tsv"), "utf8"));
}

export type CategoryL2Decision =
  | { slug: string }
  | { slug: null; reason: "conflict" | "unmapped" | "unknown_leaf" };

export function resolveCategoryL2(categoriesIds: string[] | undefined, map: LeafCategoryMap): CategoryL2Decision {
  const slugs = new Set<string>();
  let sawLeaf = false;
  for (const path of categoriesIds ?? []) {
    const leafId = Number(path.split("/").filter(Boolean).pop());
    if (!map.has(leafId)) continue; // ancestor node, or a leaf the TSV doesn't know
    sawLeaf = true;
    const slug = map.get(leafId);
    if (slug) slugs.add(slug);
  }
  if (slugs.size > 1) return { slug: null, reason: "conflict" };
  if (slugs.size === 1) return { slug: [...slugs][0] };
  return { slug: null, reason: sawLeaf ? "unmapped" : "unknown_leaf" };
}
