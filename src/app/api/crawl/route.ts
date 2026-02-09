import { NextResponse } from "next/server";
import { crawlUrl } from "@/lib/crawler/service";
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
    const body = (await request.json()) as { url?: string };

    if (!body.url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }
    const targetUrl = body.url;

    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const send = (data: StreamEvent) => {
          controller.enqueue(encoder.encode(`${JSON.stringify(data)}\n`));
        };

        try {
          const result = await crawlUrl(targetUrl, (message) => {
            send({ type: "progress", message });
          });

          send({ type: "done", data: result });
        } catch (error) {
          send({ type: "progress", message: `Falha no crawler real. Ativando fallback mock: ${resolveErrorMessage(error)}` });
          send({
            type: "done",
            data: {
              ...mockSavegnago,
              meta: {
                isMock: true,
                source: "crawl_error_fallback",
                error: resolveErrorMessage(error),
                imageUrl: "/file.svg",
                images: ["/file.svg"],
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
