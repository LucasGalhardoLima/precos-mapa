import { SectionHeader } from "@/features/panel/components/section-header";
import { KpiCard } from "@/features/panel/components/kpi-card";
import { mockGlobalComparisons, mockPlatformKpis } from "@/features/shared/mock-data";
import { formatCurrency } from "@/features/shared/format";

export default function SuperDashboardPage() {
  return (
    <div className="space-y-6">
      <SectionHeader
        title="Dashboard Global"
        subtitle="Visão consolidada da plataforma para super admin com troca de contexto por mercado."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {mockPlatformKpis.map((kpi) => (
          <KpiCard key={kpi.id} label={kpi.label} value={kpi.value} helper={kpi.delta} trend={kpi.trend} />
        ))}
      </div>

      <section className="rounded-2xl border border-[var(--color-line)] bg-white p-5 shadow-[var(--shadow-soft)]">
        <h2 className="text-lg font-semibold text-[var(--color-ink)]">Benchmark de preços por produto</h2>
        <p className="mt-1 text-sm text-[var(--color-muted)]">Comparativo entre melhor e pior preço monitorado na plataforma.</p>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[700px] text-left text-sm">
            <thead className="text-xs uppercase tracking-[0.08em] text-[var(--color-muted)]">
              <tr>
                <th className="pb-3">Produto</th>
                <th className="pb-3">Melhor preço</th>
                <th className="pb-3">Mercado</th>
                <th className="pb-3">Pior preço</th>
                <th className="pb-3">Mercado</th>
              </tr>
            </thead>
            <tbody>
              {mockGlobalComparisons.map((item) => (
                <tr key={item.productName} className="border-t border-[var(--color-line)]">
                  <td className="py-3 font-medium text-[var(--color-ink)]">{item.productName}</td>
                  <td className="py-3 text-emerald-700">{formatCurrency(item.bestPrice)}</td>
                  <td className="py-3 text-[var(--color-muted)]">{item.marketWithBestPrice}</td>
                  <td className="py-3 text-rose-700">{formatCurrency(item.worstPrice)}</td>
                  <td className="py-3 text-[var(--color-muted)]">{item.marketWithWorstPrice}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
