import Link from "next/link";
import type { RankingRow } from "../engajamento/engajamento-queries";

interface SectionEngagementSummaryProps {
  topProducts: RankingRow[];
  topAreas: RankingRow[];
}

function formatNumber(n: number): string {
  return n.toLocaleString("pt-BR");
}

export function SectionEngagementSummary({ topProducts, topAreas }: SectionEngagementSummaryProps) {
  if (topProducts.length === 0 && topAreas.length === 0) {
    return null;
  }

  return (
    <section className="rounded-2xl border border-[var(--color-line)] bg-white p-5 shadow-[var(--shadow-soft)]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-[var(--color-ink)]">Engajamento (últimos 30 dias)</h2>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            Produtos e áreas com mais interação de usuários no app.
          </p>
        </div>
        <Link
          href="/painel/super/engajamento"
          className="text-sm font-medium text-[var(--color-primary)] hover:underline"
        >
          Ver relatório completo →
        </Link>
      </div>

      <div className="mt-4 grid gap-6 md:grid-cols-2">
        <div>
          <h3 className="text-xs font-medium uppercase tracking-[0.08em] text-[var(--color-muted)]">
            Produtos mais engajados
          </h3>
          {topProducts.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--color-muted)]">Nenhum produto com engajamento no período.</p>
          ) : (
            <ol className="mt-3 space-y-2">
              {topProducts.slice(0, 5).map((row, i) => (
                <li key={row.id} className="flex items-center justify-between text-sm">
                  <span className="text-[var(--color-ink)]">
                    <span className="mr-2 text-[var(--color-muted)]">{i + 1}.</span>
                    {row.label}
                  </span>
                  <span className="font-medium text-[var(--color-ink)]">{formatNumber(row.totalEvents)}</span>
                </li>
              ))}
            </ol>
          )}
        </div>

        <div>
          <h3 className="text-xs font-medium uppercase tracking-[0.08em] text-[var(--color-muted)]">
            Áreas com mais engajamento
          </h3>
          {topAreas.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--color-muted)]">Nenhuma área identificada no período.</p>
          ) : (
            <ol className="mt-3 space-y-2">
              {topAreas.slice(0, 5).map((row, i) => (
                <li key={row.id} className="flex items-center justify-between text-sm">
                  <span className="text-[var(--color-ink)]">
                    <span className="mr-2 text-[var(--color-muted)]">{i + 1}.</span>
                    {row.label}
                  </span>
                  <span className="font-medium text-[var(--color-ink)]">{formatNumber(row.totalEvents)}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </section>
  );
}
