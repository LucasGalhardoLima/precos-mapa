import { NextResponse } from "next/server";
import { crawlUrl } from "@/lib/crawler/service";
import { requireApiAuth } from "@/lib/api-auth";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

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
    const { user, error: authError } = await requireApiAuth(request);
    if (authError) return authError;

    const ip = getClientIp(request);
    if (!checkRateLimit(`crawl:${ip}:${user.id}`, 10, 60_000)) {
      return NextResponse.json(
        { error: "Muitas requisições. Tente novamente em instantes." },
        { status: 429 },
      );
    }

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
          const message = resolveErrorMessage(error);
          console.error(`[crawl] Falha ao processar URL "${targetUrl}":`, error);
          send({ type: "error", message: `Falha ao processar URL: ${message}` });
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
