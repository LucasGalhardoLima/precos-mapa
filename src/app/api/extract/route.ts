import { NextResponse } from "next/server";
import OpenAI from "openai";
import { normalizeEncartePayload } from "@/lib/schemas";

function resolveErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return "Extraction failed";
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { url?: string };

    if (!body.url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: "OPENAI_API_KEY não configurada no servidor." }, { status: 500 });
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content:
            "Você é um extrator de dados de OCR. Extraia produtos, preços e datas do encarte e retorne JSON válido com a chave products.",
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Extraia os dados deste encarte." },
            {
              type: "image_url",
              image_url: {
                url: body.url,
              },
            },
          ],
        },
      ],
      response_format: { type: "json_object" },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No content returned from OpenAI");
    }

    const parsed = JSON.parse(content) as unknown;
    const result = normalizeEncartePayload(parsed);

    return NextResponse.json(result);
  } catch (error) {
    const message = resolveErrorMessage(error);
    console.error("[extract] Falha na extração:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
