import { describe, it, expect } from "vitest";
import {
  computeConsensus,
  PassResult,
  normalizeForComparison,
  tokenSimilarity,
  productsMatch,
  computeOverlap,
} from "../import-consensus";
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
// normalizeForComparison
// ---------------------------------------------------------------------------

describe("normalizeForComparison", () => {
  it("strips accents", () => {
    expect(normalizeForComparison("Linguiça de Pernil")).toBe("linguica pernil");
  });

  it("removes Portuguese articles and prepositions", () => {
    expect(normalizeForComparison("Oleo de Soja")).toBe("oleo soja");
    expect(normalizeForComparison("Leite com Chocolate")).toBe("leite chocolate");
  });

  it("lowercases and collapses whitespace", () => {
    expect(normalizeForComparison("  ARROZ   TIO   JOAO  ")).toBe("arroz tio joao");
  });
});

// ---------------------------------------------------------------------------
// tokenSimilarity
// ---------------------------------------------------------------------------

describe("tokenSimilarity", () => {
  it("returns 1 for identical strings", () => {
    expect(tokenSimilarity("arroz tio joao", "arroz tio joao")).toBe(1);
  });

  it("returns 0 for completely different strings", () => {
    expect(tokenSimilarity("arroz tio joao", "coca cola 2l")).toBe(0);
  });

  it("returns partial similarity for overlapping tokens", () => {
    // "linguica pernil seara" vs "linguica pernil" → 3/3 vs 2/3 → intersection=2, union=3 → 0.667
    const sim = tokenSimilarity("linguica pernil seara", "linguica pernil");
    expect(sim).toBeCloseTo(0.667, 2);
  });
});

// ---------------------------------------------------------------------------
// productsMatch
// ---------------------------------------------------------------------------

describe("productsMatch", () => {
  it("matches identical products", () => {
    const a = makeProduct({ name: "Arroz Tio Joao 5kg", price: 24.9, unit: "un" });
    const b = makeProduct({ name: "Arroz Tio Joao 5kg", price: 24.9, unit: "un" });
    expect(productsMatch(a, b)).toBe(true);
  });

  it("matches with accent differences", () => {
    const a = makeProduct({ name: "Linguiça de Pernil Seara", price: 12.99, unit: "un" });
    const b = makeProduct({ name: "Linguica Pernil Seara", price: 12.99, unit: "un" });
    expect(productsMatch(a, b)).toBe(true);
  });

  it("blocks match on price difference", () => {
    const a = makeProduct({ name: "Arroz Tio Joao 5kg", price: 24.9, unit: "un" });
    const b = makeProduct({ name: "Arroz Tio Joao 5kg", price: 25.9, unit: "un" });
    expect(productsMatch(a, b)).toBe(false);
  });

  it("blocks match on unit difference", () => {
    const a = makeProduct({ name: "Arroz", price: 24.9, unit: "un" });
    const b = makeProduct({ name: "Arroz", price: 24.9, unit: "kg" });
    expect(productsMatch(a, b)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// computeOverlap
// ---------------------------------------------------------------------------

describe("computeOverlap", () => {
  it("returns full overlap for identical lists", () => {
    const products = [makeProduct(), makeProduct({ name: "Feijao", price: 8, unit: "kg" })];
    const { matchedCount, overlapRatio } = computeOverlap(products, products);
    expect(matchedCount).toBe(2);
    expect(overlapRatio).toBe(1);
  });

  it("returns partial overlap for partially matching lists", () => {
    const a = [
      makeProduct({ name: "Arroz", price: 10, unit: "un" }),
      makeProduct({ name: "Feijao", price: 8, unit: "kg" }),
    ];
    const b = [
      makeProduct({ name: "Arroz", price: 10, unit: "un" }),
      makeProduct({ name: "Coca Cola", price: 9, unit: "un" }),
    ];
    const { matchedCount, overlapRatio } = computeOverlap(a, b);
    expect(matchedCount).toBe(1);
    expect(overlapRatio).toBe(0.5);
  });
});

// ---------------------------------------------------------------------------
// computeConsensus
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
    expect(result.confidenceScore).toBe(100);
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
    expect(result.confidenceScore).toBe(100);
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

  // -----------------------------------------------------------------------
  // New fuzzy matching tests
  // -----------------------------------------------------------------------

  it("reaches consensus with fuzzy name matching (accent + preposition differences)", () => {
    const pass1 = [
      makeProduct({ name: "Linguiça de Pernil Seara", price: 12.99, unit: "un" }),
      makeProduct({ name: "Óleo de Soja Liza 900ml", price: 7.49, unit: "un" }),
    ];
    const pass2 = [
      makeProduct({ name: "Linguica Pernil Seara", price: 12.99, unit: "un" }),
      makeProduct({ name: "Oleo Soja Liza 900ml", price: 7.49, unit: "un" }),
    ];
    const pass3 = [
      makeProduct({ name: "Linguiça Pernil Seara", price: 12.99, unit: "un" }),
      makeProduct({ name: "Oleo de Soja Liza 900ml", price: 7.49, unit: "un" }),
    ];

    const result = computeConsensus([
      makePass(0, pass1),
      makePass(1, pass2),
      makePass(2, pass3),
    ]);

    expect(result.type).toBe("unanimous");
    expect(result.confidenceScore).toBe(100);
    expect(result.consensusProducts).toHaveLength(2);
  });

  it("reaches majority with partial product overlap (>= 0.6)", () => {
    // 5 products: 4 match between pass 0 and 1, 1 differs → 4/5 = 0.8
    const shared = [
      makeProduct({ name: "Arroz 5kg", price: 24.9, unit: "un" }),
      makeProduct({ name: "Feijao 1kg", price: 8.49, unit: "kg" }),
      makeProduct({ name: "Leite 1L", price: 5.99, unit: "l" }),
      makeProduct({ name: "Acucar 1kg", price: 4.99, unit: "kg" }),
    ];

    const pass1 = [...shared, makeProduct({ name: "Cafe 500g", price: 15.99, unit: "un" })];
    const pass2 = [...shared, makeProduct({ name: "Macarrao 500g", price: 3.49, unit: "un" })];
    const pass3 = [makeProduct({ name: "Produto X", price: 99, unit: "un" })];

    const result = computeConsensus([
      makePass(0, pass1),
      makePass(1, pass2),
      makePass(2, pass3),
    ]);

    expect(result.type).toBe("majority");
    expect(result.confidenceScore).toBe(80);
    expect(result.consensusProducts).toHaveLength(5);
  });

  it("returns none when overlap is below 0.6", () => {
    // 5 products but only 2 match → 2/5 = 0.4
    const pass1 = [
      makeProduct({ name: "Arroz", price: 10, unit: "un" }),
      makeProduct({ name: "Feijao", price: 8, unit: "kg" }),
      makeProduct({ name: "Leite", price: 5, unit: "l" }),
      makeProduct({ name: "Acucar", price: 4, unit: "kg" }),
      makeProduct({ name: "Cafe", price: 15, unit: "un" }),
    ];
    const pass2 = [
      makeProduct({ name: "Arroz", price: 10, unit: "un" }),
      makeProduct({ name: "Feijao", price: 8, unit: "kg" }),
      makeProduct({ name: "Suco", price: 6, unit: "l" }),
      makeProduct({ name: "Manteiga", price: 12, unit: "un" }),
      makeProduct({ name: "Queijo", price: 20, unit: "kg" }),
    ];

    const result = computeConsensus([
      makePass(0, pass1),
      makePass(1, pass2),
      makePass(2, [makeProduct({ name: "Nada", price: 1, unit: "un" })]),
    ]);

    expect(result.type).toBe("none");
    expect(result.confidenceScore).toBe(0);
  });

  it("selects the pass with more products from the best pair", () => {
    // pass0 has 3 products, pass1 has 2 products (subset). Best overlap picks pass0.
    const pass0 = [
      makeProduct({ name: "Arroz", price: 10, unit: "un" }),
      makeProduct({ name: "Feijao", price: 8, unit: "kg" }),
      makeProduct({ name: "Leite", price: 5, unit: "l" }),
    ];
    const pass1 = [
      makeProduct({ name: "Arroz", price: 10, unit: "un" }),
      makeProduct({ name: "Feijao", price: 8, unit: "kg" }),
    ];

    const result = computeConsensus([
      makePass(0, pass0),
      makePass(1, pass1),
      makePass(2, [makeProduct({ name: "X", price: 99, unit: "un" })]),
    ]);

    expect(result.type).toBe("majority");
    expect(result.selectedPassIndex).toBe(0);
    expect(result.consensusProducts).toHaveLength(3);
  });
});
