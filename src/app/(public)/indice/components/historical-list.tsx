import Link from "next/link";
import { formatPeriodLabel, formatIndexValue, formatChangePercent, getTrend, getTrendBgColor } from "@/lib/index-calculator";
import { ChevronRight } from "lucide-react";
import type { PriceIndex } from "@/features/shared/types";

interface HistoricalListProps {
  indices: PriceIndex[];
  currentId?: string;
}

export function HistoricalList({ indices, currentId }: HistoricalListProps) {
  if (indices.length <= 1) return null;

  return (
    <section className="rounded-3xl border border-[var(--color-line)] bg-white p-6 shadow-[var(--shadow-soft)]">
      <h2 className="text-lg font-semibold text-[var(--color-ink)]">Historico de Indices</h2>
      <p className="mt-1 text-sm text-[var(--color-muted)]">
        Indices publicados anteriormente
      </p>

      <div className="mt-4 space-y-2">
        {indices.map((idx) => {
          const isCurrent = idx.id === currentId;
          const trend = getTrend(idx.momChangePercent);
          const monthSlug = idx.periodStart.slice(0, 7); // "2026-01"

          return (
            <Link
              key={idx.id}
              href={`/indice/${monthSlug}`}
              className={`flex items-center justify-between rounded-xl px-4 py-3 transition ${
                isCurrent
                  ? "bg-[var(--color-primary-soft)] border border-[var(--color-primary)]"
                  : "bg-[var(--color-surface)] hover:bg-[var(--color-surface-strong)]"
              }`}
            >
              <div>
                <p className={`text-sm font-medium ${isCurrent ? "text-[var(--color-primary-deep)]" : "text-[var(--color-ink)]"}`}>
                  {formatPeriodLabel(idx.periodStart)}
                </p>
                <p className="text-xs text-[var(--color-muted)]">
                  Indice: {formatIndexValue(idx.indexValue)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${getTrendBgColor(trend)}`}>
                  {formatChangePercent(idx.momChangePercent)}
                </span>
                <ChevronRight className="h-4 w-4 text-[var(--color-muted)]" />
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
