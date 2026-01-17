'use server';

import { crawlUrl, processPdfBuffer } from '@/lib/crawler/service';
import mockSavegnago from '@/data/mocks/mock_savegnago.json';
import { EncarteSchema } from '@/lib/schemas';

// Legacy Action Wrapper for backward compatibility regarding Frontend
export async function crawlOffers(url: string) {
  try {
    return await crawlUrl(url);
  } catch (error) {
    console.error("Crawl error:", error);
    return {
      ...mockSavegnago,
      meta: {
        isMock: true,
        source: 'error_fallback',
        error: String(error),
        imageUrl: "https://via.placeholder.com/800"
      }
    };
  }
}

export async function extractFromPdf(formData: FormData) {
  try {
    const file = formData.get('file') as File;
    if (!file) throw new Error("No file uploaded");
    
    // Server Actions: Convert File to Buffer/ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    return await processPdfBuffer(buffer, file.name);

  } catch (error) {
     console.error("Extract from PDF error:", error);
     return {
      ...mockSavegnago,
       meta: {
         isMock: true,
         source: 'error_fallback',
         error: String(error),
         imageUrl: "https://via.placeholder.com/800"
       }
    };
  }
}
