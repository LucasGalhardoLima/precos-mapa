import { describe, it, expect } from "vitest";
import { parseLeafCategoryTsv, resolveCategoryL2, loadLeafCategoryMap } from "../savegnago-leaf-category";

const map = parseLeafCategoryTsv(
  ["leaf_id\tpath\tcategory_l2\treason_if_null", "1\tA > x\tarroz\t", "2\tA > y\tfeijao-graos\t", "3\tA > z\t\tambígua", "4\tB > w\tarroz\t"].join("\n"),
);

describe("resolveCategoryL2", () => {
  it("assigns the slug of the single leaf, ignoring ancestor ids", () => {
    expect(resolveCategoryL2(["/9/8/1/", "/9/8/", "/9/"], map)).toEqual({ slug: "arroz" });
  });

  it("treats two leaves with the same slug as agreement", () => {
    expect(resolveCategoryL2(["/9/1/", "/7/4/"], map)).toEqual({ slug: "arroz" });
  });

  it("assigns nothing when leaves vote for different categories", () => {
    expect(resolveCategoryL2(["/9/1/", "/9/2/"], map)).toEqual({ slug: null, reason: "conflict" });
  });

  it("lets a null leaf abstain instead of vetoing", () => {
    expect(resolveCategoryL2(["/9/3/", "/9/2/"], map)).toEqual({ slug: "feijao-graos" });
  });

  it("reports an ambiguous-only product as unmapped, and a product in no known leaf as unknown_leaf", () => {
    expect(resolveCategoryL2(["/9/3/"], map)).toEqual({ slug: null, reason: "unmapped" });
    expect(resolveCategoryL2(["/9/99/"], map)).toEqual({ slug: null, reason: "unknown_leaf" });
    expect(resolveCategoryL2(undefined, map)).toEqual({ slug: null, reason: "unknown_leaf" });
  });
});

describe("loadLeafCategoryMap", () => {
  it("loads the real 461-leaf table", () => {
    expect(loadLeafCategoryMap().size).toBe(461);
  });
});
