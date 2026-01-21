
import { chromium } from 'playwright';
import OpenAI from 'openai';
import sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { EncarteSchema } from '@/lib/schemas';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function optimizeImage(buffer: Buffer): Promise<string> {
  const processed = await sharp(buffer)
    .resize(3072, 3072, { 
      fit: 'inside', 
      withoutEnlargement: true,
      kernel: 'lanczos3'
    })
    .sharpen({ sigma: 1.2 })
    .normalize()
    .png({ compressionLevel: 6, palette: false })
    .toBuffer();
  
  return `data:image/png;base64,${processed.toString('base64')}`;
}

async function extractFromImage(base64Image: string, index: number) {
  console.log(`[AI] Analyzing page ${index + 1}...`);
  
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: `Você é um ESPECIALISTA SENIOR em encartes de supermercado brasileiro.

CRITICAL: Esta é uma DEMONSTRAÇÃO. Precisão ABSOLUTA é mandatória.

REGRAS DE OURO:
1. Preços em JSON devem ser NUMÉRICOS (ex: 29.90). Mesmo que no encarte esteja "29,90", converta para 29.90.
2. Se tiver dúvida no preço, use null (melhor omitir que errar).
3. Unidades devem seguir ESTREITAMENTE: kg, un, l, g, ml, pack.
   - litro -> l
   - unidade/cada/un -> un
   - pacote -> pack
4. Ignore QR codes, logos, banners decorativos.
5. "Leve 3 Pague 2" → extraia preço unitário normal.
6. Validade: Procure por "Válido até" ou "Ofertas válidas para" no cabeçalho ou rodapé. Formato YYYY-MM-DD ou null.

PADRÕES DE VALIDAÇÃO:
- Preço entre R$ 0.10 e R$ 999.99 (fora disso: suspeito).
- Nome com pelo menos 2 palavras (evite "Oferta", "Limpeza").
- Sempre preencha market_origin se visível (ex: Savegnago).

EXEMPLO OUTPUT (JSON strict):
{ "products": [{ "name": "Sabão Brilhante 2,2kg", "price": 19.90, "unit": "un", "validity": "2026-01-21", "market_origin": "Savegnago" }] }`
      },
      {
        role: "user",
        content: [
            { type: "text", text: "Extraia ofertas." },
            { type: "image_url", image_url: { url: base64Image } }
        ]
      }
    ],
    response_format: { type: "json_object" }
  });

  const content = response.choices[0].message.content || "{}";
  return JSON.parse(content);
}

export async function processPdfBuffer(
  buffer: Uint8Array | Buffer, 
  sourceName: string,
  onProgress?: (msg: string) => void
) {
  console.log(`[Service] Processing PDF: ${sourceName}`);
  onProgress?.(`Iniciando análise do PDF: ${sourceName}`);
  
  const browser = await chromium.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'] 
  });
  
  let allProducts: any[] = [];
  let allImages: string[] = [];

  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    
    // Convert buffer to base64 to pass into the browser
    const pdfBase64 = Buffer.from(buffer).toString('base64');

    // Use a blank page and inject PDF.js (CDN version)
    await page.goto('about:blank');
    await page.addScriptTag({ url: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js' });

    onProgress?.("Motor de renderização PDF.js inicializado.");

    // Render logic inside the browser
    const images = await page.evaluate(async (base64) => {
      // @ts-ignore
      const pdfjsLib = window['pdfjs-dist/build/pdf'];
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

      const loadingTask = pdfjsLib.getDocument({ data: atob(base64) });
      const pdf = await loadingTask.promise;
      const results: string[] = [];

      // Process max 15 pages for complete catalog coverage in demos
      const numPages = Math.min(pdf.numPages, 15);

      for (let i = 1; i <= numPages; i++) {
        const pageObj = await pdf.getPage(i);
        const viewport = pageObj.getViewport({ scale: 3.0 }); 
        
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (!context) continue;

        canvas.height = viewport.height;
        canvas.width = viewport.width;

        await pageObj.render({
          canvasContext: context,
          viewport: viewport
        }).promise;

        results.push(canvas.toDataURL('image/png'));
      }
      return results;
    }, pdfBase64);

    onProgress?.(`${images.length} páginas renderizadas em alta definição.`);

    // Process each rendered image
    for (let i = 0; i < images.length; i++) {
      onProgress?.(`Analisando página ${i + 1} de ${images.length}...`);
      
      const base64Data = images[i];
      const rawBase64 = base64Data.split(',')[1];
      const optimized = await optimizeImage(Buffer.from(rawBase64, 'base64'));
      
      allImages.push(optimized);

      try {
        const data = await extractFromImage(optimized, i);
        const validated = EncarteSchema.safeParse(data);
        
        if (validated.success) {
          allProducts.push(...validated.data.products);
          console.log(`[Service] Extracted ${validated.data.products.length} items from page ${i+1}`);
          onProgress?.(`Sucesso: ${validated.data.products.length} ofertas extraídas da página ${i + 1}.`);
        }
      } catch (e) {
        onProgress?.(`Erro na página ${i + 1}. Pulando...`);
      }
    }

  } finally {
    await browser.close().catch(() => {});
  }

  return {
    products: allProducts,
    meta: {
      isMock: false,
      source: 'gpt4o_pdfjs_browser_sharp',
      imageUrl: allImages[0] || "https://via.placeholder.com/800",
      images: allImages
    }
  };
}

export async function crawlUrl(url: string, onProgress?: (msg: string) => void) {
  console.log(`[Crawler] Visiting ${url}`);
  onProgress?.(`Visitando URL: ${url}`);
  
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    onProgress?.("Página carregada. Buscando encartes...");
    
    let pdfUrl: string | null = null;
    
    if (url.endsWith('.pdf')) {
        pdfUrl = url;
    } else {
        const anchors = await page.$$('a[href$=".pdf"]');
        if (anchors.length > 0) {
            pdfUrl = await anchors[0].getAttribute('href');
        }
        
        if (pdfUrl && !pdfUrl.startsWith('http')) {
            pdfUrl = new URL(pdfUrl, url).toString();
        }
    }

    if (pdfUrl) {
        onProgress?.(`PDF localizado: ${pdfUrl}. Iniciando download...`);
        const response = await page.request.get(pdfUrl);
        const buffer = await response.body();
        await browser.close();
        return processPdfBuffer(buffer, pdfUrl, onProgress);
    } 
    
    onProgress?.("Nenhum PDF encontrado. Capturando página inteira...");
    const screenshot = await page.screenshot({ fullPage: true, type: 'jpeg', quality: 50 });
    onProgress?.("Screenshot capturado. Iniciando Vision Pipeline...");
    
    const base64 = await optimizeImage(screenshot);
    const data = await extractFromImage(base64, 0);
    await browser.close();
    
    const validated = EncarteSchema.safeParse(data);
    const products = validated.success ? validated.data.products : [];

    onProgress?.(`Extração concluída: ${products.length} ofertas encontradas.`);

    return {
        products,
        meta: { isMock: false, source: 'gpt4o_screenshot', imageUrl: base64, images: [base64] }
    };

  } catch (error) {
    onProgress?.(`Erro: ${error instanceof Error ? error.message : "Desconhecido"}`);
    await browser.close().catch(() => {});
    throw error;
  }
}
