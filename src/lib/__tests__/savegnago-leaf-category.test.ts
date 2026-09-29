import { describe, it, expect } from "vitest";
import { parseLeafCategoryTsv, refineCategoryL2, resolveCategoryL2, loadLeafCategoryMap } from "../savegnago-leaf-category";

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

describe("refineCategoryL2", () => {
  it("moves Higiene products with bebê / baby / infantil in the name to higiene-infantil", () => {
    expect(refineCategoryL2("corpo-banho", "Sabonete Infantil Granado Bebê Calêndula 90g")).toBe("higiene-infantil");
    expect(refineCategoryL2("cabelo", "Shampoo Johnson's Baby Cabelos Claros 200ml")).toBe("higiene-infantil");
    expect(refineCategoryL2("cabelo", "Condicionador Infantil Suave Baruel Baby 210ml")).toBe("higiene-infantil");
  });

  it("leaves non-Higiene products and adult Higiene products alone", () => {
    expect(refineCategoryL2("fraldas", "Fralda Bebê Pampers M")).toBe("fraldas");
    expect(refineCategoryL2("alimentacao-infantil", "Papinha Infantil Nestlé 120g")).toBe("alimentacao-infantil");
    expect(refineCategoryL2("corpo-banho", "Sabonete Dove Original 90g")).toBe("corpo-banho");
  });

  it("does not treat the fragrance brand Giovanna Baby as a baby product", () => {
    expect(refineCategoryL2("corpo-banho", "Desodorante Roll On Giovanna Baby 50ml Rosa")).toBe("corpo-banho");
    expect(refineCategoryL2("corpo-banho", "Sabonete Infantil Giovanna Baby Kids")).toBe("higiene-infantil");
  });

  it("does not match inside longer words", () => {
    expect(refineCategoryL2("corpo-banho", "Sabonete Babyliss Pro 90g")).toBe("corpo-banho");
  });

  it("sends paper towels to papel-higienico-lencos and 'defensivo' to inseticidas-odorizadores", () => {
    expect(refineCategoryL2("descartaveis", "Toalha Papel Snob 60 Folhas 2 Unidades Branca")).toBe("papel-higienico-lencos");
    expect(refineCategoryL2("descartaveis", "Papel Toalha Kitchen 2 Rolos")).toBe("papel-higienico-lencos");
    expect(refineCategoryL2("outros", "Defensivo Pronto Fumax 490ml")).toBe("inseticidas-odorizadores");
  });
});
