import { describe, it, expect } from "vitest";
import { extractBrand } from "../schemas";

// inferCategoryFromName and normalizeProducts (tested below in the removed
// half of this file) were removed 2026-09-23 along with the encarte
// pipeline that was their only caller. extractBrand survives: still used
// by api/publish-import. Full removed content is in git history (this
// file, pre-removal) if the pipeline ever comes back.
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
