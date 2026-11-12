import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { RawSearchRow, RawPriceEntry } from './use-search';
import { loadTrackedSummary, GENERIC_SEARCH_PAGE_SIZE, type TrackedRecordWithProduct } from '@/lib/tracked-summary';

export interface TrackedRow {
  key: string; // tracked_items.id — stable for list keys
  // The resolved product to open on tap ("toque abre a Resposta desse
  // produto", decisões.md's item genérico rule). Null only while a generic
  // item's category search hasn't resolved a winner yet — key is never a
  // valid product route param on its own for those rows.
  productId: string | null;
  name: string;
  size: string | null;
  hasPriceToday: boolean;
  priceLabel: string; // formatted "R$ 24,90", or "—" when hasPriceToday is false
  winnerStoreName: string | null;
}

// Raiz's "Seus itens", read from `tracked_items` (the same table Ajustes
// lists). Item-products price via get_product_prices (what the Resposta
// uses); generic items reuse search_products_with_prices with the category
// label as free-text query, taking pickGenericWinner's result — an
// approximation of decisões.md's "produto vencedor de hoje da
// categoria/tamanho" (it isn't filtered by the item's size).
// Reads the CURRENT session only and never signs in: opening Raiz must not
// create a user.
// `enabled` holds the read until the onboarding sync has settled; `refreshKey`
// re-reads (Raiz bumps it on focus, so a removal in Ajustes shows up).
export function useTrackedSummary(userLat: number, userLng: number, enabled: boolean, refreshKey: number) {
  const [rows, setRows] = useState<TrackedRow[]>([]);
  // Loading is derived from "which request has settled", not a flag set inside
  // the effect: a retry bumps refreshKey and must read as loading in the very
  // render that follows, or Raiz would flash "dia zero" for a frame.
  const requestKey = `${refreshKey}|${userLat}|${userLng}`;
  const [settledKey, setSettledKey] = useState<string | null>(null);
  const [hasError, setHasError] = useState(false);
  const isLoading = !enabled || settledKey !== requestKey;

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    (async () => {
      const result = await loadTrackedSummary({
        async listTracked() {
          const {
            data: { session },
          } = await supabase.auth.getSession();
          if (!session) return null;
          const { data, error } = await supabase
            .from('tracked_items')
            .select('id, product_id, category_label, category_size, products(name, size_value, size_unit)')
            .eq('user_id', session.user.id)
            .order('created_at', { ascending: true });
          if (error) throw error;
          return (data as unknown as TrackedRecordWithProduct[]) ?? [];
        },
        async productPrices(productId) {
          const { data, error } = await supabase.rpc('get_product_prices', { product_id: productId, user_lat: userLat, user_lng: userLng });
          if (error) throw error;
          return (data as RawPriceEntry[] | null) ?? [];
        },
        async genericSearch(label) {
          const { data, error } = await supabase.rpc('search_products_with_prices', {
            query: label,
            user_lat: userLat,
            user_lng: userLng,
            page_size: GENERIC_SEARCH_PAGE_SIZE,
          });
          if (error) throw error;
          return (data as RawSearchRow[] | null) ?? [];
        },
      });
      if (cancelled) return;
      // A failed read keeps whatever was shown instead of falling to "dia zero".
      if (result.ok) setRows(result.rows);
      setHasError(!result.ok);
      setSettledKey(requestKey);
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, refreshKey, userLat, userLng, requestKey]);

  return { rows, isLoading, hasError };
}
