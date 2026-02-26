import { View, Text, Dimensions, Pressable } from 'react-native';
import { useState } from 'react';
import { TrendingDown, TrendingUp, Minus, Clock } from 'lucide-react-native';
import { usePriceHistory } from '@/hooks/use-price-history';
import { Colors } from '@/constants/colors';

interface PriceChartProps {
  productId: string;
  productName: string;
}

const PERIODS: { label: string; days: 30 | 60 | 90 }[] = [
  { label: '30d', days: 30 },
  { label: '60d', days: 60 },
  { label: '90d', days: 90 },
];

export function PriceChart({ productId, productName }: PriceChartProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<30 | 60 | 90>(30);
  const { dataPoints, trend, isLoading } = usePriceHistory(productId, selectedPeriod);

  const screenWidth = Dimensions.get('window').width - 40;

  if (isLoading) {
    return (
      <View className="bg-surface-tertiary rounded-2xl p-4 h-48 items-center justify-center">
        <Text className="text-sm text-text-tertiary">Carregando historico...</Text>
      </View>
    );
  }

  if (dataPoints.length === 0) {
    return (
      <View className="bg-surface-tertiary rounded-2xl p-4 h-48 items-center justify-center">
        <Clock size={24} color={Colors.text.tertiary} />
        <Text className="text-sm text-text-tertiary mt-2">
          Sem dados de historico para este periodo
        </Text>
      </View>
    );
  }

  const minPrice = Math.min(...dataPoints.map((p) => p.min_promo_price));
  const maxPrice = Math.max(...dataPoints.map((p) => p.min_promo_price));
  const range = maxPrice - minPrice || 1;
  const currentPrice = dataPoints[dataPoints.length - 1].min_promo_price;

  const TrendIcon =
    trend.direction === 'up'
      ? TrendingUp
      : trend.direction === 'down'
        ? TrendingDown
        : Minus;

  const trendColor =
    trend.direction === 'down'
      ? Colors.semantic.success
      : trend.direction === 'up'
        ? Colors.semantic.error
        : Colors.text.tertiary;

  return (
    <View className="bg-surface-tertiary rounded-2xl p-4">
      <Text className="text-base font-bold text-text-primary">{productName}</Text>

      {/* Period selector */}
      <View className="flex-row gap-2 mt-3">
        {PERIODS.map((p) => (
          <Pressable
            key={p.days}
            onPress={() => setSelectedPeriod(p.days)}
            className={`px-3 py-1.5 rounded-full ${
              selectedPeriod === p.days
                ? 'bg-brand-green'
                : 'bg-white border border-border'
            }`}
          >
            <Text
              className={`text-xs font-semibold ${
                selectedPeriod === p.days ? 'text-white' : 'text-text-secondary'
              }`}
            >
              {p.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Simple sparkline */}
      <View className="h-24 mt-4 flex-row items-end gap-0.5">
        {dataPoints.map((point, i) => {
          const height = ((point.min_promo_price - minPrice) / range) * 80 + 8;
          const isLast = i === dataPoints.length - 1;
          return (
            <View
              key={point.date}
              className={`flex-1 rounded-t ${isLast ? 'bg-brand-green' : 'bg-brand-green/30'}`}
              style={{ height }}
            />
          );
        })}
      </View>

      {/* Price info */}
      <View className="flex-row items-center justify-between mt-3">
        <View>
          <Text className="text-xs text-text-tertiary">Preco atual</Text>
          <Text className="text-lg font-bold text-text-primary">
            R$ {currentPrice.toFixed(2)}
          </Text>
        </View>

        <View className="flex-row items-center gap-1">
          <TrendIcon size={16} color={trendColor} />
          <Text style={{ color: trendColor }} className="text-sm font-semibold">
            {trend.changePercent > 0 ? '+' : ''}
            {trend.changePercent}%
          </Text>
        </View>

        <View>
          <Text className="text-xs text-text-tertiary">Menor preco</Text>
          <Text className="text-sm font-bold text-semantic-success">
            R$ {minPrice.toFixed(2)}
          </Text>
        </View>
      </View>

      {/* Best time to buy indicator */}
      {trend.bestTimeToBuy && (
        <View className="bg-semantic-success/10 rounded-lg px-3 py-2 mt-3">
          <Text className="text-xs font-semibold text-semantic-success text-center">
            Bom momento para comprar — preco proximo da minima
          </Text>
        </View>
      )}
    </View>
  );
}
