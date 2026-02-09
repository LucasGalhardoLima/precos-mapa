import { chromium } from "playwright";
import OpenAI from "openai";
import sharp from "sharp";
import { EncarteProduct, EncarteSchema } from "@/lib/schemas";

interface CrawlerMeta {
  isMock: boolean;
  source: string;
  imageUrl: string;
  images: string[];
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
  getDocument: (options: { data: string }) => PdfLoadingTask;
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return "Erro desconhecido";
}

async function optimizeImage(buffer: Buffer): Promise<string> {
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

async function extractFromImage(base64Image: string): Promise<unknown> {
  const response = await openai.chat.completions.create({
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

Retorne JSON estrito no formato: { "products": [{ "name": "...", "price": 19.9, "unit": "un", "validity": "2026-01-21", "market_origin": "Savegnago" }] }`,
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

async function renderPdfToImages(page: import("playwright").Page, pdfBase64: string): Promise<string[]> {
  await page.goto("about:blank");
  await page.addScriptTag({ url: "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js" });

  const images = await page.evaluate(async (base64) => {
    const runtimeCandidate = (window as unknown as Record<string, unknown>)["pdfjs-dist/build/pdf"];
    if (!runtimeCandidate) {
      throw new Error("PDF.js runtime indisponível");
    }

    const pdfjs = runtimeCandidate as PdfJsRuntime;
    pdfjs.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

    const loadingTask = pdfjs.getDocument({ data: atob(base64) });
    const pdf = await loadingTask.promise;
    const pages: string[] = [];
    const pageCount = Math.min(pdf.numPages, 15);

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

    return pages;
  }, pdfBase64);

  return images;
}

export async function processPdfBuffer(
  buffer: Uint8Array | Buffer,
  sourceName: string,
  onProgress?: (message: string) => void,
): Promise<CrawlerResult> {
  onProgress?.(`Iniciando análise do PDF: ${sourceName}`);

  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const allProducts: EncarteProduct[] = [];
  const allImages: string[] = [];

  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    const pdfBase64 = Buffer.from(buffer).toString("base64");

    const renderedImages = await renderPdfToImages(page, pdfBase64);
    onProgress?.(`${renderedImages.length} páginas renderizadas em alta definição.`);

    for (let index = 0; index < renderedImages.length; index += 1) {
      onProgress?.(`Analisando página ${index + 1} de ${renderedImages.length}...`);

      const rawBase64 = renderedImages[index].split(",")[1];
      const optimized = await optimizeImage(Buffer.from(rawBase64, "base64"));
      allImages.push(optimized);

      try {
        const extracted = await extractFromImage(optimized);
        const validated = EncarteSchema.safeParse(extracted);

        if (validated.success) {
          allProducts.push(...validated.data.products);
          onProgress?.(`Sucesso: ${validated.data.products.length} ofertas extraídas da página ${index + 1}.`);
        } else {
          onProgress?.(`Aviso: página ${index + 1} sem itens válidos após validação.`);
        }
      } catch {
        onProgress?.(`Erro na página ${index + 1}. Pulando...`);
      }
    }
  } finally {
    await browser.close().catch(() => undefined);
  }

  return {
    products: allProducts,
    meta: {
      isMock: false,
      source: "gpt4o_pdfjs_browser_sharp",
      imageUrl: allImages[0] ?? "https://via.placeholder.com/800",
      images: allImages,
    },
  };
}

export async function crawlUrl(url: string, onProgress?: (message: string) => void): Promise<CrawlerResult> {
  onProgress?.(`Visitando URL: ${url}`);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
    onProgress?.("Página carregada. Buscando encartes...");

    let pdfUrl: string | null = null;

    if (url.endsWith(".pdf")) {
      pdfUrl = url;
    } else {
      const anchors = await page.$$('a[href$=".pdf"]');
      if (anchors.length > 0) {
        pdfUrl = await anchors[0].getAttribute("href");
      }

      if (pdfUrl && !pdfUrl.startsWith("http")) {
        pdfUrl = new URL(pdfUrl, url).toString();
      }
    }

    if (pdfUrl) {
      onProgress?.(`PDF localizado: ${pdfUrl}. Iniciando download...`);
      const response = await page.request.get(pdfUrl);
      const downloadedBuffer = await response.body();
      return await processPdfBuffer(downloadedBuffer, pdfUrl, onProgress);
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
    const validated = EncarteSchema.safeParse(extracted);

    const products = validated.success ? validated.data.products : [];
    onProgress?.(`Extração concluída: ${products.length} ofertas encontradas.`);

    return {
      products,
      meta: {
        isMock: false,
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
