
import { NextResponse } from 'next/server';
import { crawlUrl } from '@/lib/crawler/service';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { url } = body;

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (data: any) => {
          controller.enqueue(encoder.encode(JSON.stringify(data) + "\n"));
        };

        try {
          const result = await crawlUrl(url, (msg) => {
            send({ type: 'progress', message: msg });
          });
          send({ type: 'done', data: result });
        } catch (error: any) {
          send({ type: 'error', message: error.message || 'Internal Server Error' });
        } finally {
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: { 'Content-Type': 'application/x-ndjson' }
    });

  } catch (error: any) {
    console.error('API Crawl Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
