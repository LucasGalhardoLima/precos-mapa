import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@precomapa/shared';

interface CompetitorPrice {
  product_id: string;
  product_name: string;
  my_price: number;
  competitor_store_name: string;
  competitor_price: number;
  price_diff_percent: number;
}

interface StoreRanking {
  store_id: string;
  store_name: string;
  active_promotions: number;
  avg_discount: number;
  rank: number;
}

interface CompetitiveData {
  competitorPrices: CompetitorPrice[];
  storeRankings: StoreRanking[];
  myRank: number | null;
  competitivenessScore: number;
  isLoading: boolean;
  isPremium: boolean;
  refresh: () => void;
}

export function useCompetitive(
  storeId: string | null,
  radiusKm: number = 5,
): CompetitiveData {
  const session = useAuthStore((s) => s.session);
  const [competitorPrices, setCompetitorPrices] = useState<CompetitorPrice[]>([]);
  const [storeRankings, setStoreRankings] = useState<StoreRanking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPremium, setIsPremium] = useState(false);

  const fetchData = useCallback(async () => {
    if (!storeId || !session?.user) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    // Check plan
    const { data: store } = await supabase
      .from('stores')
      .select('b2b_plan')
      .eq('id', storeId)
      .single();

    const plan = store?.b2b_plan ?? 'free';
    const profile = useAuthStore.getState().profile;
    const hasPremium =
      profile?.role === 'super_admin' ||
      plan === 'premium' || plan === 'premium_plus' || plan === 'enterprise';
    setIsPremium(hasPremium);

    if (!hasPremium) {
      setIsLoading(false);
      return;
    }

    const [pricesRes, rankingsRes] = await Promise.all([
      supabase.rpc('get_competitor_prices', {
        p_store_id: storeId,
        p_radius_km: radiusKm,
      }),
      supabase.rpc('get_store_rankings', {
        p_store_id: storeId,
        p_radius_km: radiusKm,
      }),
    ]);

    if (pricesRes.data) setCompetitorPrices(pricesRes.data);
    if (rankingsRes.data) setStoreRankings(rankingsRes.data);

    setIsLoading(false);
  }, [storeId, session, radiusKm]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const myRank =
    storeRankings.find((r) => r.store_id === storeId)?.rank ?? null;

  // Competitiveness score: % of products where my price <= competitor avg
  const uniqueProducts = new Map<string, { myPrice: number; competitorPrices: number[] }>();
  for (const cp of competitorPrices) {
    const entry = uniqueProducts.get(cp.product_id) ?? {
      myPrice: cp.my_price,
      competitorPrices: [],
    };
    entry.competitorPrices.push(cp.competitor_price);
    uniqueProducts.set(cp.product_id, entry);
  }

  let competitive = 0;
  let total = 0;
  for (const [, data] of uniqueProducts) {
    const avg =
      data.competitorPrices.reduce((a, b) => a + b, 0) /
      data.competitorPrices.length;
    if (data.myPrice <= avg) competitive++;
    total++;
  }

  const competitivenessScore = total > 0 ? Math.round((competitive / total) * 100) : 0;

  return {
    competitorPrices,
    storeRankings,
    myRank,
    competitivenessScore,
    isLoading,
    isPremium,
    refresh: fetchData,
  };
}
