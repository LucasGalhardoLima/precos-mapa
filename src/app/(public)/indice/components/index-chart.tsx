"use client";

import { formatShortMonth, formatIndexValue } from "@/lib/index-calculator";
import type { PriceIndex } from "@/features/shared/types";

interface IndexChartProps {
  indices: PriceIndex[];
}

export function IndexChart({ indices }: IndexChartProps) {
  if (indices.length < 2) {
    return (
      <section className="rounded-3xl border border-[var(--color-line)] bg-white p-6 shadow-[var(--shadow-soft)]">
        <h2 className="text-lg font-semibold text-[var(--color-ink)]">Evolucao do Indice</h2>
        <p className="mt-2 text-sm text-[var(--color-muted)]">
          Dados insuficientes para gerar grafico. O historico sera exibido apos o segundo mes de publicacao.
        </p>
      </section>
    );
  }

  // Sort chronologically
  const sorted = [...indices].sort(
    (a, b) => new Date(a.periodStart).getTime() - new Date(b.periodStart).getTime(),
  );

  const values = sorted.map((i) => i.indexValue);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const padding = range * 0.15;

  const chartMin = min - padding;
  const chartMax = max + padding;
  const chartRange = chartMax - chartMin;

  const chartHeight = 200;
  const chartWidth = 600;
  const leftPad = 50;
  const rightPad = 20;
  const topPad = 20;
  const bottomPad = 40;
  const drawWidth = chartWidth - leftPad - rightPad;
  const drawHeight = chartHeight - topPad - bottomPad;

  const points = sorted.map((item, i) => {
    const x = leftPad + (i / (sorted.length - 1)) * drawWidth;
    const y = topPad + drawHeight - ((item.indexValue - chartMin) / chartRange) * drawHeight;
    return { x, y, item };
  });

  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");

  // Y-axis ticks
  const yTicks = 5;
  const yTickValues = Array.from({ length: yTicks }, (_, i) =>
    chartMin + (chartRange * i) / (yTicks - 1),
  );

  return (
    <section className="rounded-3xl border border-[var(--color-line)] bg-white p-6 shadow-[var(--shadow-soft)]">
      <h2 className="text-lg font-semibold text-[var(--color-ink)]">Evolucao do Indice (12 meses)</h2>

      <div className="mt-4 overflow-x-auto">
        <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full max-w-[600px]">
          {/* Grid lines */}
          {yTickValues.map((val) => {
            const y = topPad + drawHeight - ((val - chartMin) / chartRange) * drawHeight;
            return (
              <g key={val}>
                <line x1={leftPad} y1={y} x2={chartWidth - rightPad} y2={y} stroke="#e5e7eb" strokeWidth={0.5} />
                <text x={leftPad - 6} y={y + 3} textAnchor="end" fontSize={9} fill="#6b7280">
                  {val.toFixed(1)}
                </text>
              </g>
            );
          })}

          {/* Line */}
          <path d={pathD} fill="none" stroke="var(--color-primary)" strokeWidth={2.5} strokeLinejoin="round" />

          {/* Area under line */}
          <path
            d={`${pathD} L ${points[points.length - 1].x} ${topPad + drawHeight} L ${points[0].x} ${topPad + drawHeight} Z`}
            fill="var(--color-primary-soft)"
            opacity={0.4}
          />

          {/* Data points and labels */}
          {points.map((p) => (
            <g key={p.item.periodStart}>
              <circle cx={p.x} cy={p.y} r={3.5} fill="var(--color-primary)" stroke="white" strokeWidth={2} />
              <text x={p.x} y={topPad + drawHeight + 16} textAnchor="middle" fontSize={8} fill="#6b7280">
                {formatShortMonth(p.item.periodStart)}
              </text>
            </g>
          ))}

          {/* Current value label */}
          {points.length > 0 && (
            <text
              x={points[points.length - 1].x}
              y={points[points.length - 1].y - 10}
              textAnchor="middle"
              fontSize={11}
              fontWeight={600}
              fill="var(--color-ink)"
            >
              {formatIndexValue(points[points.length - 1].item.indexValue)}
            </text>
          )}
        </svg>
      </div>
    </section>
  );
}
