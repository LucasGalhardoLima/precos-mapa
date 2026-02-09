import { SectionHeader } from "@/features/panel/components/section-header";
import { mockMarkets } from "@/features/shared/mock-data";
import { formatPercent } from "@/features/shared/format";

export default function SuperMarketsPage() {
  return (
    <div className="space-y-5">
      <SectionHeader
        title="Mercados"
        subtitle="Gestão de contas dos supermercados com status, plano e performance consolidada."
      />

      <div className="overflow-hidden rounded-2xl border border-[var(--color-line)] bg-white shadow-[var(--shadow-soft)]">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="bg-[var(--color-surface-strong)] text-xs uppercase tracking-[0.08em] text-[var(--color-muted)]">
            <tr>
              <th className="px-4 py-3">Mercado</th>
              <th className="px-4 py-3">Plano</th>
              <th className="px-4 py-3">Ofertas ativas</th>
              <th className="px-4 py-3">Views</th>
              <th className="px-4 py-3">Cliques</th>
              <th className="px-4 py-3">Conversão</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {mockMarkets.map((market) => (
              <tr key={market.id} className="border-t border-[var(--color-line)]">
                <td className="px-4 py-3">
                  <p className="font-medium text-[var(--color-ink)]">{market.name}</p>
                  <p className="text-xs text-[var(--color-muted)]">{market.city}/{market.state}</p>
                </td>
                <td className="px-4 py-3 text-[var(--color-muted)]">{market.plan}</td>
                <td className="px-4 py-3 text-[var(--color-ink)]">{market.activeOffers}</td>
                <td className="px-4 py-3 text-[var(--color-muted)]">{market.monthlyViews.toLocaleString("pt-BR")}</td>
                <td className="px-4 py-3 text-[var(--color-muted)]">{market.monthlyClicks.toLocaleString("pt-BR")}</td>
                <td className="px-4 py-3 text-[var(--color-ink)]">{formatPercent(market.conversionRate)}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-semibold ${
                      market.status === "ativo"
                        ? "bg-emerald-100 text-emerald-700"
                        : market.status === "pendente"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-rose-100 text-rose-700"
                    }`}
                  >
                    {market.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
