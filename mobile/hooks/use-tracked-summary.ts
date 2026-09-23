import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { OnboardingItem } from '@/lib/onboarding';
import { formatBRL, mapSearchRow, type RawSearchRow, type RawPriceEntry } from './use-search';
import { pickGenericWinner } from '@/lib/raiz';

// Wide enough that the label's actual category products (price-ordered
// within their tier) are reliably present alongside any irrelevant
// ingredient-mention matches ranked ahead of them by price — see
// pickGenericWinner's comment for the concrete case this covers.
const GENERIC_SEARCH_PAGE_SIZE = 15;

export interface TrackedRow {
  key: string; // product id, or the generic label when unpinned — stable for list keys
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

// shortcut: resolves "Seus itens" from onboarding's locally-stored picks
// (lib/onboarding.ts's `poup:onboarding` key) instead of a real
// `tracked_items` table — that table needs Supabase anonymous auth
// (there is no login in the MLP, decisão 9), deferred to Etapa 5
// (Lucas, 2026-09-22). Item-products resolve via get_product_prices (the
// exact product); generic items reuse search_products_with_prices with the
// category label as free-text query, taking its top (best-tier, cheapest)
// result as "today's winning product for the category" — an approximation
// of decisões.md's "produto vencedor de hoje da categoria/tamanho" (it isn't
// filtered by the item's default size), not a real category+size match.
// Upgrade: replace this hook's body with a real tracked_items read once
// Etapa 5 lands; TrackedRow's shape is what Raiz actually renders, so the
// screen itself shouldn't need to change.
export function useTrackedSummary(items: OnboardingItem[], userLat: number, userLng: number) {
  const [rows, setRows] = useState<TrackedRow[]>([]);
  const [isLoading, setIsLoading] = useState(items.length > 0);

  useEffect(() => {
    if (items.length === 0) {
      setRows([]);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    (async () => {
      const resolved = await Promise.all(
        items.map(async (item): Promise<TrackedRow> => {
          if (item.product) {
            const { data } = await supabase.rpc('get_product_prices', {
              product_id: item.product.id,
              user_lat: userLat,
              user_lng: userLng,
            });
            const prices = ((data as RawPriceEntry[] | null) ?? []);
            const winner = prices[0] ?? null;
            return {
              key: item.product.id,
              productId: item.product.id,
              name: item.product.name,
              size: item.product.size,
              hasPriceToday: !!winner,
              priceLabel: winner ? formatBRL(winner.price) : '—',
              winnerStoreName: winner?.store_name ?? null,
            };
          }

          const { data } = await supabase.rpc('search_products_with_prices', {
            query: item.label,
            user_lat: userLat,
            user_lng: userLng,
            page_size: GENERIC_SEARCH_PAGE_SIZE,
          });
          const rawRow = pickGenericWinner((data as RawSearchRow[] | null) ?? [], item.label);
          if (!rawRow) {
            return {
              key: item.label,
              productId: null,
              name: item.label,
              size: item.size,
              hasPriceToday: false,
              priceLabel: '—',
              winnerStoreName: null,
            };
          }
          const result = mapSearchRow(rawRow);
          return {
            key: item.label,
            productId: result.productId,
            name: result.name,
            // Not item.size here: that's the generic default (e.g. "5 kg"
            // for any "Arroz"), and the resolved product is whichever size
            // actually won today — appending the generic default produced
            // "Arroz Branco Camil Tipo 1 1kg · 5 kg" (wrong number, not
            // just redundant) when the winner wasn't the default size.
            // The catalog name is trusted to carry its own size as-is.
            size: null,
            hasPriceToday: result.hasPriceToday,
            priceLabel: result.hasPriceToday && result.price != null ? formatBRL(result.price) : '—',
            winnerStoreName: result.winnerStoreName,
          };
        }),
      );
      if (!cancelled) {
        setRows(resolved);
        setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [items, userLat, userLng]);

  return { rows, isLoading };
}
