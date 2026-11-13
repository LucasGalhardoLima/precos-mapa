import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { RawPriceEntry } from './use-search';
import { nameVariants } from '@/lib/onboarding';
import type { SizedSearchRow } from '@/lib/raiz';
import { loadTrackedSummary, GENERIC_CANDIDATE_LIMIT, type TrackedRecordWithProduct } from '@/lib/tracked-summary';

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
// uses); generic items price every product of the label at the item's size
// the same way and take pickGenericWinner's cheapest fresh one
// (decisões.md's "produto vencedor de hoje da categoria/tamanho").
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
        // Same-size products of the label, read from `products` (the search
        // RPC returns no size and ranks by price behind a page limit, so a
        // 5 kg pack is rarely on its first page), then priced like a
        // item-product so Frescor applies identically.
        async genericSearch(label, size) {
          if (!size) return [];
          const { data, error } = await supabase
            .from('products')
            .select('id, name, brand, image_url, size_value, size_unit')
            .or(nameVariants(label).map((v) => `name.ilike.${v}%`).join(','))
            .eq('size_value', size.value)
            .eq('size_unit', size.unit)
            .order('name')
            .limit(GENERIC_CANDIDATE_LIMIT);
          if (error) throw error;
          return Promise.all(
            (data ?? []).map(async (p): Promise<SizedSearchRow> => {
              const { data: prices, error: pErr } = await supabase.rpc('get_product_prices', { product_id: p.id, user_lat: userLat, user_lng: userLng });
              if (pErr) throw pErr;
              const entries = (prices as RawPriceEntry[] | null) ?? [];
              return {
                product_id: p.id,
                product_name: p.name,
                brand: p.brand,
                image_url: p.image_url,
                has_active_price: entries.length > 0,
                cheapest_price: entries.length > 0 ? Math.min(...entries.map((e) => e.price)) : null,
                prices: entries,
                size_value: p.size_value != null ? Number(p.size_value) : null,
                size_unit: p.size_unit,
              };
            }),
          );
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
