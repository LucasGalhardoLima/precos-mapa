import { processPdfBuffer, extractFromImage, optimizeImage } from "@/lib/crawler/service";
import { normalizeProducts, normalizeEncartePayload } from "@/lib/schemas";
import { computeConsensus, PassResult, ConsensusResult } from "@/lib/import-consensus";

// Re-export types and consensus for convenience
export { computeConsensus } from "@/lib/import-consensus";
export type { PassResult, ConsensusResult } from "@/lib/import-consensus";

/**
 * Run `processPdfBuffer()` `passCount` times **in parallel** and compute consensus.
 * Each pass normalizes products independently via `normalizeProducts()`.
 */
export async function runMultiPassExtraction(
  pdfBuffer: Buffer | Uint8Array,
  filename: string,
  passCount: number = 3,
): Promise<ConsensusResult> {
  const settled = await Promise.allSettled(
    Array.from({ length: passCount }, (_, i) =>
      processPdfBuffer(pdfBuffer, filename).then((result) => ({
        passIndex: i,
        products: normalizeProducts(result.products),
      })),
    ),
  );

  const passes: PassResult[] = settled.map((outcome, i) => {
    if (outcome.status === "fulfilled") {
      return outcome.value;
    }
    const errorMsg =
      outcome.reason instanceof Error
        ? outcome.reason.message
        : "Erro desconhecido";
    console.error(`[CRON] Pass ${i + 1} failed: ${errorMsg}`);
    return { passIndex: i, products: [], error: errorMsg };
  });

  return computeConsensus(passes);
}

/**
 * Run `extractFromImage()` `passCount` times **in parallel** for an image buffer
 * and compute consensus. Uses GPT-4o vision for each pass.
 */
export async function runMultiPassImageExtraction(
  imageBuffer: Buffer,
  filename: string,
  passCount: number = 3,
): Promise<ConsensusResult> {
  // Optimize the image once, reuse for all passes
  const optimizedBase64 = await optimizeImage(imageBuffer);

  const settled = await Promise.allSettled(
    Array.from({ length: passCount }, async (_, i) => {
      const raw = await extractFromImage(optimizedBase64);
      const products = normalizeEncartePayload(raw);
      return {
        passIndex: i,
        products: normalizeProducts(products),
      };
    }),
  );

  const passes: PassResult[] = settled.map((outcome, i) => {
    if (outcome.status === "fulfilled") {
      return outcome.value;
    }
    const errorMsg =
      outcome.reason instanceof Error
        ? outcome.reason.message
        : "Erro desconhecido";
    console.error(`[CRON] Image pass ${i + 1} failed: ${errorMsg}`);
    return { passIndex: i, products: [], error: errorMsg };
  });

  return computeConsensus(passes);
}
