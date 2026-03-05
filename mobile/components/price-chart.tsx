import { View, Text, Pressable, type LayoutChangeEvent } from 'react-native';
import { useState, useMemo } from 'react';
import { TrendingDown, TrendingUp, Minus, Clock } from 'lucide-react-native';
import Svg, {
  Polyline,
  Circle,
  Text as SvgText,
  Line,
} from 'react-native-svg';
import { usePriceHistory } from '@/hooks/use-price-history';
import { useTheme } from '@/theme/use-theme';

interface PriceChartProps {
  productId: string;
  productName: string;
}

const PERIODS: { label: string; days: 30 | 60 | 90 }[] = [
  { label: '30d', days: 30 },
  { label: '60d', days: 60 },
  { label: '90d', days: 90 },
];

const CHART_HEIGHT = 120;
const CHART_PADDING_Y = 10;
const CHART_USABLE_HEIGHT = CHART_HEIGHT - CHART_PADDING_Y * 2;

export function PriceChart({ productId, productName }: PriceChartProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<30 | 60 | 90>(30);
  const [chartWidth, setChartWidth] = useState(0);
  const { dataPoints, trend, isLoading } = usePriceHistory(productId, selectedPeriod);
  const { tokens } = useTheme();

  const handleLayout = (event: LayoutChangeEvent) => {
    setChartWidth(event.nativeEvent.layout.width);
  };

  // -- Loading state --
  if (isLoading) {
    return (
      <View
        style={{ backgroundColor: tokens.surface }}
        className="rounded-2xl p-4 h-48 items-center justify-center"
      >
        <Text style={{ color: tokens.textHint }} className="text-sm">
          Carregando histórico...
        </Text>
      </View>
    );
  }

  // -- Empty state --
  if (dataPoints.length === 0) {
    return (
      <View
        style={{ backgroundColor: tokens.surface }}
        className="rounded-2xl p-4 h-48 items-center justify-center"
      >
        <Clock size={24} color={tokens.textHint} />
        <Text style={{ color: tokens.textHint }} className="text-sm mt-2">
          Sem dados de histórico para este período
        </Text>
      </View>
    );
  }

  // -- Insufficient data state --
  if (dataPoints.length < 2) {
    return (
      <View
        style={{ backgroundColor: tokens.surface }}
        className="rounded-2xl p-4 h-48 items-center justify-center"
      >
        <Clock size={24} color={tokens.textHint} />
        <Text style={{ color: tokens.textHint }} className="text-sm mt-2">
          Dados insuficientes para exibir o gráfico
        </Text>
      </View>
    );
  }

  return (
    <PriceChartContent
      productName={productName}
      dataPoints={dataPoints}
      trend={trend}
      selectedPeriod={selectedPeriod}
      setSelectedPeriod={setSelectedPeriod}
      chartWidth={chartWidth}
      onLayout={handleLayout}
      tokens={tokens}
    />
  );
}

// ---------------------------------------------------------------------------
// Inner content component — keeps the main component readable and avoids
// hooks after early returns.
// ---------------------------------------------------------------------------

interface ContentProps {
  productName: string;
  dataPoints: {
    date: string;
    min_promo_price: number;
    avg_promo_price: number;
    store_count: number;
    reference_price: number | null;
  }[];
  trend: { direction: 'up' | 'down' | 'stable'; changePercent: number; bestTimeToBuy: boolean };
  selectedPeriod: 30 | 60 | 90;
  setSelectedPeriod: (p: 30 | 60 | 90) => void;
  chartWidth: number;
  onLayout: (e: LayoutChangeEvent) => void;
  tokens: ReturnType<typeof useTheme>['tokens'];
}

function PriceChartContent({
  productName,
  dataPoints,
  trend,
  selectedPeriod,
  setSelectedPeriod,
  chartWidth,
  onLayout,
  tokens,
}: ContentProps) {
  const prices = dataPoints.map((p) => p.min_promo_price);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const range = maxPrice - minPrice || 1;
  const currentPrice = prices[prices.length - 1];
  const avgPrice = prices.reduce((s, v) => s + v, 0) / prices.length;

  // Index of the minimum-price data point
  const minIndex = prices.indexOf(minPrice);
  const lastIndex = dataPoints.length - 1;

  // Map data points to SVG coordinates
  const points = useMemo(() => {
    if (chartWidth <= 0 || dataPoints.length < 2) return [];

    const stepX = chartWidth / (dataPoints.length - 1);

    return dataPoints.map((dp, i) => {
      const x = i * stepX;
      const y =
        CHART_PADDING_Y +
        (1 - (dp.min_promo_price - minPrice) / range) * CHART_USABLE_HEIGHT;
      return { x, y, price: dp.min_promo_price };
    });
  }, [chartWidth, dataPoints, minPrice, range]);

  // Average price y-coordinate for reference line
  const avgY =
    CHART_PADDING_Y +
    (1 - (avgPrice - minPrice) / range) * CHART_USABLE_HEIGHT;

  // Polyline points string
  const polylinePoints = points.map((p) => `${p.x},${p.y}`).join(' ');

  // Week labels
  const weekLabels = dataPoints.map((_, i) => `S${i + 1}`);

  const TrendIcon =
    trend.direction === 'up'
      ? TrendingUp
      : trend.direction === 'down'
        ? TrendingDown
        : Minus;

  const trendColor =
    trend.direction === 'down'
      ? tokens.primary
      : trend.direction === 'up'
        ? tokens.discountRed
        : tokens.textHint;

  return (
    <View style={{ backgroundColor: tokens.surface }} className="rounded-2xl p-4">
      <Text style={{ color: tokens.textPrimary }} className="text-base font-bold">
        {productName}
      </Text>

      {/* Period selector */}
      <View className="flex-row gap-2 mt-3">
        {PERIODS.map((p) => (
          <Pressable
            key={p.days}
            onPress={() => setSelectedPeriod(p.days)}
            style={{
              backgroundColor:
                selectedPeriod === p.days ? tokens.primary : tokens.surface,
              borderColor: selectedPeriod === p.days ? tokens.primary : tokens.border,
              borderWidth: 1,
            }}
            className="px-3 py-1.5 rounded-full"
          >
            <Text
              style={{
                color:
                  selectedPeriod === p.days ? '#FFFFFF' : tokens.textSecondary,
              }}
              className="text-xs font-semibold"
            >
              {p.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* SVG line chart */}
      <View className="mt-4" onLayout={onLayout}>
        {chartWidth > 0 && points.length >= 2 && (
          <Svg width={chartWidth} height={CHART_HEIGHT}>
            {/* Horizontal dashed average reference line */}
            <Line
              x1={0}
              y1={avgY}
              x2={chartWidth}
              y2={avgY}
              stroke={tokens.border}
              strokeWidth={1}
              strokeDasharray="4,4"
            />

            {/* Main polyline */}
            <Polyline
              points={polylinePoints}
              fill="none"
              stroke={tokens.primary}
              strokeWidth={2}
            />

            {/* Small circles for each data point */}
            {points.map((pt, i) => (
              <Circle
                key={i}
                cx={pt.x}
                cy={pt.y}
                r={3}
                fill={tokens.primary}
              />
            ))}

            {/* MIN price marker (larger, red) */}
            <Circle
              cx={points[minIndex].x}
              cy={points[minIndex].y}
              r={5}
              fill={tokens.discountRed}
            />
            <SvgText
              x={points[minIndex].x}
              y={points[minIndex].y - 10}
              fontSize={10}
              fill={tokens.discountRed}
              textAnchor="middle"
              fontWeight="bold"
            >
              R${minPrice.toFixed(2)}
            </SvgText>

            {/* CURRENT (last) price marker (larger, dark) */}
            {lastIndex !== minIndex && (
              <>
                <Circle
                  cx={points[lastIndex].x}
                  cy={points[lastIndex].y}
                  r={5}
                  fill={tokens.dark}
                />
                <SvgText
                  x={points[lastIndex].x}
                  y={points[lastIndex].y - 10}
                  fontSize={10}
                  fill={tokens.dark}
                  textAnchor="middle"
                  fontWeight="bold"
                >
                  R${currentPrice.toFixed(2)}
                </SvgText>
              </>
            )}

            {/* If min and last are the same index, show a single combined marker */}
            {lastIndex === minIndex && (
              <SvgText
                x={points[lastIndex].x}
                y={points[lastIndex].y - 10}
                fontSize={10}
                fill={tokens.discountRed}
                textAnchor="middle"
                fontWeight="bold"
              >
                R${currentPrice.toFixed(2)}
              </SvgText>
            )}

            {/* Week labels along x-axis */}
            {points.map((pt, i) => (
              <SvgText
                key={`label-${i}`}
                x={pt.x}
                y={CHART_HEIGHT}
                fontSize={10}
                fill={tokens.textHint}
                textAnchor="middle"
              >
                {weekLabels[i]}
              </SvgText>
            ))}
          </Svg>
        )}
      </View>

      {/* Price info */}
      <View className="flex-row items-center justify-between mt-3">
        <View>
          <Text style={{ color: tokens.textHint }} className="text-xs">
            Preço atual
          </Text>
          <Text style={{ color: tokens.textPrimary }} className="text-lg font-bold">
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
          <Text style={{ color: tokens.textHint }} className="text-xs">
            Menor preço
          </Text>
          <Text style={{ color: tokens.discountRed }} className="text-sm font-bold">
            R$ {minPrice.toFixed(2)}
          </Text>
        </View>
      </View>

      {/* Best time to buy banner */}
      {trend.bestTimeToBuy && (
        <View
          style={{ backgroundColor: tokens.primaryLight }}
          className="rounded-lg px-3 py-2 mt-3"
        >
          <Text
            style={{ color: tokens.primary }}
            className="text-xs font-semibold text-center"
          >
            Bom momento para comprar {'\u2014'} pre\u00E7o pr\u00F3ximo da m\u00EDnima
          </Text>
        </View>
      )}
    </View>
  );
}
