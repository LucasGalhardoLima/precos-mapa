import { EncarteProduct } from "@/lib/schemas";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PassResult {
  passIndex: number;
  products: EncarteProduct[];
  error?: string;
}

export interface ConsensusResult {
  type: "unanimous" | "majority" | "none";
  confidenceScore: number;
  consensusProducts: EncarteProduct[] | null;
  passes: PassResult[];
  selectedPassIndex: number | null;
}

// ---------------------------------------------------------------------------
// Canonical key for product comparison
// Ignores validity, original_price, category, market_origin — these vary
// across GPT passes without affecting core data quality.
// ---------------------------------------------------------------------------

function canonicalKey(p: EncarteProduct): string {
  return `${p.name.trim().toLowerCase()}|${p.price.toFixed(2)}|${p.unit}`;
}

/** Build a Set of canonical keys from a product list (order-independent). */
function buildCanonicalSet(products: EncarteProduct[]): Set<string> {
  return new Set(products.map(canonicalKey));
}

/** Check if two Sets are deeply equal. */
function setsEqual(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const item of a) {
    if (!b.has(item)) return false;
  }
  return true;
}

/**
 * Compare passes and determine consensus.
 */
export function computeConsensus(passes: PassResult[]): ConsensusResult {
  // Filter out error passes (empty products from errors)
  const validPasses = passes.filter((p) => !p.error && p.products.length > 0);

  if (validPasses.length === 0) {
    return {
      type: "none",
      confidenceScore: 0,
      consensusProducts: null,
      passes,
      selectedPassIndex: null,
    };
  }

  if (validPasses.length === 1) {
    // Only one valid pass — treat as no consensus unless it's the only pass
    if (passes.length === 1) {
      return {
        type: "unanimous",
        confidenceScore: 100,
        consensusProducts: validPasses[0].products,
        passes,
        selectedPassIndex: validPasses[0].passIndex,
      };
    }
    // One valid out of multiple — not enough for consensus
    return {
      type: "none",
      confidenceScore: 0,
      consensusProducts: null,
      passes,
      selectedPassIndex: null,
    };
  }

  // Build canonical sets for each valid pass
  const sets = validPasses.map((p) => buildCanonicalSet(p.products));

  // Check unanimous: ALL passes must be valid AND match
  const allMatch = sets.every((s) => setsEqual(s, sets[0]));
  if (allMatch && validPasses.length === passes.length) {
    return {
      type: "unanimous",
      confidenceScore: 100,
      consensusProducts: validPasses[0].products,
      passes,
      selectedPassIndex: validPasses[0].passIndex,
    };
  }

  // If all valid passes match but some errored → majority
  if (allMatch && validPasses.length >= 2) {
    return {
      type: "majority",
      confidenceScore: 66.67,
      consensusProducts: validPasses[0].products,
      passes,
      selectedPassIndex: validPasses[0].passIndex,
    };
  }

  // Check majority (at least 2 passes match)
  for (let i = 0; i < sets.length; i++) {
    let matchCount = 1;
    for (let j = i + 1; j < sets.length; j++) {
      if (setsEqual(sets[i], sets[j])) {
        matchCount++;
      }
    }
    if (matchCount >= 2) {
      return {
        type: "majority",
        confidenceScore: 66.67,
        consensusProducts: validPasses[i].products,
        passes,
        selectedPassIndex: validPasses[i].passIndex,
      };
    }
  }

  // No consensus
  return {
    type: "none",
    confidenceScore: 0,
    consensusProducts: null,
    passes,
    selectedPassIndex: null,
  };
}
