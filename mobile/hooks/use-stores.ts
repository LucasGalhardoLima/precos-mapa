import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { calculateDistanceKm } from '@/hooks/use-location';
import { MATAO_CHAINS } from '@/hooks/use-market-freshness';

export interface NearbyStore {
  storeId: string;
  chainLabel: string; // one of MATAO_CHAINS' labels — what the picker groups by
  storeName: string; // the specific physical location's name (e.g. "Amarelinha Loja 21 Flamboyant")
  distanceKm: number | null;
}

// Rewritten for the MLP (was pre-MLP dead code: promotions joins blocked by
// RLS since migration 072 hid promotions from the consumer app, gamification
// vocabulary out of scope — see Etapa 5 investigation notes). Zero callers
// before this rewrite (confirmed via grep), so no compatibility shim needed.
//
// "os 4 mercados, distâncias, folha 'trocar'" (mobile/CLAUDE.md's own table)
// — one row per CHAIN (not per physical location), nearest location's
// distance when a chain has more than one (Amarelinha). Matches Lucas's own
// framing of the trocar sheet ("folha com os 4 mercados"), not a full
// per-address list.
export function useStores(userLat: number | null, userLng: number | null) {
  const [stores, setStores] = useState<NearbyStore[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    (async () => {
      const results = await Promise.all(
        MATAO_CHAINS.map(async (chain) => {
          let query = supabase.from('stores').select('id, name, latitude, longitude').eq('city', 'Matão').eq('is_active', true);
          query = 'chain' in chain.match ? query.eq('chain', chain.match.chain) : query.eq('name', chain.match.name);
          const { data } = await query;
          if (!data || data.length === 0) return null;

          let nearest = data[0]!;
          let nearestDistance = userLat != null && userLng != null ? calculateDistanceKm(userLat, userLng, nearest.latitude, nearest.longitude) : null;
          for (const s of data.slice(1)) {
            if (userLat == null || userLng == null) continue;
            const d = calculateDistanceKm(userLat, userLng, s.latitude, s.longitude);
            if (nearestDistance == null || d < nearestDistance) {
              nearest = s;
              nearestDistance = d;
            }
          }

          const result: NearbyStore = { storeId: nearest.id, chainLabel: chain.label, storeName: nearest.name, distanceKm: nearestDistance };
          return result;
        }),
      );

      if (!cancelled) {
        setStores(results.filter((r): r is NearbyStore => r != null));
        setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userLat, userLng]);

  return { stores, isLoading };
}
