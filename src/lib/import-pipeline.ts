import { processPdfBuffer, extractFromImage, optimizeImage } from "@/lib/crawler/service";
import { normalizeProducts, normalizeEncartePayload } from "@/lib/schemas";
import { computeConsensus, PassResult, ConsensusResult } from "@/lib/import-consensus";

// Re-export types and consensus for convenience
export { computeConsensus } from "@/lib/import-consensus";
export type { PassResult, ConsensusResult } from "@/lib/import-consensus";

/**
 * Run up to `maxPasses` extractions **one at a time**, stopping as soon as
 * `computeConsensus` returns a non-"none" result.  This keeps AI cost to the
 * minimum needed: most flyers succeed on pass 1; a second pass is only run
 * when the first produces nothing; a third only when the first two disagree.
 */
export async function runIncrementalExtraction(
  pdfBuffer: Buffer | Uint8Array,
  filename: string,
  maxPasses: number = 3,
): Promise<ConsensusResult> {
  const passes: PassResult[] = [];

  for (let i = 0; i < maxPasses; i++) {
    try {
      const result = await processPdfBuffer(pdfBuffer, filename);
      passes.push({ passIndex: i, products: normalizeProducts(result.products) });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Erro desconhecido";
      console.error(`[CRON] PDF pass ${i + 1} failed: ${errorMsg}`);
      passes.push({ passIndex: i, products: [], error: errorMsg });
    }

    const consensus = computeConsensus(passes);
    if (consensus.type !== "none") return consensus;
    if (i < maxPasses - 1) {
      console.log(`[CRON] PDF pass ${i + 1} below threshold — running pass ${i + 2}`);
    }
  }

  return computeConsensus(passes);
}

/**
 * Image variant of `runIncrementalExtraction`.  Optimizes the image once then
 * runs up to `maxPasses` GPT-4o vision calls incrementally.
 */
export async function runIncrementalImageExtraction(
  imageBuffer: Buffer,
  filename: string,
  maxPasses: number = 3,
): Promise<ConsensusResult> {
  const optimizedBase64 = await optimizeImage(imageBuffer);
  const passes: PassResult[] = [];

  for (let i = 0; i < maxPasses; i++) {
    try {
      const raw = await extractFromImage(optimizedBase64);
      const { products } = normalizeEncartePayload(raw);
      passes.push({ passIndex: i, products });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Erro desconhecido";
      console.error(`[CRON] Image pass ${i + 1} failed: ${errorMsg}`);
      passes.push({ passIndex: i, products: [], error: errorMsg });
    }

    const consensus = computeConsensus(passes);
    if (consensus.type !== "none") return consensus;
    if (i < maxPasses - 1) {
      console.log(`[CRON] Image pass ${i + 1} below threshold — running pass ${i + 2}`);
    }
  }

  return computeConsensus(passes);
}

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
      const { products } = normalizeEncartePayload(raw);
      return {
        passIndex: i,
        products,
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
