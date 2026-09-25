import { useCallback, useState } from 'react';
import { supabase } from '@/lib/supabase';

export type ScanLookupResult = { status: 'hit'; productId: string } | { status: 'miss' };

// Same catalog products already have (products.ean, migration 030) — no new
// table or RPC. A hit still routes through the normal Resposta price query
// (useProduct), so "EAN conhecido sem preço hoje" is just Resposta's own
// existing "sem preço hoje" state (3d), not something this hook decides.
export function useScanLookup() {
  const [isLooking, setIsLooking] = useState(false);

  const lookup = useCallback(async (ean: string): Promise<ScanLookupResult> => {
    setIsLooking(true);
    const { data } = await supabase.from('products').select('id').eq('ean', ean).maybeSingle();
    setIsLooking(false);
    return data ? { status: 'hit', productId: data.id as string } : { status: 'miss' };
  }, []);

  return { lookup, isLooking };
}
