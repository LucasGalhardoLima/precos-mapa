import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "../../..");
const read = (p: string) => readFileSync(resolve(root, p), "utf8");

const migration = read("supabase/migrations/085_product_categories_l2.sql");
const seeded = [
  ...migration.matchAll(/^\s*\('([a-z-]+)',\s*'(cat_[a-z]+)',\s*'[^']+',\s*\d+\)/gm),
].map((m) => ({ id: m[1], department: m[2] }));

const leaves: { id: number; path: string }[] = JSON.parse(
  read("scripts/.scrape-savegnago-categories.json"),
);

const [, ...lines] = read("scripts/savegnago-leaf-category-map.tsv").trimEnd().split("\n");
const map = lines.map((l) => {
  const [leafId, path, category, reason] = l.split("\t");
  return { leafId: Number(leafId), path, category, reason };
});

describe("product_categories seed (migration 085)", () => {
  it("seeds the 64 rows (61 of the PRD table + 3 from the phase A review), with unique ids", () => {
    expect(seeded).toHaveLength(64);
    expect(new Set(seeded.map((c) => c.id)).size).toBe(64);
  });

  it("puts every category under one of the 12 existing departments", () => {
    const departments = new Set(seeded.map((c) => c.department));
    expect(departments.size).toBe(12);
  });
});

describe("savegnago-leaf-category-map.tsv", () => {
  it("has exactly one row per Savegnago leaf (all 461 ids, no extras)", () => {
    expect(map.map((r) => r.leafId).sort()).toEqual(leaves.map((l) => l.id).sort());
  });

  it("keeps the path in sync with the scraped tree", () => {
    const byId = new Map(leaves.map((l) => [l.id, l.path]));
    for (const r of map) expect(r.path, `leaf ${r.leafId}`).toBe(byId.get(r.leafId));
  });

  it("only uses category_l2 slugs that exist in the taxonomy", () => {
    const slugs = new Set(seeded.map((c) => c.id));
    for (const r of map) if (r.category) expect(slugs.has(r.category), `${r.leafId} → ${r.category}`).toBe(true);
  });

  it("gives every null leaf a reason, and no reason to a mapped leaf", () => {
    for (const r of map) expect(Boolean(r.category) !== Boolean(r.reason), `leaf ${r.leafId}`).toBe(true);
  });
});
