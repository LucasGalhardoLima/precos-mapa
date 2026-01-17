import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { EncarteSchema } from '@/lib/schemas';
import mockData from '@/data/mock-encarte.json';


const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'dummy',
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { url } = body;

    // Safety Switch / Demo Mode
    if (process.env.DEMO_MODE === 'true' || !process.env.OPENAI_API_KEY) {
       console.log("Using mock data (DEMO_MODE active or missing Key)");
       return NextResponse.json({ ...mockData, meta: { isMock: true } });
    }
    
    // Call OpenAI with json_object
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "Você é um extrator de dados de OCR. Extraia produtos, preços e datas deste encarte. Retorne um JSON válido com a chave 'products'."
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Extraia os dados deste encarte." },
             {
              type: "image_url",
              image_url: {
                url: url,
              },
            },
          ],
        },
      ],
      response_format: { type: "json_object" },
    });

    const content = completion.choices[0].message.content;
    if (!content) throw new Error("No content returned from OpenAI");

    const json = JSON.parse(content);
    
    // Validate with Zod
    const result = EncarteSchema.parse(json);
    
    return NextResponse.json(result);

  } catch (error) {
    console.error("Error extracting data:", error);
    // Fallback on error with specific flag
    return NextResponse.json({ 
      ...mockData, 
      meta: { 
        isMock: true, 
        error: "Extraction failed (API or Parsing), showing mock.",
        details: String(error)
      } 
    });
  }
}
