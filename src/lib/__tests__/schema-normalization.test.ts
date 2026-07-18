import { describe, it, expect } from "vitest";
import {
  normalizeProducts,
  normalizeEncartePayload,
  normalizeCategory,
} from "../schemas";

// normalizeValidity() rejects dates outside "today .. today+90 days" (see
// schemas.ts) — tests need a date that stays inside that window regardless
// of when the suite runs. A hardcoded literal here previously rotted into a
// past date as real time passed it by, silently flipping these tests to
// failing months after they were written.
function daysFromNow(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

function toIso(date: Date): string {
  return date.toISOString().split("T")[0];
}

function toSlash(date: Date): string {
  const [y, m, d] = toIso(date).split("-");
  return `${d}/${m}/${y}`;
}

function toDash(date: Date): string {
  const [y, m, d] = toIso(date).split("-");
  return `${d}-${m}-${y}`;
}

// Derives day/month/year from the same UTC-based reference as toIso(), rather
// than Date's local-time getters (getDate()/getMonth()) — mixing the two let
// this drift by a day near a UTC boundary in UTC-negative timezones (e.g.
// Brazil), since toISOString() and getDate() can disagree on "today".
function isoParts(date: Date): { day: number; month: number; year: number } {
  const [year, month, day] = toIso(date).split("-").map(Number);
  return { day, month, year };
}

// Finds the soonest upcoming date (within the 90-day validity window) whose
// day-of-month is single-digit (1-9), so the padStart(2, "0") logic actually
// gets exercised — every month has 9 such days, so this always resolves
// within at most one month, regardless of what "today" is when the suite runs.
function nextSingleDigitDay(): Date {
  for (let offset = 1; offset <= 35; offset++) {
    const candidate = daysFromNow(offset);
    if (isoParts(candidate).day <= 9) return candidate;
  }
  throw new Error("no single-digit day found within 35 days — should be unreachable");
}

// ---------------------------------------------------------------------------
// normalizeProducts — price normalization
// ---------------------------------------------------------------------------

describe("normalizeProducts price handling", () => {
  it("accepts numeric prices", () => {
    const result = normalizeProducts([
      { name: "Arroz 5kg", price: 24.9, unit: "un", validity: null },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].price).toBe(24.9);
  });

  it("parses Brazilian-format string prices (comma decimal)", () => {
    const result = normalizeProducts([
      { name: "Feijão 1kg", price: "8,49", unit: "kg", validity: null },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].price).toBe(8.49);
  });

  it("parses prices with R$ prefix", () => {
    const result = normalizeProducts([
      { name: "Leite 1L", price: "R$ 5,99", unit: "l", validity: null },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].price).toBe(5.99);
  });

  it("parses prices with thousand separators (dot + comma)", () => {
    const result = normalizeProducts([
      { name: "TV 55pol", price: "2.499,90", unit: "un", validity: null },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].price).toBe(2499.9);
  });

  it("rejects zero and negative prices", () => {
    const result = normalizeProducts([
      { name: "Free Item", price: 0, unit: "un", validity: null },
      { name: "Negative", price: -5, unit: "un", validity: null },
    ]);
    expect(result).toHaveLength(0);
  });

  it("rejects absurdly high prices (>= 10000)", () => {
    const result = normalizeProducts([
      { name: "Expensive", price: 10000, unit: "un", validity: null },
    ]);
    expect(result).toHaveLength(0);
  });

  it("rounds prices to 2 decimal places", () => {
    const result = normalizeProducts([
      { name: "Produto", price: 3.999, unit: "un", validity: null },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].price).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// normalizeProducts — unit normalization
// ---------------------------------------------------------------------------

describe("normalizeProducts unit handling", () => {
  it("normalizes standard unit codes", () => {
    const units = ["kg", "un", "l", "g", "ml", "pack"];
    for (const unit of units) {
      const result = normalizeProducts([
        { name: `Produto ${unit}`, price: 10, unit, validity: null },
      ]);
      expect(result).toHaveLength(1);
      expect(result[0].unit).toBe(unit);
    }
  });

  it("normalizes verbose unit names", () => {
    const cases: [string, string][] = [
      ["quilo", "kg"],
      ["unidade", "un"],
      ["und", "un"],
      ["litro", "l"],
      ["grama", "g"],
      ["pacote", "pack"],
      ["pct", "pack"],
    ];
    for (const [input, expected] of cases) {
      const result = normalizeProducts([
        { name: `Produto ${input}`, price: 10, unit: input, validity: null },
      ]);
      expect(result).toHaveLength(1);
      expect(result[0].unit).toBe(expected);
    }
  });

  it("normalizes dz/cx/bd unit types", () => {
    const cases: [string, string][] = [
      ["dz", "dz"],
      ["duzia", "dz"],
      ["dúzia", "dz"],
      ["cx", "pack"],
      ["caixa", "pack"],
      ["bd", "un"],
      ["bandeja", "un"],
    ];
    for (const [input, expected] of cases) {
      const result = normalizeProducts([
        { name: `Produto ${input}`, price: 10, unit: input, validity: null },
      ]);
      expect(result).toHaveLength(1);
      expect(result[0].unit).toBe(expected);
    }
  });

  it("rejects products with invalid units", () => {
    const result = normalizeProducts([
      { name: "Produto", price: 10, unit: "xyz", validity: null },
    ]);
    expect(result).toHaveLength(0);
  });

  it("rejects products with missing units", () => {
    const result = normalizeProducts([
      { name: "Produto", price: 10, unit: "", validity: null },
    ]);
    expect(result).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// normalizeProducts — validity normalization
// ---------------------------------------------------------------------------

describe("normalizeProducts validity handling", () => {
  it("passes through ISO format dates", () => {
    const target = daysFromNow(30);
    const result = normalizeProducts([
      { name: "Produto", price: 10, unit: "un", validity: toIso(target) },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].validity).toBe(toIso(target));
  });

  it("converts slash format (dd/mm/yyyy) to ISO", () => {
    const target = daysFromNow(30);
    const result = normalizeProducts([
      { name: "Produto", price: 10, unit: "un", validity: toSlash(target) },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].validity).toBe(toIso(target));
  });

  it("converts dash format (dd-mm-yyyy) to ISO", () => {
    const target = daysFromNow(30);
    const result = normalizeProducts([
      { name: "Produto", price: 10, unit: "un", validity: toDash(target) },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].validity).toBe(toIso(target));
  });

  it("pads single-digit day and month", () => {
    const target = nextSingleDigitDay();
    const { day, month, year } = isoParts(target);
    // dd/mm/yyyy, day first — matches normalizeValidity's slash[1]=day, slash[2]=month.
    const input = `${day}/${month}/${year}`;
    const result = normalizeProducts([
      { name: "Produto", price: 10, unit: "un", validity: input },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].validity).toBe(toIso(target));
  });

  it("handles null validity", () => {
    const result = normalizeProducts([
      { name: "Produto", price: 10, unit: "un", validity: null },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].validity).toBeNull();
  });

  it("returns null for invalid validity strings", () => {
    const result = normalizeProducts([
      { name: "Produto", price: 10, unit: "un", validity: "next week" },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].validity).toBeNull();
  });

  it("rejects dates in the past", () => {
    const result = normalizeProducts([
      { name: "Produto", price: 10, unit: "un", validity: "2025-01-01" },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].validity).toBeNull();
  });

  it("rejects dates more than 90 days in the future", () => {
    const result = normalizeProducts([
      { name: "Produto", price: 10, unit: "un", validity: "2027-01-01" },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].validity).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// normalizeProducts — name normalization
// ---------------------------------------------------------------------------

describe("normalizeProducts name handling", () => {
  it("trims and collapses whitespace in names", () => {
    const result = normalizeProducts([
      { name: "  Arroz   Tio   João  5kg  ", price: 24.9, unit: "un", validity: null },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Arroz Tio João 5kg");
  });

  it("rejects products with empty names", () => {
    const result = normalizeProducts([
      { name: "", price: 10, unit: "un", validity: null },
      { name: "   ", price: 10, unit: "un", validity: null },
    ]);
    expect(result).toHaveLength(0);
  });

  it("rejects products with non-string names", () => {
    const result = normalizeProducts([
      { name: 123, price: 10, unit: "un", validity: null },
      { name: null, price: 10, unit: "un", validity: null },
    ]);
    expect(result).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// normalizeProducts — deduplication
// ---------------------------------------------------------------------------

describe("normalizeProducts deduplication", () => {
  it("deduplicates by name|price|unit|validity key", () => {
    const validity = toIso(daysFromNow(30));
    const result = normalizeProducts([
      { name: "Arroz 5kg", price: 24.9, unit: "un", validity },
      { name: "Arroz 5kg", price: 24.9, unit: "un", validity },
      { name: "Arroz 5kg", price: 24.9, unit: "un", validity },
    ]);
    expect(result).toHaveLength(1);
  });

  it("keeps products with same name but different prices", () => {
    const result = normalizeProducts([
      { name: "Arroz 5kg", price: 24.9, unit: "un", validity: null },
      { name: "Arroz 5kg", price: 29.9, unit: "un", validity: null },
    ]);
    expect(result).toHaveLength(2);
  });

  it("keeps products with same name but different units", () => {
    const result = normalizeProducts([
      { name: "Arroz", price: 24.9, unit: "un", validity: null },
      { name: "Arroz", price: 24.9, unit: "kg", validity: null },
    ]);
    expect(result).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// normalizeProducts — original_price handling
// ---------------------------------------------------------------------------

describe("normalizeProducts original_price", () => {
  it("includes original_price when higher than price", () => {
    const result = normalizeProducts([
      { name: "Produto", price: 3.99, original_price: 5.99, unit: "un", validity: null },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].original_price).toBe(5.99);
  });

  it("excludes original_price when lower than or equal to price", () => {
    const result = normalizeProducts([
      { name: "Produto A", price: 5.99, original_price: 3.99, unit: "un", validity: null },
      { name: "Produto B", price: 5.99, original_price: 5.99, unit: "un", validity: null },
    ]);
    expect(result).toHaveLength(2);
    expect(result[0].original_price).toBeUndefined();
    expect(result[1].original_price).toBeUndefined();
  });

  it("handles null original_price", () => {
    const result = normalizeProducts([
      { name: "Produto", price: 10, original_price: null, unit: "un", validity: null },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].original_price).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// normalizeProducts — market_origin
// ---------------------------------------------------------------------------

describe("normalizeProducts market_origin", () => {
  it("includes market_origin when provided", () => {
    const result = normalizeProducts([
      { name: "Produto", price: 10, unit: "un", validity: null, market_origin: "Savegnago" },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].market_origin).toBe("Savegnago");
  });

  it("excludes market_origin when empty", () => {
    const result = normalizeProducts([
      { name: "Produto", price: 10, unit: "un", validity: null, market_origin: "" },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].market_origin).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// normalizeCategory
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// normalizeEncartePayload
// ---------------------------------------------------------------------------

describe("normalizeEncartePayload", () => {
  it("normalizes valid payload with products array", () => {
    const result = normalizeEncartePayload({
      products: [
        { name: "Arroz 5kg", price: 24.9, unit: "un", validity: null },
      ],
    });
    expect(result.products).toHaveLength(1);
    expect(result.products[0].name).toBe("Arroz 5kg");
  });

  it("returns empty products for payload without products key", () => {
    const result = normalizeEncartePayload({ items: [] });
    expect(result.products).toHaveLength(0);
  });

  it("returns empty products for non-object payload", () => {
    const result = normalizeEncartePayload("invalid");
    expect(result.products).toHaveLength(0);
  });

  it("returns empty products for null payload", () => {
    const result = normalizeEncartePayload(null);
    expect(result.products).toHaveLength(0);
  });

  it("filters invalid products from the array", () => {
    const result = normalizeEncartePayload({
      products: [
        { name: "Valid", price: 10, unit: "un", validity: null },
        { name: "", price: 10, unit: "un", validity: null },
        { name: "No Price", price: null, unit: "un", validity: null },
        { name: "Bad Unit", price: 10, unit: "xyz", validity: null },
      ],
    });
    expect(result.products).toHaveLength(1);
    expect(result.products[0].name).toBe("Valid");
  });
});

// ---------------------------------------------------------------------------
// normalizeProducts — edge cases / robustness
// ---------------------------------------------------------------------------

describe("normalizeProducts edge cases", () => {
  it("handles non-array input gracefully", () => {
    expect(normalizeProducts(null)).toEqual([]);
    expect(normalizeProducts(undefined)).toEqual([]);
    expect(normalizeProducts("string")).toEqual([]);
    expect(normalizeProducts(123)).toEqual([]);
    expect(normalizeProducts({})).toEqual([]);
  });

  it("handles empty array", () => {
    expect(normalizeProducts([])).toEqual([]);
  });

  it("handles array with completely invalid items", () => {
    const result = normalizeProducts([
      null,
      undefined,
      "not an object",
      42,
      { random: "fields" },
    ]);
    expect(result).toEqual([]);
  });

  it("processes large product lists correctly", () => {
    const products = Array.from({ length: 100 }, (_, i) => ({
      name: `Produto ${i + 1}`,
      price: (i + 1) * 1.5,
      unit: "un",
      validity: null,
    }));
    const result = normalizeProducts(products);
    expect(result).toHaveLength(100);
  });
});
