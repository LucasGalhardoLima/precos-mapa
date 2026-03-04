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
// Fuzzy matching helpers
// ---------------------------------------------------------------------------

const STOP_WORDS = new Set([
  "de", "do", "da", "dos", "das", "com", "e", "em", "no", "na", "nos", "nas",
  "ao", "aos", "por", "para", "pelo", "pela", "um", "uma", "uns", "umas",
]);

/** Strip accents, remove Portuguese articles/prepositions, lowercase, collapse whitespace. */
export function normalizeForComparison(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .filter((w) => !STOP_WORDS.has(w))
    .join(" ");
}

/** Jaccard similarity on word tokens: |intersection| / |union|. */
export function tokenSimilarity(a: string, b: string): number {
  const setA = new Set(a.split(/\s+/).filter(Boolean));
  const setB = new Set(b.split(/\s+/).filter(Boolean));

  if (setA.size === 0 && setB.size === 0) return 1;
  if (setA.size === 0 || setB.size === 0) return 0;

  let intersection = 0;
  for (const token of setA) {
    if (setB.has(token)) intersection++;
  }

  const union = setA.size + setB.size - intersection;
  return intersection / union;
}

/** Two products match if price + unit are exact AND names are similar enough. */
export function productsMatch(a: EncarteProduct, b: EncarteProduct): boolean {
  if (a.price !== b.price) return false;
  if (a.unit !== b.unit) return false;

  const normA = normalizeForComparison(a.name);
  const normB = normalizeForComparison(b.name);

  if (normA === normB) return true;
  return tokenSimilarity(normA, normB) >= 0.8;
}

/** Greedy 1:1 matching between two product lists. */
export function computeOverlap(
  passA: EncarteProduct[],
  passB: EncarteProduct[],
): { matchedCount: number; overlapRatio: number } {
  const maxLen = Math.max(passA.length, passB.length);
  if (maxLen === 0) return { matchedCount: 0, overlapRatio: 1 };

  const usedB = new Set<number>();
  let matchedCount = 0;

  for (const prodA of passA) {
    for (let j = 0; j < passB.length; j++) {
      if (usedB.has(j)) continue;
      if (productsMatch(prodA, passB[j])) {
        usedB.add(j);
        matchedCount++;
        break;
      }
    }
  }

  return { matchedCount, overlapRatio: matchedCount / maxLen };
}

// ---------------------------------------------------------------------------
// Consensus
// ---------------------------------------------------------------------------

/**
 * Compare passes and determine consensus using fuzzy product matching.
 */
export function computeConsensus(passes: PassResult[]): ConsensusResult {
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
    if (passes.length === 1) {
      return {
        type: "unanimous",
        confidenceScore: 100,
        consensusProducts: validPasses[0].products,
        passes,
        selectedPassIndex: validPasses[0].passIndex,
      };
    }
    return {
      type: "none",
      confidenceScore: 0,
      consensusProducts: null,
      passes,
      selectedPassIndex: null,
    };
  }

  // Compute pairwise overlap between all valid passes
  let bestOverlap = 0;
  let bestPairA = 0;
  let bestPairB = 1;

  for (let i = 0; i < validPasses.length; i++) {
    for (let j = i + 1; j < validPasses.length; j++) {
      const { overlapRatio } = computeOverlap(
        validPasses[i].products,
        validPasses[j].products,
      );
      if (overlapRatio > bestOverlap) {
        bestOverlap = overlapRatio;
        bestPairA = i;
        bestPairB = j;
      }
    }
  }

  if (bestOverlap < 0.6) {
    return {
      type: "none",
      confidenceScore: 0,
      consensusProducts: null,
      passes,
      selectedPassIndex: null,
    };
  }

  // Select the pass with the most products from the best pair
  const selectedIdx =
    validPasses[bestPairA].products.length >= validPasses[bestPairB].products.length
      ? bestPairA
      : bestPairB;
  const selectedPass = validPasses[selectedIdx];
  const confidence = Math.round(bestOverlap * 10000) / 100; // e.g. 0.8333 → 83.33

  // Check if ALL valid passes match with high overlap → unanimous
  if (validPasses.length === passes.length && bestOverlap >= 0.8) {
    // Verify all pairs meet the threshold
    let allMatch = true;
    for (let i = 0; i < validPasses.length && allMatch; i++) {
      for (let j = i + 1; j < validPasses.length && allMatch; j++) {
        const { overlapRatio } = computeOverlap(
          validPasses[i].products,
          validPasses[j].products,
        );
        if (overlapRatio < 0.8) allMatch = false;
      }
    }
    if (allMatch) {
      return {
        type: "unanimous",
        confidenceScore: confidence,
        consensusProducts: selectedPass.products,
        passes,
        selectedPassIndex: selectedPass.passIndex,
      };
    }
  }

  // Majority
  return {
    type: "majority",
    confidenceScore: confidence,
    consensusProducts: selectedPass.products,
    passes,
    selectedPassIndex: selectedPass.passIndex,
  };
}
