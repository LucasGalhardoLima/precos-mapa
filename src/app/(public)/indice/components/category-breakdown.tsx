import { formatChangePercent, getTrend, getTrendColor } from "@/lib/index-calculator";
import { formatCurrency } from "@/features/shared/format";
import type { PriceIndexCategory } from "@/features/shared/types";

interface CategoryBreakdownProps {
  categories: PriceIndexCategory[];
}

export function CategoryBreakdown({ categories }: CategoryBreakdownProps) {
  const sorted = [...categories].sort((a, b) => b.weight - a.weight);

  return (
    <section className="rounded-3xl border border-[var(--color-line)] bg-white p-6 shadow-[var(--shadow-soft)]">
      <h2 className="text-lg font-semibold text-[var(--color-ink)]">Detalhamento por Categoria</h2>
      <p className="mt-1 text-sm text-[var(--color-muted)]">
        Variacao de precos por categoria de produtos no periodo
      </p>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--color-line)]">
              <th className="py-3 text-left font-medium text-[var(--color-muted)]">Categoria</th>
              <th className="py-3 text-right font-medium text-[var(--color-muted)]">Preco Medio</th>
              <th className="py-3 text-right font-medium text-[var(--color-muted)]">Min</th>
              <th className="py-3 text-right font-medium text-[var(--color-muted)]">Max</th>
              <th className="py-3 text-right font-medium text-[var(--color-muted)]">Variacao</th>
              <th className="py-3 text-right font-medium text-[var(--color-muted)]">Peso</th>
              <th className="py-3 text-right font-medium text-[var(--color-muted)]">Produtos</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((cat) => {
              const trend = getTrend(cat.momChangePercent);
              return (
                <tr key={cat.id} className="border-b border-[var(--color-line)] last:border-0">
                  <td className="py-3 font-medium text-[var(--color-ink)]">
                    {cat.categoryName ?? cat.categoryId}
                  </td>
                  <td className="py-3 text-right text-[var(--color-ink)]">
                    {formatCurrency(cat.avgPrice)}
                  </td>
                  <td className="py-3 text-right text-[var(--color-muted)]">
                    {formatCurrency(cat.minPrice)}
                  </td>
                  <td className="py-3 text-right text-[var(--color-muted)]">
                    {formatCurrency(cat.maxPrice)}
                  </td>
                  <td className={`py-3 text-right font-semibold ${getTrendColor(trend)}`}>
                    {formatChangePercent(cat.momChangePercent)}
                  </td>
                  <td className="py-3 text-right text-[var(--color-muted)]">
                    {(cat.weight * 100).toFixed(0)}%
                  </td>
                  <td className="py-3 text-right text-[var(--color-muted)]">
                    {cat.productCount}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
