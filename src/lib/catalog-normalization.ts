/**
 * Catalog normalization, phase C: prompt, response schema and validation for
 * the Haiku batch pass (scripts/normalize-catalog-llm.ts). Pure functions —
 * no I/O — so the "invalid answer = null, never a guess" rules are testable.
 */

import { z } from "zod";
import { isSaneSize, type SizeUnit } from "./parse-product-size";

export const NORMALIZATION_MODEL = "claude-haiku-4-5";
export const BATCH_SIZE = 50;
/** Batch API prices in US$ per million tokens (docs/poup-prd-normalizacao-catalogo.md, "Custos reais"). */
export const BATCH_PRICE_PER_MTOK = { input: 0.5, output: 2.5 };

const SIZE_UNITS: SizeUnit[] = ["g", "ml", "un", "m"];

export interface Candidate {
  id: string;
  name: string;
  ean: string | null;
  sizeValue: number | null;
  sizeUnit: SizeUnit | null;
  markets: string[];
}

export interface Category {
  id: string;
  name: string;
  department: string;
}

export interface Proposal {
  category_l2: string | null;
  brand_norm: string | null;
  base_name: string | null;
  size_value: number | null;
  size_unit: SizeUnit | null;
  confidence: number | null;
  /** Why a field (or the whole item) was nulled by validation; null when the answer was used as given. */
  invalid_reason: string | null;
}

const EMPTY: Proposal = {
  category_l2: null, brand_norm: null, base_name: null,
  size_value: null, size_unit: null, confidence: null, invalid_reason: null,
};

export function buildSystemPrompt(categories: Category[]): string {
  const list = categories.map((c) => `- ${c.id}: ${c.name} (${c.department})`).join("\n");
  return `You normalize product names from Brazilian supermarkets (Portuguese, retail abbreviations, inconsistent casing) into structured fields.

You receive one product per line as JSON: {"i": <index>, "name": ..., "markets": [...], "ean": ..., "parsed_size": "<value> <unit>" | null}. Return one result per input, using the same "i".

Fields:
- category_l2: the id of exactly one category from the CLOSED list below, or null when none clearly fits. Never invent an id, never pick one just to fill the field. Pick the category of what the product IS, not where a supermarket shelves it (e.g. condensed milk is "sobremesas-preparos", not "leite").
- brand_norm: the brand as printed on the package, in its usual capitalization ("Tio João", "Coca-Cola"). null if the name shows no brand and you are not sure. Do not guess a brand from the product type.
- base_name: the generic product name without brand, package size, pack count or promotional words, lowercase, in Portuguese, keeping the attributes that distinguish variants ("arroz branco tipo 1", "papel higiênico folha dupla", "refrigerante cola"). Expand retail abbreviations ("PAP HIG" -> "papel higiênico").
- size_value / size_unit: the package size ONLY if a number and unit are literally present in the name; never estimate a typical size. Units: "g", "ml", "un" (count), "m" (length). Convert kg->g (x1000), l/lt->ml (x1000), cl->ml (x10), cm->m (x0.01). For a multipack such as "6x350ml" use the total (2100 ml). A bare unit with no number ("Banana Kg") is a selling unit, not a size: null. If parsed_size is present, return null for both fields.
- confidence: your confidence from 0 to 1 that category_l2, brand_norm and base_name are all right.

When unsure about a field, return null for that field.

Categories:
${list}`;
}

export function buildUserMessage(batch: Candidate[]): string {
  return batch
    .map((c, i) =>
      JSON.stringify({
        i,
        name: c.name,
        markets: c.markets,
        ean: c.ean,
        parsed_size: c.sizeValue !== null && c.sizeUnit ? `${c.sizeValue} ${c.sizeUnit}` : null,
      }),
    )
    .join("\n");
}

/** JSON schema for output_config.format. The category enum is the closed list, so the API itself refuses ids outside it. */
export function responseSchema(categories: Category[]) {
  const nullableString = { anyOf: [{ type: "string" }, { type: "null" }] };
  return {
    type: "object",
    additionalProperties: false,
    required: ["results"],
    properties: {
      results: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["i", "category_l2", "brand_norm", "base_name", "size_value", "size_unit", "confidence"],
          properties: {
            i: { type: "integer" },
            category_l2: { anyOf: [{ type: "string", enum: categories.map((c) => c.id) }, { type: "null" }] },
            brand_norm: nullableString,
            base_name: nullableString,
            size_value: { anyOf: [{ type: "number" }, { type: "null" }] },
            size_unit: { anyOf: [{ type: "string", enum: SIZE_UNITS }, { type: "null" }] },
            confidence: { type: "number" },
          },
        },
      },
    },
  };
}

const ResponseItem = z.object({
  i: z.number().int(),
  category_l2: z.string().nullable().optional(),
  brand_norm: z.string().nullable().optional(),
  base_name: z.string().nullable().optional(),
  size_value: z.number().nullable().optional(),
  size_unit: z.string().nullable().optional(),
  confidence: z.number().nullable().optional(),
});
const Response = z.object({ results: z.array(z.unknown()) });

function cleanText(value: string | null | undefined): string | null {
  const t = value?.trim();
  return t && t.length <= 120 ? t : null;
}

/**
 * One Proposal per input product, in input order. A field that fails a rule
 * becomes null and is named in `invalid_reason`; an item the model skipped or
 * mangled is all-null with a reason. Nothing is ever repaired or guessed.
 */
export function validateBatchResponse(rawText: string, batch: Candidate[], categorySlugs: Set<string>): Proposal[] {
  let items: unknown[];
  try {
    items = Response.parse(JSON.parse(rawText)).results;
  } catch {
    return batch.map(() => ({ ...EMPTY, invalid_reason: "unparseable_response" }));
  }

  const byIndex = new Map<number, z.infer<typeof ResponseItem>>();
  for (const raw of items) {
    const parsed = ResponseItem.safeParse(raw);
    if (parsed.success && parsed.data.i >= 0 && parsed.data.i < batch.length && !byIndex.has(parsed.data.i)) {
      byIndex.set(parsed.data.i, parsed.data);
    }
  }

  return batch.map((candidate, i) => {
    const item = byIndex.get(i);
    if (!item) return { ...EMPTY, invalid_reason: "missing_from_response" };

    const reasons: string[] = [];
    let category: string | null = item.category_l2 ?? null;
    if (category !== null && !categorySlugs.has(category)) {
      category = null;
      reasons.push("category_not_in_list");
    }

    let sizeValue: number | null = item.size_value ?? null;
    let sizeUnit: SizeUnit | null = SIZE_UNITS.includes(item.size_unit as SizeUnit) ? (item.size_unit as SizeUnit) : null;
    if (candidate.sizeUnit !== null) {
      // The regex parser already sized this product; the LLM never overrides it.
      sizeValue = null;
      sizeUnit = null;
    } else if (sizeValue !== null || item.size_unit) {
      if (sizeValue === null || sizeUnit === null || !isSaneSize(sizeValue, sizeUnit)) {
        sizeValue = null;
        sizeUnit = null;
        reasons.push("size_invalid");
      }
    }

    const confidence = item.confidence !== null && item.confidence !== undefined && item.confidence >= 0 && item.confidence <= 1 ? item.confidence : null;

    return {
      category_l2: category,
      brand_norm: cleanText(item.brand_norm),
      base_name: cleanText(item.base_name),
      size_value: sizeValue,
      size_unit: sizeUnit,
      confidence,
      invalid_reason: reasons.length ? reasons.join(";") : null,
    };
  });
}

export function batchCostUsd(usage: { input_tokens: number; output_tokens: number }): number {
  return (usage.input_tokens * BATCH_PRICE_PER_MTOK.input + usage.output_tokens * BATCH_PRICE_PER_MTOK.output) / 1_000_000;
}

/** Seeded PRNG (mulberry32) so an audit sample can be reproduced from its seed. */
export function seededShuffle<T>(items: T[], seed: number): T[] {
  let a = seed >>> 0;
  const rand = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
