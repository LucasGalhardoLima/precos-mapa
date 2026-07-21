import { createCanvas, DOMMatrix, Path2D } from "@napi-rs/canvas";
import type { PDFDocumentProxy } from "pdfjs-dist";
import OpenAI from "openai";
import sharp from "sharp";
import { generateObject, createGateway } from "ai";
import { Agent } from "undici";
import { z } from "zod";
import { EncarteProduct, EncarteSchema, normalizeEncartePayload } from "@/lib/schemas";
import puppeteer from "puppeteer-core";

// Vercel AI Gateway — routes through Vercel's gateway where provider API keys
// are configured. On Vercel, authenticates via OIDC automatically.
// Large PDFs can take several minutes to process; Node's default undici fetch
// enforces a 5-minute headers timeout, so extend it per Vercel's guidance.
const gateway = createGateway({
  fetch: (url, init) =>
    fetch(url, {
      ...init,
      dispatcher: new Agent({
        headersTimeout: 15 * 60 * 1000,
        bodyTimeout: 15 * 60 * 1000,
      }),
    } as RequestInit),
});

// pdfjs-dist tries require('canvas') to polyfill DOMMatrix and Path2D.
// We provide them from @napi-rs/canvas instead.
globalThis.DOMMatrix = DOMMatrix as unknown as typeof globalThis.DOMMatrix;
globalThis.Path2D = Path2D as unknown as typeof globalThis.Path2D;

// Use require() so Turbopack doesn't try to bundle the native module
// (it's listed in serverExternalPackages in next.config.ts)
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfjs = require("pdfjs-dist/legacy/build/pdf.js") as {
  getDocument: (params: { data: Uint8Array; canvasFactory?: unknown }) => { promise: Promise<PDFDocumentProxy> };
};

// Custom canvas factory using @napi-rs/canvas so pdfjs-dist never
// falls back to require('canvas') (which isn't installed on Vercel).
class NapiCanvasFactory {
  create(width: number, height: number) {
    const canvas = createCanvas(width, height);
    return { canvas, context: canvas.getContext("2d") };
  }
  reset(canvasAndContext: { canvas: ReturnType<typeof createCanvas> }, width: number, height: number) {
    canvasAndContext.canvas.width = width;
    canvasAndContext.canvas.height = height;
  }
  destroy(canvasAndContext: { canvas: ReturnType<typeof createCanvas> | null; context: unknown }) {
    if (canvasAndContext.canvas) {
      canvasAndContext.canvas.width = 0;
      canvasAndContext.canvas.height = 0;
    }
    canvasAndContext.canvas = null;
    canvasAndContext.context = null;
  }
}

interface CrawlerMeta {
  source: string;
  imageUrl: string;
  images: string[];
  pendingPdfUrls?: string[];
  currentPdfName?: string;
  currentPdfIndex?: number;
  totalPdfs?: number;
}

interface CrawlerResult {
  products: EncarteProduct[];
  meta: CrawlerMeta;
}

interface PdfRenderResult {
  images: string[];
  totalPages: number;
  processedPages: number;
}

let _openai: OpenAI | null = null;

function getOpenAi(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY não configurada no servidor.");
  }
  if (!_openai) {
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _openai;
}

const MAX_PDF_PAGES = 30;

function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return "Erro desconhecido";
}

export async function optimizeImage(buffer: Buffer): Promise<string> {
  const processed = await sharp(buffer)
    .resize(3072, 3072, {
      fit: "inside",
      withoutEnlargement: true,
      kernel: "lanczos3",
    })
    .sharpen({ sigma: 1.2 })
    .normalize()
    .png({ compressionLevel: 6, palette: false })
    .toBuffer();

  return `data:image/png;base64,${processed.toString("base64")}`;
}

const IMAGE_EXTRACTION_RETRIES = 3;

// The org's gpt-4o tier caps at a low tokens-per-minute budget, which a batch
// of concurrently-dispatched images can exhaust in seconds. Without this,
// every pass silently fails with an empty result — indistinguishable from a
// genuinely offer-less image — instead of waiting out the rate limit.
async function withRateLimitRetry<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (!(err instanceof OpenAI.RateLimitError) || attempt >= IMAGE_EXTRACTION_RETRIES) {
        throw err;
      }
      const hint = err.message.match(/try again in ([\d.]+)s/i);
      const waitMs = hint ? Math.ceil(parseFloat(hint[1]) * 1000) + 500 : attempt * 2000;
      console.warn(`[CRON] gpt-4o rate limited (attempt ${attempt}/${IMAGE_EXTRACTION_RETRIES}) — waiting ${waitMs}ms`);
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }
}

export async function extractFromImage(base64Image: string): Promise<unknown> {
  const response = await withRateLimitRetry(() =>
    getOpenAi().chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `Você é um especialista em encartes de supermercado brasileiro.

REGRAS:
1. Preços devem ser números (29.90).
2. Se houver dúvida, não invente produto.
3. Unidade deve ser uma destas: kg, un, l, g, ml, pack.
4. Ignore logos e elementos decorativos.
5. Validade no formato YYYY-MM-DD ou null.
6. Se o produto mostrar preço anterior/original (ex: "de 5,99 por 3,99"), extraia como original_price. Se não houver, retorne null.
7. Classifique cada produto em uma destas categorias: Bebidas, Limpeza, Alimentos, Hortifruti, Padaria, Higiene. Use "Alimentos" como padrão se não tiver certeza.

Retorne JSON estrito no formato: { "products": [{ "name": "...", "price": 3.99, "original_price": 5.99, "unit": "un", "validity": "2026-01-21", "market_origin": "Savegnago", "category": "Alimentos" }] }`,
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Extraia ofertas." },
            { type: "image_url", image_url: { url: base64Image } },
          ],
        },
      ],
      response_format: { type: "json_object" },
    }),
  );

  const content = response.choices[0]?.message?.content ?? "{}";
  return JSON.parse(content) as unknown;
}

async function renderPdfToImages(pdfBuffer: Uint8Array | Buffer): Promise<PdfRenderResult> {
  const data = new Uint8Array(pdfBuffer);
  const loadingTask = pdfjs.getDocument({ data, canvasFactory: new NapiCanvasFactory() });
  const pdf = await loadingTask.promise;

  const pageCount = Math.min(pdf.numPages, MAX_PDF_PAGES);
  const pages: string[] = [];

  for (let index = 1; index <= pageCount; index += 1) {
    const page = await pdf.getPage(index);
    const viewport = page.getViewport({ scale: 3.0 });

    const canvas = createCanvas(Math.floor(viewport.width), Math.floor(viewport.height));
    const context = canvas.getContext("2d");

    await page.render({
      // @napi-rs/canvas context is API-compatible with DOM CanvasRenderingContext2D
      canvasContext: context as unknown as CanvasRenderingContext2D,
      viewport,
    }).promise;

    const pngBuffer = canvas.toBuffer("image/png");
    const base64 = pngBuffer.toString("base64");
    pages.push(`data:image/png;base64,${base64}`);
  }

  return {
    images: pages,
    totalPages: pdf.numPages,
    processedPages: pageCount,
  };
}

const EXTRACTION_SYSTEM_PROMPT = `Você é um especialista em encartes de supermercado brasileiro.

REGRAS:
1. Preços devem ser números (29.90).
2. Se houver dúvida, não invente produto.
3. Unidade deve ser uma destas: kg, un, l, g, ml, pack.
4. Ignore logos e elementos decorativos.
5. Validade no formato YYYY-MM-DD ou null.
6. Se o produto mostrar preço anterior/original (ex: "de 5,99 por 3,99"), extraia como original_price. Se não houver, retorne null.
7. Classifique cada produto em uma destas categorias: Bebidas, Limpeza, Alimentos, Hortifruti, Padaria, Higiene. Use "Alimentos" como padrão se não tiver certeza.`;

// Native PDF ingestion (sending the raw file) hits Claude's "Input is too
// long" limit on large, image-heavy flyers. Above this size, render pages to
// optimized images instead — same approach as the JPG/PNG import path.
export const NATIVE_PDF_MAX_BYTES = 8 * 1024 * 1024;

// Discovery-time helper: reads a PDF's page count via pdfjs without
// rendering any page — no canvas allocation. Lets callers (process-import's
// chunking decision) decide chunk-vs-not before paying rendering's memory
// cost, and skip it entirely for files whose dedup status makes rendering
// unnecessary at all.
export async function getPdfPageCount(pdfBuffer: Uint8Array | Buffer): Promise<number> {
  const data = new Uint8Array(pdfBuffer);
  const loadingTask = pdfjs.getDocument({ data, canvasFactory: new NapiCanvasFactory() });
  const pdf = await loadingTask.promise;
  const numPages = pdf.numPages;
  await pdf.destroy();
  return numPages;
}

// Discovery-time helper: renders one page at a time, invoking onPage per
// page and releasing that page's rendering resources before moving to the
// next — keeps peak memory bounded to roughly one page instead of the whole
// document. renderPdfToImages (above) materializes every page at once,
// which is fine for extractFromPdfPages's small-oversized-PDF combined-call
// path (a few pages at most) but OOM-killed a real Vercel Standard instance
// (2GB) when used the same way against a genuine 30-page flyer.
//
// Measured locally against the real flyer that triggered this: without
// page.cleanup(), RSS climbed ~15-20MB per page (410MB → 871MB over 30
// pages) even with the canvas explicitly zeroed out between pages — pdfjs
// caches per-page rendering state (fonts, decoded XObjects) on the
// PDFDocumentProxy itself, which a canvas reset doesn't touch. page.cleanup()
// is pdfjs's own documented API for releasing exactly that.
//
// Renders at a lower scale than renderPdfToImages since each page here is
// sent to the vision model on its own — optimizeImage() downsamples to
// 3072px in the worker regardless, so the extra resolution renderPdfToImages
// uses for multi-page-per-call legibility isn't needed.
const INCREMENTAL_RENDER_SCALE = 2.0;

export async function renderPdfPagesIncrementally(
  pdfBuffer: Uint8Array | Buffer,
  onPage: (page: { buffer: Buffer; pageNumber: number; totalPages: number }) => Promise<void>,
): Promise<void> {
  const data = new Uint8Array(pdfBuffer);
  const loadingTask = pdfjs.getDocument({ data, canvasFactory: new NapiCanvasFactory() });
  const pdf = await loadingTask.promise;

  try {
    const pageCount = Math.min(pdf.numPages, MAX_PDF_PAGES);

    for (let index = 1; index <= pageCount; index += 1) {
      const page = await pdf.getPage(index);
      try {
        const viewport = page.getViewport({ scale: INCREMENTAL_RENDER_SCALE });

        const canvas = createCanvas(Math.floor(viewport.width), Math.floor(viewport.height));
        const context = canvas.getContext("2d");

        await page.render({
          // @napi-rs/canvas context is API-compatible with DOM CanvasRenderingContext2D
          canvasContext: context as unknown as CanvasRenderingContext2D,
          viewport,
        }).promise;

        const pngBuffer = canvas.toBuffer("image/png");
        await onPage({ buffer: pngBuffer, pageNumber: index, totalPages: pdf.numPages });

        canvas.width = 0;
        canvas.height = 0;
      } finally {
        page.cleanup();
      }
    }
  } finally {
    await pdf.destroy();
  }
}

// Multiple rendered pages in one request need much tighter compression than
// the single-image import path (optimizeImage's 3072px PNG) or the combined
// payload trips the Gateway's request size limit ("Request Entity Too Large").
async function optimizePageForBatch(buffer: Buffer): Promise<string> {
  const processed = await sharp(buffer)
    .resize(1800, 1800, {
      fit: "inside",
      withoutEnlargement: true,
      kernel: "lanczos3",
    })
    .sharpen({ sigma: 1.2 })
    .normalize()
    .jpeg({ quality: 72 })
    .toBuffer();

  return `data:image/jpeg;base64,${processed.toString("base64")}`;
}

async function extractFromPdfPages(
  buffer: Uint8Array | Buffer,
  onProgress?: (message: string) => void,
): Promise<EncarteProduct[]> {
  const rendered = await renderPdfToImages(buffer);
  onProgress?.(`PDF grande — renderizando ${rendered.processedPages} de ${rendered.totalPages} página(s) como imagens...`);

  const optimizedImages: string[] = [];
  for (const dataUrl of rendered.images) {
    const base64 = dataUrl.split(",")[1];
    optimizedImages.push(await optimizePageForBatch(Buffer.from(base64, "base64")));
  }

  const { object } = await generateObject({
    model: gateway("anthropic/claude-sonnet-4-6"),
    schema: EncarteSchema,
    system: EXTRACTION_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          ...optimizedImages.map((image) => ({ type: "image" as const, image })),
          {
            type: "text" as const,
            text: "Extraia todas as ofertas deste encarte de supermercado. Analise todas as páginas.",
          },
        ],
      },
    ],
  });

  return object.products;
}

export async function processPdfBuffer(
  buffer: Uint8Array | Buffer,
  sourceName: string,
  onProgress?: (message: string) => void,
): Promise<CrawlerResult> {
  onProgress?.(`Iniciando análise do PDF: ${sourceName}`);

  const pdfData = Buffer.from(buffer);
  let products: EncarteProduct[];

  if (pdfData.byteLength > NATIVE_PDF_MAX_BYTES) {
    products = await extractFromPdfPages(pdfData, onProgress);
    onProgress?.(`${products.length} ofertas extraídas via renderização de páginas.`);
  } else {
    onProgress?.(`Enviando PDF (${Math.round(pdfData.byteLength / 1024)} KB) para Claude Sonnet...`);

    const { object } = await generateObject({
      model: gateway("anthropic/claude-sonnet-4-6"),
      schema: EncarteSchema,
      system: EXTRACTION_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "file",
              data: pdfData,
              mediaType: "application/pdf",
            },
            {
              type: "text",
              text: "Extraia todas as ofertas deste encarte de supermercado. Analise todas as páginas.",
            },
          ],
        },
      ],
    });

    products = object.products;
    onProgress?.(`${products.length} ofertas extraídas via Claude Sonnet.`);
  }

  if (products.length === 0) {
    throw new Error("Extração sem produtos. Nenhum item reconhecido no PDF.");
  }

  return {
    products,
    meta: {
      source: "claude_sonnet_native_pdf",
      imageUrl: "https://via.placeholder.com/800",
      images: [],
    },
  };
}

const PdfUrlsSchema = z.object({
  urls: z.array(z.string().url()).describe("All PDF download URLs found in the page HTML and JavaScript."),
});

async function discoverPdfLinksFromHtml(url: string): Promise<string[]> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Falha ao acessar página (HTTP ${response.status}): ${url}`);
  }
  const html = await response.text();

  // 1. Regex extraction (fast, free)
  const seen = new Set<string>();
  const pdfUrls: string[] = [];
  const regex = /href=["']([^"']*\.pdf[^"']*)/gi;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(html)) !== null) {
    let href = match[1];
    if (!href.startsWith("http")) {
      href = new URL(href, url).toString();
    }
    if (!seen.has(href)) {
      seen.add(href);
      pdfUrls.push(href);
    }
  }

  console.log(`[CRON] Regex found ${pdfUrls.length} PDF link(s) for ${url}`);

  // 2. AI extraction — try to catch JS-triggered PDFs (non-fatal)
  try {
    console.log(`[CRON] Running AI extraction for ${url}...`);

    const { object } = await generateObject({
      model: gateway("anthropic/claude-sonnet-4-6"),
      schema: PdfUrlsSchema,
      system: `You are a web scraping expert. Analyze the provided HTML source code and extract ALL URLs that point to PDF files. Look in:
- href attributes (a tags, link tags)
- onclick handlers (window.open, window.location)
- data-* attributes (data-src, data-url, data-href, data-pdf)
- JavaScript variables and object literals
- Form actions
- Embedded iframes with PDF sources
Return only fully-qualified absolute URLs. If a URL is relative, resolve it against the base URL: ${url}`,
      messages: [
        {
          role: "user",
          content: `Extract all PDF URLs from this HTML:\n\n${html.slice(0, 100_000)}`,
        },
      ],
    });

    // Merge and dedupe
    for (const aiUrl of object.urls) {
      if (!seen.has(aiUrl)) {
        seen.add(aiUrl);
        pdfUrls.push(aiUrl);
      }
    }

    console.log(`[CRON] AI found ${object.urls.length} URL(s), total unique: ${pdfUrls.length}`);
  } catch (err) {
    console.warn(`[CRON] AI extraction failed for ${url}: ${err instanceof Error ? err.message : err}`);
  }

  return pdfUrls;
}

export async function discoverAndDownloadPdf(url: string): Promise<{
  pdfBuffer: Buffer;
  filename: string;
  resolvedPdfUrl: string;
}> {
  const results = await discoverAndDownloadAllPdfs(url);
  return results[0];
}

export async function discoverAndDownloadAllPdfs(url: string): Promise<
  { pdfBuffer: Buffer; filename: string; resolvedPdfUrl: string }[]
> {
  // Direct PDF URL — single result
  if (url.toLowerCase().endsWith(".pdf")) {
    const filename = decodeURIComponent(url.split("/").pop() ?? "encarte.pdf");
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Falha ao baixar PDF (HTTP ${response.status}): ${url}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    return [{ pdfBuffer: Buffer.from(arrayBuffer), filename, resolvedPdfUrl: url }];
  }

  // HTML page — discover and download all PDFs
  const pdfUrls = await discoverPdfLinksFromHtml(url);

  if (pdfUrls.length === 0) {
    throw new Error(`Nenhum PDF encontrado na página: ${url}`);
  }

  const results: { pdfBuffer: Buffer; filename: string; resolvedPdfUrl: string }[] = [];

  for (const pdfUrl of pdfUrls) {
    try {
      const filename = decodeURIComponent(pdfUrl.split("/").pop() ?? "encarte.pdf");
      const pdfResponse = await fetch(pdfUrl);
      if (!pdfResponse.ok) {
        console.error(`[CRON] Failed to download PDF (HTTP ${pdfResponse.status}): ${pdfUrl}`);
        continue;
      }
      const arrayBuffer = await pdfResponse.arrayBuffer();
      results.push({ pdfBuffer: Buffer.from(arrayBuffer), filename, resolvedPdfUrl: pdfUrl });
    } catch (err) {
      console.error(`[CRON] Error downloading PDF ${pdfUrl}: ${err instanceof Error ? err.message : err}`);
    }
  }

  if (results.length === 0) {
    throw new Error(`Falha ao baixar todos os PDFs da página: ${url}`);
  }

  return results;
}

// ---------------------------------------------------------------------------
// Image-based discovery (headless browser)
// ---------------------------------------------------------------------------

export interface RenderStep {
  action: "waitForSelector" | "click" | "waitForNetworkIdle" | "type";
  selector?: string;
  value?: string;
  timeout?: number;
  optional?: boolean; // if true, a waitForSelector timeout is logged but not thrown
}

export interface RenderConfig {
  steps?: RenderStep[];
  imageSelector?: string;
  minImageWidth?: number;
  timeout?: number;
}

async function getChromiumBrowser() {
  // In production (Vercel), use @sparticuz/chromium; locally, use system Chrome
  if (process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.VERCEL) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const chromium = require("@sparticuz/chromium");
    return puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });
  }
  // Local dev — use system Chrome
  const possiblePaths = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium-browser",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  ];
  const { execSync } = await import("child_process");
  let execPath: string | undefined;
  for (const p of possiblePaths) {
    try {
      execSync(`test -f "${p}"`, { stdio: "ignore" });
      execPath = p;
      break;
    } catch {
      continue;
    }
  }
  if (!execPath) {
    throw new Error("Chrome/Chromium not found. Install Google Chrome or set CHROME_PATH.");
  }
  return puppeteer.launch({
    executablePath: execPath,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
}

export async function discoverAndDownloadImages(
  url: string,
  renderConfig?: RenderConfig,
): Promise<{ imageBuffer: Buffer; filename: string; resolvedImageUrl: string }[]> {
  const timeout = renderConfig?.timeout ?? 30000;
  const minWidth = renderConfig?.minImageWidth ?? 300;
  const imageSelector =
    renderConfig?.imageSelector ??
    'img[src*="oferta"], img[src*="encarte"], img[src*="promo"], main img';

  const browser = await getChromiumBrowser();

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    await page.goto(url, { waitUntil: "networkidle2", timeout });

    // Execute render steps (store selection, waits, etc.)
    if (renderConfig?.steps) {
      for (const step of renderConfig.steps) {
        const stepTimeout = step.timeout ?? 10000;
        switch (step.action) {
          case "waitForSelector":
            if (step.selector) {
              try {
                await page.waitForSelector(step.selector, { timeout: stepTimeout });
              } catch (err) {
                if (step.optional) {
                  console.warn(`[CRAWLER] optional waitForSelector "${step.selector}" not found — continuing`);
                } else {
                  throw err;
                }
              }
            }
            break;
          case "click":
            if (step.selector) {
              // Support text= pseudo-selector for clicking by text content
              if (step.selector.startsWith("text=")) {
                const text = step.selector.slice(5);
                const elements = await page.$$("a, button, span, div, li, p, td");
                for (const el of elements) {
                  const elText = await el.evaluate((node) => node.textContent?.trim() ?? "");
                  if (elText.toLowerCase().includes(text.toLowerCase())) {
                    await el.click();
                    break;
                  }
                }
              } else {
                await page.click(step.selector);
              }
            }
            break;
          case "waitForNetworkIdle":
            await page.waitForNetworkIdle({ idleTime: 1000, timeout: stepTimeout });
            break;
          case "type":
            if (step.selector && step.value) {
              await page.type(step.selector, step.value);
            }
            break;
        }
      }
    }

    // Wait briefly for images to load after interactions
    await page.waitForNetworkIdle({ idleTime: 1500, timeout: 15000 }).catch(() => {});

    // Wait for matched <img> elements to actually finish loading so
    // naturalWidth is populated — otherwise unresolved/lazy images read
    // naturalWidth === 0 and silently bypass the size filter below.
    await page.evaluate((sel: string) => {
      const imgs = Array.from(document.querySelectorAll(sel)) as HTMLImageElement[];
      return Promise.all(
        imgs.map((img) => {
          if (img.complete) return Promise.resolve();
          return new Promise<void>((resolve) => {
            img.addEventListener("load", () => resolve(), { once: true });
            img.addEventListener("error", () => resolve(), { once: true });
            setTimeout(resolve, 3000);
          });
        }),
      );
    }, imageSelector);

    // Extract image URLs from rendered DOM
    const imageUrls = await page.evaluate(
      (sel: string, minW: number) => {
        const imgs = document.querySelectorAll(sel);
        const urls: string[] = [];
        const seen = new Set<string>();

        imgs.forEach((img) => {
          const el = img as HTMLImageElement;
          const src = el.src || el.dataset.src || el.getAttribute("data-lazy-src") || "";
          if (!src || seen.has(src)) return;
          // Reject anything below the minimum width, including images whose
          // size never resolved (naturalWidth === 0) — unverifiable size is
          // not a pass, since that's exactly how unloaded lazy banners slip through.
          if (el.naturalWidth < minW) return;
          // Skip tiny icons, logos, spacers
          if (src.includes("logo") || src.includes("icon") || src.includes("spacer")) return;
          seen.add(src);
          urls.push(src);
        });

        return urls;
      },
      imageSelector,
      minWidth,
    );

    console.log(`[CRAWLER] Found ${imageUrls.length} offer image(s) at ${url}`);

    if (imageUrls.length === 0) {
      // Fallback: grab all large images on the page
      const fallbackUrls = await page.evaluate((minW: number) => {
        const imgs = document.querySelectorAll("img");
        const urls: string[] = [];
        imgs.forEach((img) => {
          if (img.naturalWidth >= minW && img.naturalHeight >= minW) {
            const src = img.src || img.dataset.src || "";
            if (src && !src.includes("logo") && !src.includes("icon")) {
              urls.push(src);
            }
          }
        });
        return urls;
      }, minWidth);

      if (fallbackUrls.length === 0) {
        throw new Error(`Nenhuma imagem de oferta encontrada na página: ${url}`);
      }
      imageUrls.push(...fallbackUrls);
      console.log(`[CRAWLER] Fallback found ${fallbackUrls.length} large image(s)`);
    }

    await browser.close();

    // Download all discovered images
    const results: { imageBuffer: Buffer; filename: string; resolvedImageUrl: string }[] = [];

    for (let i = 0; i < imageUrls.length; i++) {
      const imageUrl = imageUrls[i];
      try {
        const response = await fetch(imageUrl);
        if (!response.ok) {
          console.error(`[CRAWLER] Failed to download image (HTTP ${response.status}): ${imageUrl}`);
          continue;
        }
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Determine extension from content-type
        const contentType = response.headers.get("content-type") ?? "image/png";
        const ext = contentType.includes("jpeg") || contentType.includes("jpg")
          ? "jpg"
          : contentType.includes("webp")
            ? "webp"
            : "png";

        const filename = `oferta_${i + 1}.${ext}`;
        results.push({ imageBuffer: buffer, filename, resolvedImageUrl: imageUrl });
      } catch (err) {
        console.error(`[CRAWLER] Error downloading image ${imageUrl}: ${extractErrorMessage(err)}`);
      }
    }

    if (results.length === 0) {
      throw new Error(`Falha ao baixar todas as imagens da página: ${url}`);
    }

    return results;
  } catch (err) {
    await browser.close().catch(() => {});
    throw err;
  }
}

export async function crawlUrl(url: string, onProgress?: (message: string) => void): Promise<CrawlerResult> {
  // Direct PDF URL — download and process without page navigation
  if (url.toLowerCase().endsWith(".pdf")) {
    const pdfName = decodeURIComponent(url.split("/").pop() ?? "PDF");
    onProgress?.(`Baixando PDF direto: ${pdfName}`);

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Falha ao baixar PDF (HTTP ${response.status}): ${url}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    onProgress?.(`PDF baixado (${Math.round(buffer.byteLength / 1024)} KB). Iniciando processamento...`);

    const result = await processPdfBuffer(buffer, pdfName, onProgress);

    return {
      products: result.products,
      meta: {
        source: "claude_sonnet_native_pdf",
        imageUrl: result.meta.images[0] ?? "https://via.placeholder.com/800",
        images: result.meta.images,
        pendingPdfUrls: [],
        currentPdfName: pdfName,
        currentPdfIndex: 1,
        totalPdfs: 1,
      },
    };
  }

  onProgress?.(`Visitando URL: ${url}`);

  const pdfUrls = await discoverPdfLinksFromHtml(url);
  onProgress?.("Página carregada. Buscando encartes...");

  if (pdfUrls.length === 0) {
    throw new Error(`Nenhum PDF encontrado na página: ${url}`);
  }

  const totalPdfs = pdfUrls.length;
  const firstPdfUrl = pdfUrls[0];
  const pdfName = decodeURIComponent(firstPdfUrl.split("/").pop() ?? "PDF 1");

  if (totalPdfs > 1) {
    onProgress?.(`${totalPdfs} PDFs encontrados. Processando: ${pdfName}`);
  } else {
    onProgress?.(`1 PDF encontrado. Processando: ${pdfName}`);
  }

  const pdfResponse = await fetch(firstPdfUrl);
  if (!pdfResponse.ok) {
    throw new Error(`Falha ao baixar PDF (HTTP ${pdfResponse.status}): ${firstPdfUrl}`);
  }
  const downloadedBuffer = Buffer.from(await pdfResponse.arrayBuffer());

  const result = await processPdfBuffer(downloadedBuffer, pdfName, (msg) => {
    onProgress?.(`PDF 1/${totalPdfs}: ${msg}`);
  });

  onProgress?.(`PDF 1/${totalPdfs}: ${result.products.length} ofertas extraídas.`);

  return {
    products: result.products,
    meta: {
      source: "claude_sonnet_native_pdf",
      imageUrl: result.meta.images[0] ?? "https://via.placeholder.com/800",
      images: result.meta.images,
      pendingPdfUrls: pdfUrls.slice(1),
      currentPdfName: pdfName,
      currentPdfIndex: 1,
      totalPdfs,
    },
  };
}
