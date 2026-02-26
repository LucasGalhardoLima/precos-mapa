import { processPdfBuffer } from "@/lib/crawler/service";
import { normalizeProducts } from "@/lib/schemas";
import { computeConsensus, PassResult, ConsensusResult } from "@/lib/import-consensus";

// Re-export types and consensus for convenience
export { computeConsensus } from "@/lib/import-consensus";
export type { PassResult, ConsensusResult } from "@/lib/import-consensus";

/**
 * Run `processPdfBuffer()` `passCount` times and compute consensus.
 * Each pass normalizes products independently via `normalizeProducts()`.
 */
export async function runMultiPassExtraction(
  pdfBuffer: Buffer | Uint8Array,
  filename: string,
  passCount: number = 3,
): Promise<ConsensusResult> {
  const passes: PassResult[] = [];

  for (let i = 0; i < passCount; i++) {
    try {
      const result = await processPdfBuffer(pdfBuffer, filename);
      // Re-normalize through our normalizer for consistency
      const products = normalizeProducts(result.products);
      passes.push({ passIndex: i, products });
    } catch (err) {
      passes.push({
        passIndex: i,
        products: [],
        error: err instanceof Error ? err.message : "Erro desconhecido",
      });
    }
  }

  return computeConsensus(passes);
}
