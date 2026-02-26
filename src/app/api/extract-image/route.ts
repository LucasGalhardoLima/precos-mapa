import { NextResponse } from "next/server";
import { optimizeImage, extractFromImage } from "@/lib/crawler/service";
import { normalizeEncartePayload } from "@/lib/schemas";

interface ProgressEvent {
  type: "progress";
  message: string;
}

interface DoneEvent {
  type: "done";
  products: unknown[];
}

interface ErrorEvent {
  type: "error";
  message: string;
}

type StreamEvent = ProgressEvent | DoneEvent | ErrorEvent;

function resolveErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return "Erro desconhecido";
}

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Campo 'file' obrigatório." }, { status: 400 });
    }

    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: `Tipo de arquivo não suportado: ${file.type}. Envie JPEG, PNG ou WebP.` },
        { status: 400 },
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const sizeKb = Math.round(buffer.byteLength / 1024);

    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const send = (data: StreamEvent) => {
          controller.enqueue(encoder.encode(`${JSON.stringify(data)}\n`));
        };

        try {
          send({ type: "progress", message: `Imagem recebida (${sizeKb} KB)` });

          const base64Image = await optimizeImage(buffer);
          send({ type: "progress", message: "Imagem otimizada" });

          send({ type: "progress", message: "Extraindo ofertas com IA..." });
          const rawResult = await extractFromImage(base64Image);

          const normalized = normalizeEncartePayload(rawResult);
          send({
            type: "progress",
            message: `${normalized.products.length} ofertas encontradas`,
          });

          send({ type: "done", products: normalized.products });
        } catch (error) {
          const message = resolveErrorMessage(error);
          console.error("[extract-image] Falha:", error);
          send({ type: "error", message: `Falha na extração: ${message}` });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: { "Content-Type": "application/x-ndjson" },
    });
  } catch (error) {
    const message = resolveErrorMessage(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
