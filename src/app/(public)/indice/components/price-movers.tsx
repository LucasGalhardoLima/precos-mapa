import { formatChangePercent, getTrend, getTrendColor, getTrendBgColor } from "@/lib/index-calculator";
import { formatCurrency } from "@/features/shared/format";
import { TrendingUp, TrendingDown } from "lucide-react";
import type { PriceIndexProduct } from "@/features/shared/types";

interface PriceMoversProps {
  risers: PriceIndexProduct[];
  fallers: PriceIndexProduct[];
}

function MoverTable({
  title,
  subtitle,
  icon,
  items,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  items: PriceIndexProduct[];
}) {
  if (!items.length) {
    return (
      <div className="rounded-3xl border border-[var(--color-line)] bg-white p-6 shadow-[var(--shadow-soft)]">
        <div className="flex items-center gap-2">
          {icon}
          <h3 className="text-base font-semibold text-[var(--color-ink)]">{title}</h3>
        </div>
        <p className="mt-2 text-sm text-[var(--color-muted)]">
          Sem dados suficientes para comparacao mensal.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-[var(--color-line)] bg-white p-6 shadow-[var(--shadow-soft)]">
      <div className="flex items-center gap-2">
        {icon}
        <div>
          <h3 className="text-base font-semibold text-[var(--color-ink)]">{title}</h3>
          <p className="text-xs text-[var(--color-muted)]">{subtitle}</p>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {items.map((item, i) => {
          const trend = getTrend(item.momChangePercent);
          return (
            <div
              key={item.id}
              className="flex items-center justify-between rounded-xl bg-[var(--color-surface)] px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <span className="grid h-6 w-6 place-items-center rounded-full bg-[var(--color-surface-strong)] text-xs font-semibold text-[var(--color-muted)]">
                  {i + 1}
                </span>
                <div>
                  <p className="text-sm font-medium text-[var(--color-ink)]">
                    {item.productName ?? "Produto"}
                  </p>
                  <p className="text-xs text-[var(--color-muted)]">
                    {item.categoryName} — Media {formatCurrency(item.avgPrice)}
                  </p>
                </div>
              </div>
              <span className={`rounded-full px-3 py-1 text-sm font-semibold ${getTrendBgColor(trend)}`}>
                {formatChangePercent(item.momChangePercent)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function PriceMovers({ risers, fallers }: PriceMoversProps) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <MoverTable
        title="Maiores Altas"
        subtitle="Produtos com maior aumento de preco"
        icon={<TrendingUp className="h-5 w-5 text-rose-500" />}
        items={risers}
      />
      <MoverTable
        title="Maiores Quedas"
        subtitle="Produtos com maior reducao de preco"
        icon={<TrendingDown className="h-5 w-5 text-emerald-500" />}
        items={fallers}
      />
    </div>
  );
}
