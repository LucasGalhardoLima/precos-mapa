import { useState, useCallback, useRef } from 'react';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

export interface ExtractedProduct {
  name: string;
  price: number;
  original_price?: number;
  unit: string;
  validity: string | null;
  market_origin?: string;
}

interface NdjsonProgress {
  type: 'progress';
  message: string;
}

interface NdjsonDone {
  type: 'done';
  products: ExtractedProduct[];
}

interface NdjsonError {
  type: 'error';
  message: string;
}

type NdjsonEvent = NdjsonProgress | NdjsonDone | NdjsonError;

export function useExtraction() {
  const [isExtracting, setIsExtracting] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [products, setProducts] = useState<ExtractedProduct[]>([]);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const extractFromImage = useCallback(async (imageUri: string) => {
    setIsExtracting(true);
    setLogs([]);
    setProducts([]);
    setError(null);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const formData = new FormData();
      formData.append('file', {
        uri: imageUri,
        type: 'image/jpeg',
        name: 'encarte.jpg',
      } as unknown as Blob);

      const response = await fetch(`${API_URL}/api/extract-image`, {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      });

      if (!response.ok) {
        const errBody = await response.text();
        let message = `Erro do servidor (${response.status})`;
        try {
          const parsed = JSON.parse(errBody) as { error?: string };
          if (parsed.error) message = parsed.error;
        } catch {
          // ignore parse error
        }
        throw new Error(message);
      }

      // React Native doesn't support ReadableStream — read full text and parse NDJSON
      const text = await response.text();
      const lines = text.split('\n').filter(Boolean);

      for (const line of lines) {
        const event = JSON.parse(line) as NdjsonEvent;

        if (event.type === 'progress') {
          setLogs((prev) => [...prev, event.message]);
        } else if (event.type === 'done') {
          setProducts(event.products);
        } else if (event.type === 'error') {
          throw new Error(event.message);
        }
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      const message = err instanceof Error ? err.message : 'Erro desconhecido';
      setError(message);
    } finally {
      setIsExtracting(false);
      abortRef.current = null;
    }
  }, []);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setIsExtracting(false);
    setLogs([]);
    setProducts([]);
    setError(null);
  }, []);

  return { isExtracting, logs, products, error, extractFromImage, cancel, reset };
}
