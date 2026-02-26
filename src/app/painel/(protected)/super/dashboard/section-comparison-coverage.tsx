import { KpiCard } from "@/features/panel/components/kpi-card";
import type { ComparisonCoverage } from "./dashboard-queries";

interface SectionComparisonCoverageProps {
  data: ComparisonCoverage;
}

export function SectionComparisonCoverage({ data }: SectionComparisonCoverageProps) {
  const { comparisonReady, totalWithOffers, topCoverage, needingData } = data;
  const percentage = totalWithOffers > 0
    ? ((comparisonReady / totalWithOffers) * 100).toFixed(0)
    : "0";

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold text-[var(--color-ink)]">Cobertura de Comparacao</h2>

      <div className="grid gap-4 md:grid-cols-1 xl:grid-cols-1">
        <KpiCard
          label="Produtos comparaveis"
          value={`${comparisonReady} de ${totalWithOffers}`}
          helper={`${percentage}% dos produtos com ofertas tem 2+ mercados`}
          trend={comparisonReady > totalWithOffers * 0.5 ? "up" : "stable"}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Best coverage */}
        <div className="rounded-2xl border border-[var(--color-line)] bg-white p-5 shadow-[var(--shadow-soft)]">
          <h3 className="text-sm font-semibold text-[var(--color-ink)]">Melhor cobertura</h3>
          <p className="mt-1 text-xs text-[var(--color-muted)]">Produtos com mais mercados monitorados</p>
          {topCoverage.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--color-muted)]">Sem dados.</p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-[0.08em] text-[var(--color-muted)]">
                  <tr>
                    <th className="pb-2">Produto</th>
                    <th className="pb-2 text-right">Mercados</th>
                  </tr>
                </thead>
                <tbody>
                  {topCoverage.map((item) => (
                    <tr key={item.productName} className="border-t border-[var(--color-line)]">
                      <td className="py-2 font-medium text-[var(--color-ink)]">{item.productName}</td>
                      <td className="py-2 text-right text-emerald-700 font-semibold">{item.storeCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Needing data */}
        <div className="rounded-2xl border border-[var(--color-line)] bg-white p-5 shadow-[var(--shadow-soft)]">
          <h3 className="text-sm font-semibold text-[var(--color-ink)]">Precisam de dados</h3>
          <p className="mt-1 text-xs text-[var(--color-muted)]">Produtos com apenas 1 mercado monitorado</p>
          {needingData.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--color-muted)]">Todos os produtos tem 2+ mercados.</p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-[0.08em] text-[var(--color-muted)]">
                  <tr>
                    <th className="pb-2">Produto</th>
                    <th className="pb-2 text-right">Mercados</th>
                  </tr>
                </thead>
                <tbody>
                  {needingData.map((item) => (
                    <tr key={item.productName} className="border-t border-[var(--color-line)]">
                      <td className="py-2 font-medium text-[var(--color-ink)]">{item.productName}</td>
                      <td className="py-2 text-right text-amber-600 font-semibold">{item.storeCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
