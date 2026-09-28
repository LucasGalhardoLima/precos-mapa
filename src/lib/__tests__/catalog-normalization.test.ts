import { describe, it, expect } from "vitest";
import {
  batchCostUsd, buildUserMessage, responseSchema, seededShuffle, validateBatchResponse,
  type Candidate, type Category,
} from "../catalog-normalization";

const slugs = new Set(["arroz", "leite"]);
const cand = (over: Partial<Candidate> = {}): Candidate => ({
  id: "p", name: "ARROZ TIO JOAO", ean: null, sizeValue: null, sizeUnit: null, markets: ["Tenda"], ...over,
});
const item = (over: Record<string, unknown> = {}) => ({
  i: 0, category_l2: "arroz", brand_norm: "Tio João", base_name: "arroz branco", size_value: 5000, size_unit: "g", confidence: 0.9, ...over,
});
const respond = (...items: unknown[]) => JSON.stringify({ results: items });

describe("validateBatchResponse", () => {
  it("uses a clean answer as given", () => {
    expect(validateBatchResponse(respond(item()), [cand()], slugs)).toEqual([
      { category_l2: "arroz", brand_norm: "Tio João", base_name: "arroz branco", size_value: 5000, size_unit: "g", confidence: 0.9, invalid_reason: null },
    ]);
  });

  it("nulls a category outside the closed list and says so", () => {
    const [p] = validateBatchResponse(respond(item({ category_l2: "racao" })), [cand()], slugs);
    expect(p.category_l2).toBeNull();
    expect(p.invalid_reason).toBe("category_not_in_list");
    expect(p.brand_norm).toBe("Tio João"); // the other fields are not thrown away
  });

  it("never overrides a size the regex parser already found", () => {
    const [p] = validateBatchResponse(respond(item()), [cand({ sizeValue: 1000, sizeUnit: "g" })], slugs);
    expect(p.size_value).toBeNull();
    expect(p.size_unit).toBeNull();
    expect(p.invalid_reason).toBeNull();
  });

  it("rejects an insane or half-given size", () => {
    expect(validateBatchResponse(respond(item({ size_value: 9_000_000 })), [cand()], slugs)[0].size_value).toBeNull();
    const [half] = validateBatchResponse(respond(item({ size_unit: null })), [cand()], slugs);
    expect(half.size_value).toBeNull();
    expect(half.invalid_reason).toBe("size_invalid");
  });

  it("accepts null size fields without complaint", () => {
    const [p] = validateBatchResponse(respond(item({ size_value: null, size_unit: null })), [cand()], slugs);
    expect(p.invalid_reason).toBeNull();
  });

  it("marks products the model skipped, and ignores out-of-range or duplicate indexes", () => {
    const out = validateBatchResponse(respond(item({ i: 1 }), item({ i: 1, category_l2: "leite" }), item({ i: 7 })), [cand(), cand()], slugs);
    expect(out[0].invalid_reason).toBe("missing_from_response");
    expect(out[1].category_l2).toBe("arroz"); // first answer for an index wins
  });

  it("returns all-null for text that is not the expected JSON", () => {
    for (const bad of ["oops", "{}", '{"results": "x"}']) {
      const out = validateBatchResponse(bad, [cand(), cand()], slugs);
      expect(out.every((p) => p.category_l2 === null && p.invalid_reason === "unparseable_response")).toBe(true);
    }
  });

  it("drops out-of-range confidence and over-long text instead of storing it", () => {
    const [p] = validateBatchResponse(respond(item({ confidence: 7, base_name: "x".repeat(200) })), [cand()], slugs);
    expect(p.confidence).toBeNull();
    expect(p.base_name).toBeNull();
  });
});

describe("prompt inputs", () => {
  it("numbers products from 0 and passes the parsed size through", () => {
    const lines = buildUserMessage([cand(), cand({ name: "LEITE", sizeValue: 1000, sizeUnit: "ml", ean: "789" })]).split("\n");
    expect(JSON.parse(lines[0])).toMatchObject({ i: 0, parsed_size: null });
    expect(JSON.parse(lines[1])).toMatchObject({ i: 1, parsed_size: "1000 ml", ean: "789" });
  });

  it("closes the category enum to the given list", () => {
    const cats: Category[] = [{ id: "arroz", name: "Arroz", department: "Mercearia" }];
    const schema = responseSchema(cats);
    expect(schema.properties.results.items.properties.category_l2.anyOf[0]).toEqual({ type: "string", enum: ["arroz"] });
  });
});

describe("batchCostUsd / seededShuffle", () => {
  it("prices tokens at the Haiku 4.5 Batch rates", () => {
    expect(batchCostUsd({ input_tokens: 1_000_000, output_tokens: 1_000_000 })).toBeCloseTo(3.0);
  });

  it("is reproducible for a seed and does not lose items", () => {
    const xs = Array.from({ length: 20 }, (_, i) => i);
    expect(seededShuffle(xs, 42)).toEqual(seededShuffle(xs, 42));
    expect([...seededShuffle(xs, 42)].sort((a, b) => a - b)).toEqual(xs);
    expect(seededShuffle(xs, 42)).not.toEqual(seededShuffle(xs, 43));
  });
});
