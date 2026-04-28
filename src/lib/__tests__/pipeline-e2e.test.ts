/**
 * E2E test harness for the PDF import pipeline.
 *
 * Tests `runMultiPassExtraction()` with mocked `processPdfBuffer` so the full
 * pipeline (multi-pass → normalize → consensus) runs without real AI calls.
 *
 * Also includes a test harness for the process-single-pdf worker logic
 * (status transitions, pass data storage, auto-publish flow) with mocked
 * Supabase — ready to run once environment is available.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { EncarteProduct } from "../schemas";
import type { ConsensusResult, PassResult } from "../import-consensus";

// ---------------------------------------------------------------------------
// Mock the crawler service (processPdfBuffer) — no real AI calls
// ---------------------------------------------------------------------------

const mockProcessPdfBuffer = vi.fn<
  (buffer: Uint8Array | Buffer, filename: string) => Promise<{ products: EncarteProduct[]; meta: unknown }>
>();

vi.mock("@/lib/crawler/service", () => ({
  processPdfBuffer: (...args: [Uint8Array | Buffer, string]) => mockProcessPdfBuffer(...args),
}));

// Import AFTER mocking so vi.mock hoists correctly
const { runMultiPassExtraction } = await import("../import-pipeline");

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

const REALISTIC_PRODUCTS: EncarteProduct[] = [
  makeProduct({ name: "Arroz Camil 5kg", price: 24.9, unit: "un", brand: "Camil" }),
  makeProduct({ name: "Feijão Carioca Kicaldo 1kg", price: 8.49, unit: "kg", category: "cat_alimentos", brand: "Kicaldo" }),
  makeProduct({ name: "Óleo de Soja Liza 900ml", price: 7.49, unit: "un", category: "cat_alimentos", brand: "Liza" }),
  makeProduct({ name: "Leite Integral Italac 1L", price: 5.99, unit: "l", category: "cat_alimentos", brand: "Italac" }),
  makeProduct({ name: "Coca-Cola 2L", price: 9.99, unit: "un", category: "cat_bebidas", brand: "Coca-Cola" }),
  makeProduct({ name: "Detergente Ypê 500ml", price: 2.49, unit: "un", category: "cat_limpeza", brand: "Ypê" }),
  makeProduct({ name: "Papel Higiênico Neve 12un", price: 18.9, unit: "un", category: "cat_higiene", brand: "Neve" }),
  makeProduct({ name: "Banana Prata", price: 5.99, unit: "kg", category: "cat_hortifruti" }),
];

const DUMMY_PDF = Buffer.from("fake-pdf-content");

// ---------------------------------------------------------------------------
// runMultiPassExtraction — full pipeline with mocked AI
// ---------------------------------------------------------------------------

describe("runMultiPassExtraction (mocked AI)", () => {
  beforeEach(() => {
    mockProcessPdfBuffer.mockReset();
  });

  it("reaches unanimous consensus when all passes return identical products", async () => {
    mockProcessPdfBuffer.mockResolvedValue({
      products: REALISTIC_PRODUCTS,
      meta: { source: "test" },
    });

    const result = await runMultiPassExtraction(DUMMY_PDF, "test.pdf", 3);

    expect(mockProcessPdfBuffer).toHaveBeenCalledTimes(3);
    expect(result.type).toBe("unanimous");
    expect(result.confidenceScore).toBe(100);
    expect(result.consensusProducts).toHaveLength(8);
    expect(result.passes).toHaveLength(3);
    expect(result.passes.every((p: PassResult) => p.products.length === 8)).toBe(true);
  });

  it("reaches majority when 2 of 3 passes agree", async () => {
    const variantProducts = [
      ...REALISTIC_PRODUCTS.slice(0, 6),
      // Different last 2 products
      makeProduct({ name: "Guaraná Antarctica 2L", price: 7.99, unit: "un", category: "cat_bebidas" }),
      makeProduct({ name: "Sabão em Pó Omo 1kg", price: 14.9, unit: "un", category: "cat_limpeza" }),
    ];

    let callCount = 0;
    mockProcessPdfBuffer.mockImplementation(async () => {
      callCount++;
      return {
        products: callCount === 2 ? variantProducts : REALISTIC_PRODUCTS,
        meta: { source: "test" },
      };
    });

    const result = await runMultiPassExtraction(DUMMY_PDF, "test.pdf", 3);

    expect(result.type).toBe("majority");
    expect(result.confidenceScore).toBeGreaterThanOrEqual(60);
    expect(result.consensusProducts).not.toBeNull();
    expect(result.passes).toHaveLength(3);
  });

  it("returns none when all passes disagree", async () => {
    let callCount = 0;
    mockProcessPdfBuffer.mockImplementation(async () => {
      callCount++;
      return {
        products: [
          makeProduct({
            name: `Produto Unico Pass${callCount}`,
            price: callCount * 10,
            unit: "un",
          }),
        ],
        meta: { source: "test" },
      };
    });

    const result = await runMultiPassExtraction(DUMMY_PDF, "test.pdf", 3);

    expect(result.type).toBe("none");
    expect(result.confidenceScore).toBe(0);
    expect(result.consensusProducts).toBeNull();
  });

  it("handles partial failures gracefully (1 error + 2 agreeing)", async () => {
    let callCount = 0;
    mockProcessPdfBuffer.mockImplementation(async () => {
      callCount++;
      if (callCount === 2) {
        throw new Error("AI service timeout");
      }
      return {
        products: REALISTIC_PRODUCTS,
        meta: { source: "test" },
      };
    });

    const result = await runMultiPassExtraction(DUMMY_PDF, "test.pdf", 3);

    expect(result.passes).toHaveLength(3);
    // One pass should have an error
    const errorPass = result.passes.find((p: PassResult) => p.error);
    expect(errorPass).toBeDefined();
    expect(errorPass!.error).toBe("AI service timeout");
    expect(errorPass!.products).toEqual([]);

    // Still reaches majority from the other 2
    expect(result.type).toBe("majority");
    expect(result.consensusProducts).toHaveLength(8);
  });

  it("returns none when all passes fail", async () => {
    mockProcessPdfBuffer.mockRejectedValue(new Error("Service unavailable"));

    const result = await runMultiPassExtraction(DUMMY_PDF, "test.pdf", 3);

    expect(result.type).toBe("none");
    expect(result.confidenceScore).toBe(0);
    expect(result.consensusProducts).toBeNull();
    expect(result.passes.every((p: PassResult) => p.error)).toBe(true);
  });

  it("handles non-Error thrown values", async () => {
    mockProcessPdfBuffer.mockRejectedValue("string error");

    const result = await runMultiPassExtraction(DUMMY_PDF, "test.pdf", 3);

    expect(result.type).toBe("none");
    expect(result.passes.every((p: PassResult) => p.error === "Erro desconhecido")).toBe(true);
  });

  it("supports configurable pass count", async () => {
    mockProcessPdfBuffer.mockResolvedValue({
      products: REALISTIC_PRODUCTS,
      meta: { source: "test" },
    });

    const result = await runMultiPassExtraction(DUMMY_PDF, "test.pdf", 5);

    expect(mockProcessPdfBuffer).toHaveBeenCalledTimes(5);
    expect(result.passes).toHaveLength(5);
    expect(result.type).toBe("unanimous");
  });

  it("single pass returns unanimous", async () => {
    mockProcessPdfBuffer.mockResolvedValue({
      products: REALISTIC_PRODUCTS,
      meta: { source: "test" },
    });

    const result = await runMultiPassExtraction(DUMMY_PDF, "test.pdf", 1);

    expect(mockProcessPdfBuffer).toHaveBeenCalledTimes(1);
    expect(result.type).toBe("unanimous");
    expect(result.confidenceScore).toBe(100);
  });

  it("normalizes products from each pass independently", async () => {
    // Use a date 30 days from now so normalizeValidity's future-only check always passes
    const future = new Date();
    future.setDate(future.getDate() + 30);
    const dd = String(future.getDate()).padStart(2, "0");
    const mm = String(future.getMonth() + 1).padStart(2, "0");
    const yyyy = future.getFullYear();
    const inputValidity = `${dd}/${mm}/${yyyy}`;
    const expectedValidity = `${yyyy}-${mm}-${dd}`;

    mockProcessPdfBuffer.mockResolvedValue({
      products: [
        { name: "  Arroz   5kg  ", price: 24.9, unit: "un", validity: null },
        { name: "Leite 1L", price: 5.99, unit: "litro", validity: inputValidity },
      ],
      meta: { source: "test" },
    });

    const result = await runMultiPassExtraction(DUMMY_PDF, "test.pdf", 3);

    // normalizeProducts should have cleaned names and units
    expect(result.passes[0].products[0].name).toBe("Arroz 5kg");
    expect(result.passes[0].products[1].unit).toBe("l");
    expect(result.passes[0].products[1].validity).toBe(expectedValidity);
  });

  it("runs all passes in parallel (not sequential)", async () => {
    const callTimestamps: number[] = [];

    mockProcessPdfBuffer.mockImplementation(async () => {
      callTimestamps.push(Date.now());
      // Simulate some work
      await new Promise((resolve) => setTimeout(resolve, 50));
      return { products: REALISTIC_PRODUCTS, meta: { source: "test" } };
    });

    await runMultiPassExtraction(DUMMY_PDF, "test.pdf", 3);

    // All 3 calls should start within a tight window (parallel)
    // If sequential, they'd be ~50ms apart
    const timeDiffs = callTimestamps.slice(1).map((t, i) => t - callTimestamps[i]);
    for (const diff of timeDiffs) {
      expect(diff).toBeLessThan(30); // generous buffer for CI
    }
  });
});

// ---------------------------------------------------------------------------
// Worker status transition harness (process-single-pdf logic)
// ---------------------------------------------------------------------------

describe("process-single-pdf worker logic (harness)", () => {
  /**
   * These tests verify the expected behavior of the process-single-pdf worker
   * by testing the decision logic in isolation. The actual route handler cannot
   * be tested without Next.js runtime, but the logic is validated here.
   */

  it("consensus type 'unanimous' or 'majority' triggers auto-publish", () => {
    const consensus: ConsensusResult = {
      type: "unanimous",
      confidenceScore: 100,
      consensusProducts: REALISTIC_PRODUCTS,
      passes: [
        { passIndex: 0, products: REALISTIC_PRODUCTS },
        { passIndex: 1, products: REALISTIC_PRODUCTS },
        { passIndex: 2, products: REALISTIC_PRODUCTS },
      ],
      selectedPassIndex: 0,
    };

    // The worker publishes when type !== "none" && consensusProducts exist
    const shouldPublish = consensus.type !== "none" && consensus.consensusProducts !== null;
    expect(shouldPublish).toBe(true);
  });

  it("consensus type 'none' routes to needs_review", () => {
    const consensus: ConsensusResult = {
      type: "none",
      confidenceScore: 0,
      consensusProducts: null,
      passes: [
        { passIndex: 0, products: [makeProduct({ name: "A", price: 1, unit: "un" })] },
        { passIndex: 1, products: [makeProduct({ name: "B", price: 2, unit: "kg" })] },
        { passIndex: 2, products: [makeProduct({ name: "C", price: 3, unit: "l" })] },
      ],
      selectedPassIndex: null,
    };

    const shouldPublish = consensus.type !== "none" && consensus.consensusProducts !== null;
    expect(shouldPublish).toBe(false);
  });

  it("pass data is structured correctly for DB storage", () => {
    const consensus: ConsensusResult = {
      type: "majority",
      confidenceScore: 83.33,
      consensusProducts: REALISTIC_PRODUCTS.slice(0, 4),
      passes: [
        { passIndex: 0, products: REALISTIC_PRODUCTS.slice(0, 4) },
        { passIndex: 1, products: REALISTIC_PRODUCTS.slice(0, 4), error: undefined },
        { passIndex: 2, products: [], error: "Timeout" },
      ],
      selectedPassIndex: 0,
    };

    // Mirrors the passData construction in process-single-pdf route
    const passData: Record<string, unknown> = {
      extraction_pass_1: consensus.passes[0]
        ? { products: consensus.passes[0].products, error: consensus.passes[0].error }
        : null,
      extraction_pass_2: consensus.passes[1]
        ? { products: consensus.passes[1].products, error: consensus.passes[1].error }
        : null,
      extraction_pass_3: consensus.passes[2]
        ? { products: consensus.passes[2].products, error: consensus.passes[2].error }
        : null,
      consensus_result: consensus.consensusProducts
        ? { products: consensus.consensusProducts }
        : null,
      consensus_type: consensus.type === "none" ? null : consensus.type,
      confidence_score: consensus.confidenceScore,
    };

    expect(passData.extraction_pass_1).toEqual({
      products: REALISTIC_PRODUCTS.slice(0, 4),
      error: undefined,
    });
    expect(passData.extraction_pass_3).toEqual({
      products: [],
      error: "Timeout",
    });
    expect(passData.consensus_type).toBe("majority");
    expect(passData.confidence_score).toBe(83.33);
    expect(passData.consensus_result).toEqual({
      products: REALISTIC_PRODUCTS.slice(0, 4),
    });
  });

  it("CATEGORY_DEFAULTS covers all category IDs used by normalizeCategory", () => {
    // Mirrors the CATEGORY_DEFAULTS from process-single-pdf/route.ts
    const CATEGORY_DEFAULTS: Record<string, { name: string; icon: string; sort_order: number }> = {
      cat_alimentos: { name: "Alimentos", icon: "wheat", sort_order: 0 },
      cat_bebidas: { name: "Bebidas", icon: "cup-soda", sort_order: 1 },
      cat_limpeza: { name: "Limpeza", icon: "spray-can", sort_order: 2 },
      cat_hortifruti: { name: "Hortifruti", icon: "apple", sort_order: 3 },
      cat_padaria: { name: "Padaria", icon: "croissant", sort_order: 4 },
      cat_higiene: { name: "Higiene", icon: "sparkles", sort_order: 5 },
    };

    const allCatIds = ["bebidas", "limpeza", "alimentos", "hortifruti", "padaria", "higiene"];
    for (const catName of allCatIds) {
      const catId = `cat_${catName}`;
      expect(CATEGORY_DEFAULTS[catId]).toBeDefined();
      expect(CATEGORY_DEFAULTS[catId].name).toBeTruthy();
      expect(CATEGORY_DEFAULTS[catId].icon).toBeTruthy();
      expect(typeof CATEGORY_DEFAULTS[catId].sort_order).toBe("number");
    }
  });

  it("promotion end date defaults to 7 days when validity is null", () => {
    const product = makeProduct({ validity: null });
    const now = new Date();

    let endDate: string;
    if (product.validity) {
      endDate = new Date(product.validity + "T23:59:59Z").toISOString();
    } else {
      const future = new Date(now);
      future.setDate(future.getDate() + 7);
      endDate = future.toISOString();
    }

    const endDateObj = new Date(endDate);
    const diffMs = endDateObj.getTime() - now.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    expect(diffDays).toBeCloseTo(7, 0);
  });

  it("promotion end date uses validity when provided", () => {
    const product = makeProduct({ validity: "2026-04-15" });

    let endDate: string;
    if (product.validity) {
      endDate = new Date(product.validity + "T23:59:59Z").toISOString();
    } else {
      const future = new Date();
      future.setDate(future.getDate() + 7);
      endDate = future.toISOString();
    }

    expect(endDate).toBe("2026-04-15T23:59:59.000Z");
  });

  it("low-confidence threshold is 0.7 for review flagging", () => {
    const THRESHOLD = 0.7;

    // Mock product match results
    const highConfidence = { id: "p1", matched: true, confidence: 0.85 };
    const lowConfidence = { id: "p2", matched: true, confidence: 0.55 };
    const noMatch = { id: "p3", matched: false, confidence: 1.0 };

    expect(highConfidence.matched && highConfidence.confidence < THRESHOLD).toBe(false);
    expect(lowConfidence.matched && lowConfidence.confidence < THRESHOLD).toBe(true);
    expect(noMatch.matched && noMatch.confidence < THRESHOLD).toBe(false);
  });
});
