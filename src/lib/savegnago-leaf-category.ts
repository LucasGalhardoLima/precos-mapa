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

// Slugs of the Higiene department (product_categories.department_id = 'cat_higiene').
const HIGIENE_SLUGS = new Set([
  "papel-higienico-lencos", "cabelo", "corpo-banho", "saude-bucal", "higiene-intima-absorventes", "beleza-maquiagem",
]);

// A JS \b does not treat "ê" as a word character, so the boundary is spelled out.
const BABY_RE = /(?<![a-zà-ú])(?:beb[êe]s?|baby|infantil)(?![a-zà-ú])/i;

/**
 * Name-based corrections applied on top of a leaf's category (the tree only knows the
 * shelf, not what the product is). PM decisions from the audit of the sample:
 *  - a Higiene product with bebê / baby / infantil in the name is "higiene-infantil";
 *  - paper towels ("toalha de papel", "papel toalha") are "papel-higienico-lencos", even
 *    though Savegnago shelves them with disposables;
 *  - "defensivo" (garden pesticide, shelved under Jardinagem) is "inseticidas-odorizadores".
 */
export function refineCategoryL2(slug: string, name: string): string {
  if (/(?<![a-zà-ú])defensivo(?![a-zà-ú])/i.test(name)) return "inseticidas-odorizadores";
  if (/toalhas?\s+(?:de\s+)?papel|papel\s+toalha/i.test(name)) return "papel-higienico-lencos";
  // "Giovanna Baby" is a fragrance brand (deodorants, body splash), not a baby product.
  if (HIGIENE_SLUGS.has(slug) && BABY_RE.test(name.replace(/giovanna\s+baby/gi, " "))) return "higiene-infantil";
  return slug;
}
