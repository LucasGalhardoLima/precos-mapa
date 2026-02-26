import type { StoreRankEntry } from "./dashboard-queries";

interface SectionStoreRankingProps {
  data: StoreRankEntry[];
}

export function SectionStoreRanking({ data }: SectionStoreRankingProps) {
  if (data.length === 0) {
    return null;
  }

  return (
    <section className="rounded-2xl border border-[var(--color-line)] bg-white p-5 shadow-[var(--shadow-soft)]">
      <h2 className="text-lg font-semibold text-[var(--color-ink)]">Ranking de Mercados</h2>
      <p className="mt-1 text-sm text-[var(--color-muted)]">Top 10 mercados por volume de ofertas ativas.</p>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[600px] text-left text-sm">
          <thead className="text-xs uppercase tracking-[0.08em] text-[var(--color-muted)]">
            <tr>
              <th className="pb-3 w-8">#</th>
              <th className="pb-3">Mercado</th>
              <th className="pb-3">Cidade</th>
              <th className="pb-3 text-right">Ofertas</th>
              <th className="pb-3 text-right">Desconto medio</th>
              <th className="pb-3 text-right">Categorias</th>
            </tr>
          </thead>
          <tbody>
            {data.map((entry, i) => (
              <tr
                key={`${entry.storeName}-${i}`}
                className={`border-t border-[var(--color-line)] ${i < 3 ? "bg-amber-50" : ""}`}
              >
                <td className="py-3 font-semibold text-[var(--color-muted)]">{i + 1}</td>
                <td className="py-3 font-medium text-[var(--color-ink)]">{entry.storeName}</td>
                <td className="py-3 text-[var(--color-muted)]">
                  {entry.city}/{entry.state}
                </td>
                <td className="py-3 text-right font-medium text-[var(--color-ink)]">{entry.activeOffers}</td>
                <td className="py-3 text-right text-emerald-700">
                  {entry.avgDiscountPercent.toFixed(1).replace(".", ",")}%
                </td>
                <td className="py-3 text-right text-[var(--color-muted)]">{entry.categoryCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
