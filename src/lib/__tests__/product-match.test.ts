import { describe, it, expect } from "vitest";
import { extractSize, isBrandCompatible } from "../product-match";

// ---------------------------------------------------------------------------
// extractSize
// ---------------------------------------------------------------------------

describe("extractSize", () => {
  it("extracts ml sizes", () => {
    expect(extractSize("Coca-Cola 350ml")).toBe("350ml");
    expect(extractSize("Detergente Ypê 500ML")).toBe("500ml");
  });

  it("extracts liter sizes", () => {
    expect(extractSize("Refrigerante 2l")).toBe("2l");
    expect(extractSize("Azeite 500ml")).toBe("500ml");
  });

  it("extracts kg sizes", () => {
    expect(extractSize("Arroz 5kg")).toBe("5kg");
    expect(extractSize("Feijão Carioca 1KG")).toBe("1kg");
  });

  it("extracts gram sizes", () => {
    expect(extractSize("Achocolatado 400g")).toBe("400g");
    expect(extractSize("Macarrão 500G")).toBe("500g");
  });

  it("extracts un sizes", () => {
    expect(extractSize("Ovos 12un")).toBe("12un");
  });

  it("extracts pack sizes", () => {
    expect(extractSize("Cerveja 12pack")).toBe("12pack");
    expect(extractSize("Papel Higiênico 4pct")).toBe("4pct");
  });

  it("extracts decimal sizes", () => {
    expect(extractSize("Leite 1,5l")).toBe("1,5l");
    expect(extractSize("Carne 0.5kg")).toBe("0.5kg");
  });

  it("returns null when no size found", () => {
    expect(extractSize("Banana Prata")).toBeNull();
    expect(extractSize("Pão Francês")).toBeNull();
    expect(extractSize("Produto Genérico")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(extractSize("")).toBeNull();
  });

  it("picks first size token in multi-size names", () => {
    // regex matches first occurrence
    const result = extractSize("Pack 6un Cerveja 350ml");
    expect(result).toBe("6un");
  });
});

// ---------------------------------------------------------------------------
// isBrandCompatible
// ---------------------------------------------------------------------------

describe("isBrandCompatible", () => {
  it("rejects clearly different brands", () => {
    expect(isBrandCompatible("Phenix", "Premium")).toBe(false);
    expect(isBrandCompatible("Ypê", "Omo")).toBe(false);
  });

  it("accepts matching brands ignoring case and surrounding whitespace", () => {
    expect(isBrandCompatible("ypê", "Ypê")).toBe(true);
    expect(isBrandCompatible(" Omo ", "OMO")).toBe(true);
  });

  it("treats either side missing as compatible", () => {
    expect(isBrandCompatible(null, "Premium")).toBe(true);
    expect(isBrandCompatible("Phenix", null)).toBe(true);
    expect(isBrandCompatible(undefined, undefined)).toBe(true);
    expect(isBrandCompatible("", "Premium")).toBe(true);
  });
});
