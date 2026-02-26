import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

interface PriceDataPoint {
  date: string;
  min_promo_price: number;
  avg_promo_price: number;
  store_count: number;
  reference_price: number | null;
}

interface TrendAnalysis {
  direction: 'up' | 'down' | 'stable';
  changePercent: number;
  bestTimeToBuy: boolean;
}

interface PriceHistoryData {
  dataPoints: PriceDataPoint[];
  trend: TrendAnalysis;
  isLoading: boolean;
}

export function usePriceHistory(
  productId: string | null,
  days: 30 | 60 | 90 = 30,
): PriceHistoryData {
  const [dataPoints, setDataPoints] = useState<PriceDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchHistory = useCallback(async () => {
    if (!productId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data } = await supabase
      .from('price_snapshots')
      .select('date, min_promo_price, avg_promo_price, store_count, reference_price')
      .eq('product_id', productId)
      .gte('date', startDate.toISOString().slice(0, 10))
      .order('date', { ascending: true });

    if (data) setDataPoints(data);
    setIsLoading(false);
  }, [productId, days]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const trend = computeTrend(dataPoints);

  return { dataPoints, trend, isLoading };
}

function computeTrend(points: PriceDataPoint[]): TrendAnalysis {
  if (points.length < 2) {
    return { direction: 'stable', changePercent: 0, bestTimeToBuy: false };
  }

  const recent = points.slice(-7);
  const older = points.slice(0, Math.min(7, points.length - 7));

  if (recent.length === 0 || older.length === 0) {
    return { direction: 'stable', changePercent: 0, bestTimeToBuy: false };
  }

  const recentAvg =
    recent.reduce((sum, p) => sum + p.min_promo_price, 0) / recent.length;
  const olderAvg =
    older.reduce((sum, p) => sum + p.min_promo_price, 0) / older.length;

  const changePercent =
    olderAvg > 0
      ? Math.round(((recentAvg - olderAvg) / olderAvg) * 100)
      : 0;

  const direction: 'up' | 'down' | 'stable' =
    changePercent > 3 ? 'up' : changePercent < -3 ? 'down' : 'stable';

  // Best time to buy: price is trending down or at local minimum
  const currentMin = points[points.length - 1].min_promo_price;
  const periodMin = Math.min(...points.map((p) => p.min_promo_price));
  const bestTimeToBuy = currentMin <= periodMin * 1.05; // Within 5% of period minimum

  return { direction, changePercent, bestTimeToBuy };
}
