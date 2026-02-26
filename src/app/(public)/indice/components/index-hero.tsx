import {
  formatIndexValue,
  formatChangePercent,
  formatPeriodLabel,
  getTrend,
  getTrendColor,
  getTrendBgColor,
  getQualityLabel,
} from "@/lib/index-calculator";
import { TrendingUp, TrendingDown, Minus, Package, Store, Calendar } from "lucide-react";
import type { PriceIndex } from "@/features/shared/types";

interface IndexHeroProps {
  index: PriceIndex;
}

function TrendIcon({ trend }: { trend: "up" | "down" | "stable" }) {
  if (trend === "up") return <TrendingUp className="h-5 w-5" />;
  if (trend === "down") return <TrendingDown className="h-5 w-5" />;
  return <Minus className="h-5 w-5" />;
}

export function IndexHero({ index }: IndexHeroProps) {
  const trend = getTrend(index.momChangePercent);
  const quality = getQualityLabel(index.dataQualityScore);

  return (
    <section className="rounded-3xl border border-[var(--color-line)] bg-white p-8 shadow-[var(--shadow-soft)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.1em] text-[var(--color-muted)]">
            Indice Regional de Precos do Varejo
          </p>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            {index.city}/{index.state} — {formatPeriodLabel(index.periodStart)}
          </p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${quality.bgColor} ${quality.color}`}>
          Qualidade: {quality.label} ({index.dataQualityScore}/100)
        </span>
      </div>

      <div className="mt-6 flex flex-wrap items-end gap-8">
        <div>
          <p className="text-6xl font-semibold tracking-tight text-[var(--color-ink)]">
            {formatIndexValue(index.indexValue)}
          </p>
          <p className="mt-1 text-sm text-[var(--color-muted)]">Base 100 = primeiro mes</p>
        </div>

        <div className="flex flex-wrap gap-4">
          {index.momChangePercent !== null && (
            <div className={`flex items-center gap-2 rounded-xl px-4 py-2.5 ${getTrendBgColor(trend)}`}>
              <TrendIcon trend={trend} />
              <div>
                <p className="text-lg font-semibold">{formatChangePercent(index.momChangePercent)}</p>
                <p className="text-xs opacity-70">vs. mes anterior</p>
              </div>
            </div>
          )}

          {index.yoyChangePercent !== null && (
            <div className={`flex items-center gap-2 rounded-xl px-4 py-2.5 ${getTrendBgColor(getTrend(index.yoyChangePercent))}`}>
              <TrendIcon trend={getTrend(index.yoyChangePercent)} />
              <div>
                <p className="text-lg font-semibold">{formatChangePercent(index.yoyChangePercent)}</p>
                <p className="text-xs opacity-70">vs. mesmo mes ano anterior</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-6 border-t border-[var(--color-line)] pt-4">
        <div className="flex items-center gap-2 text-sm text-[var(--color-muted)]">
          <Package className="h-4 w-4" />
          <span>{index.productCount} produtos analisados</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-[var(--color-muted)]">
          <Store className="h-4 w-4" />
          <span>{index.storeCount} mercados participantes</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-[var(--color-muted)]">
          <Calendar className="h-4 w-4" />
          <span>{index.snapshotCount} pontos de dados</span>
        </div>
      </div>
    </section>
  );
}
