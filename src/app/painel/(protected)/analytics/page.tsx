"use client";

import { SectionHeader } from "@/features/panel/components/section-header";
import { usePanelSession } from "@/features/panel/panel-session-context";
import { mockMarkets } from "@/features/shared/mock-data";

const weeklyData = [42, 56, 61, 58, 74, 80, 77];

export default function MarketAnalyticsPage() {
  const session = usePanelSession();
  const market = mockMarkets.find((entry) => entry.id === session.currentMarketId) ?? mockMarkets[0];
  const peak = Math.max(...weeklyData);

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Analytics"
        subtitle={`Leitura de performance do mercado ${market.name}.`}
      />

      <section className="rounded-2xl border border-[var(--color-line)] bg-white p-5 shadow-[var(--shadow-soft)]">
        <h2 className="text-lg font-semibold text-[var(--color-ink)]">Engajamento semanal (mock)</h2>
        <p className="mt-1 text-sm text-[var(--color-muted)]">Comparativo de cliques em ofertas por dia.</p>

        <div className="mt-6 grid grid-cols-7 items-end gap-2">
          {weeklyData.map((value, index) => {
            const height = Math.max(12, Math.round((value / peak) * 140));
            return (
              <div key={`${value}-${index}`} className="flex flex-col items-center gap-2">
                <div className="w-full rounded-md bg-[var(--color-primary-soft)]" style={{ height }} />
                <span className="text-xs text-[var(--color-muted)]">D{index + 1}</span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <article className="rounded-2xl border border-[var(--color-line)] bg-white p-5 shadow-[var(--shadow-soft)]">
          <h3 className="font-semibold text-[var(--color-ink)]">Produtos com melhor resposta</h3>
          <ul className="mt-3 space-y-2 text-sm text-[var(--color-muted)]">
            <li>1. Detergente 500ml · CTR 44%</li>
            <li>2. Arroz 5kg · CTR 38%</li>
            <li>3. Leite 1L · CTR 33%</li>
          </ul>
        </article>

        <article className="rounded-2xl border border-[var(--color-line)] bg-white p-5 shadow-[var(--shadow-soft)]">
          <h3 className="font-semibold text-[var(--color-ink)]">Oportunidades</h3>
          <ul className="mt-3 space-y-2 text-sm text-[var(--color-muted)]">
            <li>- Melhor horário de publicação: 08:00 às 10:00.</li>
            <li>- Categoria Limpeza converte 1.4x mais que média.</li>
            <li>- Ofertas com selo verificado têm +22% de cliques.</li>
          </ul>
        </article>
      </section>
    </div>
  );
}
