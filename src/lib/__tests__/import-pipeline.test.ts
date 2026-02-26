import { describe, it, expect } from "vitest";
import { computeConsensus, PassResult } from "../import-consensus";
import { EncarteProduct } from "../schemas";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeProduct(overrides: Partial<EncarteProduct> = {}): EncarteProduct {
  return {
    name: "Arroz Tio Joao 5kg",
    price: 24.9,
    unit: "un",
    validity: null,
    category: "cat_alimentos",
    ...overrides,
  };
}

function makePass(index: number, products: EncarteProduct[], error?: string): PassResult {
  return { passIndex: index, products, error };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("computeConsensus", () => {
  it("returns unanimous when all 3 passes are identical", () => {
    const products = [
      makeProduct({ name: "Arroz Tio Joao 5kg", price: 24.9, unit: "un" }),
      makeProduct({ name: "Feijao Carioca 1kg", price: 8.49, unit: "kg" }),
    ];

    const result = computeConsensus([
      makePass(0, products),
      makePass(1, products),
      makePass(2, products),
    ]);

    expect(result.type).toBe("unanimous");
    expect(result.confidenceScore).toBe(100);
    expect(result.consensusProducts).toHaveLength(2);
    expect(result.selectedPassIndex).toBe(0);
  });

  it("returns unanimous even when non-core fields differ (validity, category, original_price)", () => {
    const base = [
      makeProduct({ name: "Leite Integral 1L", price: 5.99, unit: "l" }),
    ];

    // Same core fields but different validity/category/original_price
    const pass1 = [makeProduct({ name: "Leite Integral 1L", price: 5.99, unit: "l", validity: "2026-03-01", category: "cat_bebidas", original_price: 7.99 })];
    const pass2 = [makeProduct({ name: "Leite Integral 1L", price: 5.99, unit: "l", validity: "2026-03-15", category: "cat_alimentos" })];
    const pass3 = [makeProduct({ name: "Leite Integral 1L", price: 5.99, unit: "l", validity: null, category: "cat_bebidas", original_price: 6.99 })];

    const result = computeConsensus([
      makePass(0, pass1),
      makePass(1, pass2),
      makePass(2, pass3),
    ]);

    expect(result.type).toBe("unanimous");
    expect(result.confidenceScore).toBe(100);
  });

  it("returns majority when 2 of 3 passes agree", () => {
    const matching = [
      makeProduct({ name: "Coca Cola 2L", price: 9.99, unit: "un" }),
      makeProduct({ name: "Pepsi 2L", price: 8.49, unit: "un" }),
    ];

    const different = [
      makeProduct({ name: "Coca Cola 2L", price: 9.99, unit: "un" }),
      makeProduct({ name: "Guarana 2L", price: 7.99, unit: "un" }),
    ];

    const result = computeConsensus([
      makePass(0, matching),
      makePass(1, different),
      makePass(2, matching),
    ]);

    expect(result.type).toBe("majority");
    expect(result.confidenceScore).toBe(66.67);
    expect(result.consensusProducts).toHaveLength(2);
    expect(result.consensusProducts![0].name).toBe("Coca Cola 2L");
  });

  it("returns none when all 3 passes differ", () => {
    const pass1 = [makeProduct({ name: "Produto A", price: 10, unit: "un" })];
    const pass2 = [makeProduct({ name: "Produto B", price: 20, unit: "kg" })];
    const pass3 = [makeProduct({ name: "Produto C", price: 30, unit: "l" })];

    const result = computeConsensus([
      makePass(0, pass1),
      makePass(1, pass2),
      makePass(2, pass3),
    ]);

    expect(result.type).toBe("none");
    expect(result.confidenceScore).toBe(0);
    expect(result.consensusProducts).toBeNull();
    expect(result.selectedPassIndex).toBeNull();
  });

  it("returns majority when 1 error + 2 identical passes", () => {
    const products = [
      makeProduct({ name: "Arroz 5kg", price: 24.9, unit: "un" }),
    ];

    const result = computeConsensus([
      makePass(0, [], "Timeout na extracao"),
      makePass(1, products),
      makePass(2, products),
    ]);

    expect(result.type).toBe("majority");
    expect(result.confidenceScore).toBe(66.67);
    expect(result.consensusProducts).toHaveLength(1);
  });

  it("returns none when all passes error", () => {
    const result = computeConsensus([
      makePass(0, [], "Error 1"),
      makePass(1, [], "Error 2"),
      makePass(2, [], "Error 3"),
    ]);

    expect(result.type).toBe("none");
    expect(result.confidenceScore).toBe(0);
    expect(result.consensusProducts).toBeNull();
  });

  it("returns none when only 1 valid pass out of 3", () => {
    const products = [
      makeProduct({ name: "Arroz 5kg", price: 24.9, unit: "un" }),
    ];

    const result = computeConsensus([
      makePass(0, products),
      makePass(1, [], "Error"),
      makePass(2, [], "Error"),
    ]);

    expect(result.type).toBe("none");
    expect(result.confidenceScore).toBe(0);
    expect(result.consensusProducts).toBeNull();
  });

  it("comparison is case-insensitive and trim-aware", () => {
    const pass1 = [makeProduct({ name: "  Arroz TIO JOAO 5kg  ", price: 24.9, unit: "un" })];
    const pass2 = [makeProduct({ name: "arroz tio joao 5kg", price: 24.9, unit: "un" })];
    const pass3 = [makeProduct({ name: "ARROZ TIO JOAO 5KG", price: 24.9, unit: "un" })];

    const result = computeConsensus([
      makePass(0, pass1),
      makePass(1, pass2),
      makePass(2, pass3),
    ]);

    expect(result.type).toBe("unanimous");
    expect(result.confidenceScore).toBe(100);
  });

  it("comparison is order-independent (Set-based)", () => {
    const productA = makeProduct({ name: "Produto A", price: 10, unit: "un" });
    const productB = makeProduct({ name: "Produto B", price: 20, unit: "kg" });

    const result = computeConsensus([
      makePass(0, [productA, productB]),
      makePass(1, [productB, productA]),
      makePass(2, [productA, productB]),
    ]);

    expect(result.type).toBe("unanimous");
    expect(result.confidenceScore).toBe(100);
  });

  it("detects difference in price as not matching", () => {
    const pass1 = [makeProduct({ name: "Arroz 5kg", price: 24.9, unit: "un" })];
    const pass2 = [makeProduct({ name: "Arroz 5kg", price: 25.9, unit: "un" })];
    const pass3 = [makeProduct({ name: "Arroz 5kg", price: 26.9, unit: "un" })];

    const result = computeConsensus([
      makePass(0, pass1),
      makePass(1, pass2),
      makePass(2, pass3),
    ]);

    expect(result.type).toBe("none");
    expect(result.confidenceScore).toBe(0);
  });

  it("handles single pass as unanimous", () => {
    const products = [makeProduct()];

    const result = computeConsensus([makePass(0, products)]);

    expect(result.type).toBe("unanimous");
    expect(result.confidenceScore).toBe(100);
  });
});
