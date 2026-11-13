// Tap on an "Acompanhar e avisar" push → which screen to open. No I/O of its
// own: the product lookup is injected so this stays unit-testable.
//
// Payload is { productId } (supabase/functions/notify-tracked-price/decide.ts,
// buildMessage). Anything else — no productId, a malformed one, a product that
// no longer exists, or a failed lookup — returns null: the user stays on Raiz,
// with no error. The Resposta screen is never opened for a product we could not
// confirm.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function productIdFromPayload(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const id = (data as { productId?: unknown }).productId;
  return typeof id === 'string' && UUID.test(id) ? id : null;
}

export async function routeForNotification(data: unknown, productExists: (id: string) => Promise<boolean>): Promise<string | null> {
  const id = productIdFromPayload(data);
  if (!id) return null;
  try {
    return (await productExists(id)) ? `/product/${id}` : null;
  } catch {
    return null;
  }
}
