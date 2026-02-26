import { chromium } from "playwright";
import OpenAI from "openai";
import sharp from "sharp";
import { EncarteProduct, normalizeEncartePayload } from "@/lib/schemas";

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

interface PdfViewport {
  width: number;
  height: number;
}

interface PdfPage {
  getViewport: (options: { scale: number }) => PdfViewport;
  render: (options: { canvasContext: CanvasRenderingContext2D; viewport: PdfViewport }) => { promise: Promise<void> };
}

interface PdfDocument {
  numPages: number;
  getPage: (pageNumber: number) => Promise<PdfPage>;
}

interface PdfLoadingTask {
  promise: Promise<PdfDocument>;
}

interface PdfJsRuntime {
  GlobalWorkerOptions: { workerSrc: string };
  getDocument: (options: { data: string | Uint8Array }) => PdfLoadingTask;
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

export async function extractFromImage(base64Image: string): Promise<unknown> {
  const response = await getOpenAi().chat.completions.create({
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
  });

  const content = response.choices[0]?.message?.content ?? "{}";
  return JSON.parse(content) as unknown;
}

async function renderPdfToImages(page: import("playwright").Page, pdfBase64: string): Promise<PdfRenderResult> {
  await page.goto("about:blank");
  await page.addScriptTag({ url: "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js" });

  const result = await page.evaluate(async ({ base64, maxPages }: { base64: string; maxPages: number }) => {
    const runtimeCandidate = (window as unknown as Record<string, unknown>)["pdfjs-dist/build/pdf"];
    if (!runtimeCandidate) {
      throw new Error("PDF.js runtime indisponível");
    }

    const pdfjs = runtimeCandidate as PdfJsRuntime;
    pdfjs.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }

    const loadingTask = pdfjs.getDocument({ data: bytes });
    const pdf = await loadingTask.promise;
    const pages: string[] = [];
    const pageCount = Math.min(pdf.numPages, maxPages);

    for (let index = 1; index <= pageCount; index += 1) {
      const pageItem = await pdf.getPage(index);
      const viewport = pageItem.getViewport({ scale: 3.0 });

      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      if (!context) {
        continue;
      }

      canvas.width = viewport.width;
      canvas.height = viewport.height;

      await pageItem.render({
        canvasContext: context,
        viewport,
      }).promise;

      pages.push(canvas.toDataURL("image/png"));
    }

    return {
      images: pages,
      totalPages: pdf.numPages,
      processedPages: pageCount,
    };
  }, { base64: pdfBase64, maxPages: MAX_PDF_PAGES });

  return result;
}

export async function processPdfBuffer(
  buffer: Uint8Array | Buffer,
  sourceName: string,
  onProgress?: (message: string) => void,
): Promise<CrawlerResult> {
  getOpenAi();

  onProgress?.(`Iniciando análise do PDF: ${sourceName}`);

  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const allProducts: EncarteProduct[] = [];
  const allImages: string[] = [];
  const pageErrors: string[] = [];

  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    const pdfBase64 = Buffer.from(buffer).toString("base64");

    const rendered = await renderPdfToImages(page, pdfBase64);
    if (rendered.totalPages > rendered.processedPages) {
      onProgress?.(
        `PDF com ${rendered.totalPages} páginas. Processando ${rendered.processedPages} primeiras (limite atual: ${MAX_PDF_PAGES}).`,
      );
    } else {
      onProgress?.(`${rendered.processedPages} páginas renderizadas em alta definição.`);
    }

    for (let index = 0; index < rendered.images.length; index += 1) {
      onProgress?.(`Analisando página ${index + 1} de ${rendered.processedPages}...`);

      const rawBase64 = rendered.images[index].split(",")[1];
      const optimized = await optimizeImage(Buffer.from(rawBase64, "base64"));
      allImages.push(optimized);

      try {
        const extracted = await extractFromImage(optimized);
        const normalized = normalizeEncartePayload(extracted);

        if (normalized.products.length > 0) {
          allProducts.push(...normalized.products);
          onProgress?.(`Sucesso: ${normalized.products.length} ofertas extraídas da página ${index + 1}.`);
        } else {
          onProgress?.(`Aviso: página ${index + 1} sem itens válidos após validação.`);
        }
      } catch (error) {
        const message = extractErrorMessage(error);
        pageErrors.push(`Página ${index + 1}: ${message}`);
        onProgress?.(`Erro na página ${index + 1}: ${message}`);
      }
    }

    if (allProducts.length === 0) {
      const reason = pageErrors.length > 0 ? pageErrors.slice(0, 3).join(" | ") : "Nenhum item reconhecido nas páginas.";
      throw new Error(`Extração sem produtos. ${reason}`);
    }
  } finally {
    await browser.close().catch(() => undefined);
  }

  return {
    products: allProducts,
    meta: {
      source: "gpt4o_pdfjs_browser_sharp",
      imageUrl: allImages[0] ?? "https://via.placeholder.com/800",
      images: allImages,
    },
  };
}

export async function discoverAndDownloadPdf(url: string): Promise<{
  pdfBuffer: Buffer;
  filename: string;
  resolvedPdfUrl: string;
}> {
  // Direct PDF URL — download without page navigation
  if (url.toLowerCase().endsWith(".pdf")) {
    const filename = decodeURIComponent(url.split("/").pop() ?? "encarte.pdf");
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Falha ao baixar PDF (HTTP ${response.status}): ${url}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    return { pdfBuffer: Buffer.from(arrayBuffer), filename, resolvedPdfUrl: url };
  }

  // HTML page — navigate with Playwright and find PDF links
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });

    const pdfUrls: string[] = [];
    const anchors = await page.$$('a[href$=".pdf"]');
    const seen = new Set<string>();
    for (const anchor of anchors) {
      let href = await anchor.getAttribute("href");
      if (!href) continue;
      if (!href.startsWith("http")) {
        href = new URL(href, url).toString();
      }
      if (!seen.has(href)) {
        seen.add(href);
        pdfUrls.push(href);
      }
    }

    if (pdfUrls.length === 0) {
      throw new Error(`Nenhum PDF encontrado na página: ${url}`);
    }

    const firstPdfUrl = pdfUrls[0];
    const filename = decodeURIComponent(firstPdfUrl.split("/").pop() ?? "encarte.pdf");

    const pdfResponse = await page.request.get(firstPdfUrl);
    const pdfBuffer = Buffer.from(await pdfResponse.body());

    return { pdfBuffer, filename, resolvedPdfUrl: firstPdfUrl };
  } finally {
    await browser.close().catch(() => undefined);
  }
}

export async function crawlUrl(url: string, onProgress?: (message: string) => void): Promise<CrawlerResult> {
  getOpenAi();

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
        source: "gpt4o_pdfjs_browser_sharp",
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

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
    onProgress?.("Página carregada. Buscando encartes...");

    const pdfUrls: string[] = [];
    const anchors = await page.$$('a[href$=".pdf"]');
    const seen = new Set<string>();
    for (const anchor of anchors) {
      let href = await anchor.getAttribute("href");
      if (!href) continue;
      if (!href.startsWith("http")) {
        href = new URL(href, url).toString();
      }
      if (!seen.has(href)) {
        seen.add(href);
        pdfUrls.push(href);
      }
    }

    if (pdfUrls.length > 0) {
      const totalPdfs = pdfUrls.length;
      const firstPdfUrl = pdfUrls[0];
      const pdfName = decodeURIComponent(firstPdfUrl.split("/").pop() ?? "PDF 1");

      if (totalPdfs > 1) {
        onProgress?.(`${totalPdfs} PDFs encontrados. Processando: ${pdfName}`);
      } else {
        onProgress?.(`1 PDF encontrado. Processando: ${pdfName}`);
      }

      const pdfResponse = await page.request.get(firstPdfUrl);
      const downloadedBuffer = await pdfResponse.body();
      const result = await processPdfBuffer(downloadedBuffer, pdfName, (msg) => {
        onProgress?.(`PDF 1/${totalPdfs}: ${msg}`);
      });

      onProgress?.(`PDF 1/${totalPdfs}: ${result.products.length} ofertas extraídas.`);

      return {
        products: result.products,
        meta: {

          source: "gpt4o_pdfjs_browser_sharp",
          imageUrl: result.meta.images[0] ?? "https://via.placeholder.com/800",
          images: result.meta.images,
          pendingPdfUrls: pdfUrls.slice(1),
          currentPdfName: pdfName,
          currentPdfIndex: 1,
          totalPdfs,
        },
      };
    }

    onProgress?.("Nenhum PDF encontrado. Capturando página inteira...");
    const screenshot = await page.screenshot({
      fullPage: true,
      type: "jpeg",
      quality: 50,
    });

    onProgress?.("Screenshot capturado. Iniciando pipeline de visão...");

    const optimizedImage = await optimizeImage(screenshot);
    const extracted = await extractFromImage(optimizedImage);
    const normalized = normalizeEncartePayload(extracted);
    const products = normalized.products;
    onProgress?.(`Extração concluída: ${products.length} ofertas encontradas.`);

    return {
      products,
      meta: {
        source: "gpt4o_screenshot",
        imageUrl: optimizedImage,
        images: [optimizedImage],
      },
    };
  } catch (error) {
    onProgress?.(`Erro: ${extractErrorMessage(error)}`);
    throw error;
  } finally {
    await browser.close().catch(() => undefined);
  }
}
