import { KpiCard } from "@/features/panel/components/kpi-card";
import type { OfferAnalytics } from "./dashboard-queries";

interface SectionOfferAnalyticsProps {
  data: OfferAnalytics;
}

export function SectionOfferAnalytics({ data }: SectionOfferAnalyticsProps) {
  const { avgDiscountPercent, sourceBreakdown, expiringIn48h, categoryBreakdown } = data;

  const sourceSummary = [
    sourceBreakdown.manual > 0 ? `${sourceBreakdown.manual} manual` : null,
    sourceBreakdown.importador_ia > 0 ? `${sourceBreakdown.importador_ia} IA` : null,
    sourceBreakdown.crawler > 0 ? `${sourceBreakdown.crawler} crawler` : null,
  ]
    .filter(Boolean)
    .join(" / ") || "0";

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold text-[var(--color-ink)]">Analise de Ofertas</h2>

      <div className="grid gap-4 md:grid-cols-3">
        <KpiCard
          label="Desconto medio"
          value={`${avgDiscountPercent.toFixed(1).replace(".", ",")}%`}
          helper="sobre preco original"
          trend={avgDiscountPercent >= 15 ? "up" : "stable"}
        />
        <KpiCard
          label="Origem das ofertas"
          value={sourceSummary}
          helper="por fonte de cadastro"
          trend="stable"
        />
        <KpiCard
          label="Expirando em 48h"
          value={String(expiringIn48h)}
          helper="ofertas perto do vencimento"
          trend={expiringIn48h > 10 ? "down" : "stable"}
        />
      </div>

      {categoryBreakdown.length > 0 && (
        <div className="rounded-2xl border border-[var(--color-line)] bg-white p-5 shadow-[var(--shadow-soft)]">
          <h3 className="text-sm font-semibold text-[var(--color-ink)]">Ofertas por Categoria</h3>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.08em] text-[var(--color-muted)]">
                <tr>
                  <th className="pb-3">Categoria</th>
                  <th className="pb-3 text-right">Ofertas</th>
                </tr>
              </thead>
              <tbody>
                {categoryBreakdown.map((cat) => (
                  <tr key={cat.name} className="border-t border-[var(--color-line)]">
                    <td className="py-2.5 font-medium text-[var(--color-ink)]">{cat.name}</td>
                    <td className="py-2.5 text-right text-[var(--color-muted)]">{cat.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
