import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { ExtractedProduct } from '@/hooks/use-extraction';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

interface PublishResult {
  count: number;
  error?: string;
}

export function usePublishImport() {
  const [isPublishing, setIsPublishing] = useState(false);
  const [result, setResult] = useState<PublishResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const publish = useCallback(async (storeId: string, products: ExtractedProduct[]) => {
    setIsPublishing(true);
    setResult(null);
    setError(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      if (!accessToken) {
        throw new Error('Sessão expirada. Faça login novamente.');
      }

      const response = await fetch(`${API_URL}/api/publish-import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storeId, products, accessToken }),
      });

      const data = (await response.json()) as PublishResult;

      if (!response.ok) {
        throw new Error(data.error ?? `Erro do servidor (${response.status})`);
      }

      setResult(data);
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido';
      setError(message);
      return { count: 0, error: message };
    } finally {
      setIsPublishing(false);
    }
  }, []);

  const reset = useCallback(() => {
    setIsPublishing(false);
    setResult(null);
    setError(null);
  }, []);

  return { isPublishing, result, error, publish, reset };
}
