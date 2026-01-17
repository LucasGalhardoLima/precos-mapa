
import { NextResponse } from 'next/server';
import { processPdfBuffer } from '@/lib/crawler/service';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'File is required' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (data: any) => {
          controller.enqueue(encoder.encode(JSON.stringify(data) + "\n"));
        };

        try {
          const result = await processPdfBuffer(buffer, file.name, (msg) => {
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
    console.error('API Upload Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
