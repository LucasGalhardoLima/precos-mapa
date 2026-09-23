import { describe, it, expect } from "vitest";
import { normalizeCategory } from "../schemas";

// The rest of this file (normalizeProducts, normalizeEncartePayload —
// encarte-extraction payload validation) was removed 2026-09-23 along with
// the pipeline that was their only caller. normalizeCategory survives:
// still used by api/publish-import. Full removed content is in git history
// (this file, pre-removal) if the pipeline ever comes back.
describe("normalizeCategory", () => {
  it("maps known category names to IDs", () => {
    expect(normalizeCategory("bebidas")).toBe("cat_bebidas");
    expect(normalizeCategory("limpeza")).toBe("cat_limpeza");
    expect(normalizeCategory("alimentos")).toBe("cat_alimentos");
    expect(normalizeCategory("hortifruti")).toBe("cat_hortifruti");
    expect(normalizeCategory("padaria")).toBe("cat_padaria");
    expect(normalizeCategory("higiene")).toBe("cat_higiene");
  });

  it("is case-insensitive", () => {
    expect(normalizeCategory("BEBIDAS")).toBe("cat_bebidas");
    expect(normalizeCategory("Limpeza")).toBe("cat_limpeza");
  });

  it("defaults to cat_alimentos for unknown categories", () => {
    expect(normalizeCategory("unknown")).toBe("cat_alimentos");
    expect(normalizeCategory("")).toBe("cat_alimentos");
  });

  it("defaults to cat_alimentos for non-string input", () => {
    expect(normalizeCategory(null)).toBe("cat_alimentos");
    expect(normalizeCategory(undefined)).toBe("cat_alimentos");
    expect(normalizeCategory(123)).toBe("cat_alimentos");
  });
});
