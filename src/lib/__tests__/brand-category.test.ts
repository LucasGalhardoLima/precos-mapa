import { describe, it, expect } from "vitest";
import {
  extractBrand,
  inferCategoryFromName,
  normalizeProducts,
} from "../schemas";

// ---------------------------------------------------------------------------
// extractBrand
// ---------------------------------------------------------------------------

describe("extractBrand", () => {
  it("extracts known single-word brands", () => {
    expect(extractBrand("Arroz Camil 5kg")).toBe("Camil");
    expect(extractBrand("Detergente Ypê 500ml")).toBe("Ypê");
    expect(extractBrand("Leite Italac Integral 1l")).toBe("Italac");
  });

  it("extracts known multi-word brands", () => {
    expect(extractBrand("Arroz Tio João 5kg")).toBe("Tio João");
    expect(extractBrand("Farinha Dona Benta 1kg")).toBe("Dona Benta");
    expect(extractBrand("Suco Del Valle Uva 1l")).toBe("Del Valle");
  });

  it("is case-insensitive for matching", () => {
    expect(extractBrand("ARROZ CAMIL 5KG")).toBe("Camil");
    expect(extractBrand("cerveja heineken 350ml")).toBe("Heineken");
  });

  it("extracts Coca-Cola with hyphen", () => {
    expect(extractBrand("Refrigerante Coca-Cola 2l")).toBe("Coca-Cola");
  });

  it("extracts brands from realistic PDF names", () => {
    expect(extractBrand("Sabão em Pó Omo 1kg")).toBe("Omo");
    expect(extractBrand("Amaciante Comfort 2l")).toBe("Comfort");
    expect(extractBrand("Macarrão Renata Penne 500g")).toBe("Renata");
    expect(extractBrand("Achocolatado Nescau 400g")).toBe("Nescau");
  });

  it("returns null for unrecognized brands", () => {
    expect(extractBrand("Arroz 5kg")).toBeNull();
    expect(extractBrand("Detergente 500ml")).toBeNull();
  });

  it("does not confuse product type words with brands", () => {
    // "Arroz" is a product type, not a brand
    expect(extractBrand("Arroz Integral 1kg")).not.toBe("Arroz");
  });
});

// ---------------------------------------------------------------------------
// inferCategoryFromName
// ---------------------------------------------------------------------------

describe("inferCategoryFromName", () => {
  it("classifies beverages", () => {
    expect(inferCategoryFromName("Cerveja Skol 350ml")).toBe("cat_bebidas");
    expect(inferCategoryFromName("Refrigerante Coca-Cola 2l")).toBe("cat_bebidas");
    expect(inferCategoryFromName("Suco de Laranja Del Valle 1l")).toBe("cat_bebidas");
    expect(inferCategoryFromName("Vinho Tinto Suave 750ml")).toBe("cat_bebidas");
    expect(inferCategoryFromName("Água Mineral 500ml")).toBe("cat_bebidas");
  });

  it("classifies cleaning products", () => {
    expect(inferCategoryFromName("Detergente Ypê 500ml")).toBe("cat_limpeza");
    expect(inferCategoryFromName("Sabão em Pó Omo 1kg")).toBe("cat_limpeza");
    expect(inferCategoryFromName("Amaciante Comfort 2l")).toBe("cat_limpeza");
    expect(inferCategoryFromName("Desinfetante Pinho Sol 500ml")).toBe("cat_limpeza");
    expect(inferCategoryFromName("Água Sanitária 1l")).toBe("cat_limpeza");
  });

  it("classifies produce", () => {
    expect(inferCategoryFromName("Banana Prata")).toBe("cat_hortifruti");
    expect(inferCategoryFromName("Tomate Italiano")).toBe("cat_hortifruti");
    expect(inferCategoryFromName("Batata Lavada")).toBe("cat_hortifruti");
    expect(inferCategoryFromName("Morango Bandeja 300g")).toBe("cat_hortifruti");
  });

  it("classifies bakery", () => {
    expect(inferCategoryFromName("Pão Francês")).toBe("cat_padaria");
    expect(inferCategoryFromName("Bolo de Chocolate")).toBe("cat_padaria");
    expect(inferCategoryFromName("Panetone Bauducco 500g")).toBe("cat_padaria");
  });

  it("classifies hygiene", () => {
    expect(inferCategoryFromName("Shampoo Dove 400ml")).toBe("cat_higiene");
    expect(inferCategoryFromName("Papel Higiênico Neve 12un")).toBe("cat_higiene");
    expect(inferCategoryFromName("Creme Dental Colgate 90g")).toBe("cat_higiene");
    expect(inferCategoryFromName("Fralda Pampers M 40un")).toBe("cat_higiene");
  });

  it("classifies food staples", () => {
    expect(inferCategoryFromName("Arroz Camil 5kg")).toBe("cat_alimentos");
    expect(inferCategoryFromName("Feijão Carioca Kicaldo 1kg")).toBe("cat_alimentos");
    expect(inferCategoryFromName("Macarrão Renata Penne 500g")).toBe("cat_alimentos");
    expect(inferCategoryFromName("Óleo de Soja Liza 900ml")).toBe("cat_alimentos");
  });

  it("returns null for unrecognizable products", () => {
    expect(inferCategoryFromName("Produto Genérico XYZ")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// normalizeProducts — brand and category enrichment
// ---------------------------------------------------------------------------

describe("normalizeProducts brand/category enrichment", () => {
  it("extracts brand from product name during normalization", () => {
    const result = normalizeProducts([
      { name: "Arroz Camil 5kg", price: 24.9, unit: "un", validity: null },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].brand).toBe("Camil");
  });

  it("infers category from product name when not provided", () => {
    const result = normalizeProducts([
      { name: "Cerveja Skol 350ml", price: 3.5, unit: "un", validity: null },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].category).toBe("cat_bebidas");
  });

  it("infers category when default cat_alimentos would be assigned but keyword matches another", () => {
    const result = normalizeProducts([
      { name: "Detergente Ypê 500ml", price: 2.5, unit: "un", validity: null },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].category).toBe("cat_limpeza");
  });

  it("preserves explicit non-default category from input", () => {
    const result = normalizeProducts([
      {
        name: "Produto Teste",
        price: 10,
        unit: "un",
        validity: null,
        category: "Bebidas",
      },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].category).toBe("cat_bebidas");
  });

  it("does not add brand field when no brand is detected", () => {
    const result = normalizeProducts([
      { name: "Arroz Integral 1kg", price: 8.9, unit: "kg", validity: null },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].brand).toBeUndefined();
  });
});
