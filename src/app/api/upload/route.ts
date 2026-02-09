import { NextResponse } from "next/server";
import { processPdfBuffer } from "@/lib/crawler/service";
import mockSavegnago from "@/data/mocks/mock_savegnago.json";

interface ProgressEvent {
  type: "progress";
  message: string;
}

interface DoneEvent {
  type: "done";
  data: unknown;
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
  return "Internal Server Error";
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "File is required" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const send = (data: StreamEvent) => {
          controller.enqueue(encoder.encode(`${JSON.stringify(data)}\n`));
        };

        try {
          const result = await processPdfBuffer(buffer, file.name, (message) => {
            send({ type: "progress", message });
          });

          send({ type: "done", data: result });
        } catch (error) {
          send({ type: "progress", message: `Falha no processamento real. Ativando fallback mock: ${resolveErrorMessage(error)}` });
          send({
            type: "done",
            data: {
              ...mockSavegnago,
              meta: {
                isMock: true,
                source: "upload_error_fallback",
                imageUrl: "https://via.placeholder.com/800",
                images: ["https://via.placeholder.com/800"],
              },
            },
          });
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
