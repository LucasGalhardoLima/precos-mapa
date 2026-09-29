import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { FOOD_SLUGS, refineCategoryL2 } from "../category-refinement";

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

describe("refineCategoryL2 — for kids / brinquedo / kit infantil", () => {
  it("takes such names out of food categories, into outros", () => {
    expect(refineCategoryL2("salgadinhos-snacks", "Batatas Fritas Voadoras For Kids")).toBe("outros");
    expect(refineCategoryL2("doces-chocolates", "Brinquedo Ovo Surpresa")).toBe("outros");
    expect(refineCategoryL2("biscoitos", "Kit Infantil Biscoito e Copo")).toBe("outros");
  });

  it("leaves non-food departments alone, so pet toys stay in pet", () => {
    expect(refineCategoryL2("higiene-acessorios-pet", "Brinquedo Bolinha Pet")).toBe("higiene-acessorios-pet");
    expect(refineCategoryL2("outros", "Kit Infantil de Pintura")).toBe("outros");
    expect(refineCategoryL2("salgadinhos-snacks", "Salgadinho Elma Chips 100g")).toBe("salgadinhos-snacks");
  });
});

describe("FOOD_SLUGS", () => {
  it("is exactly the categories of the food departments in migration 085", () => {
    const sql = readFileSync(resolve(__dirname, "../../../supabase/migrations/085_product_categories_l2.sql"), "utf8");
    const seeded = [...sql.matchAll(/^\s*\('([a-z-]+)',\s*'(cat_[a-z]+)',/gm)].map((m) => ({ id: m[1], department: m[2] }));
    const food = new Set(["cat_alimentos", "cat_bebidas", "cat_laticinios", "cat_carnes", "cat_congelados", "cat_hortifruti", "cat_padaria"]);
    expect(seeded).toHaveLength(64);
    expect(new Set(seeded.filter((c) => food.has(c.department)).map((c) => c.id))).toEqual(new Set(FOOD_SLUGS));
  });
});
