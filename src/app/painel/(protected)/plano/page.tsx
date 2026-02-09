"use client";

import { SectionHeader } from "@/features/panel/components/section-header";
import { usePanelSession } from "@/features/panel/panel-session-context";
import { mockMarkets } from "@/features/shared/mock-data";

export default function MarketPlanPage() {
  const session = usePanelSession();
  const market = mockMarkets.find((entry) => entry.id === session.currentMarketId) ?? mockMarkets[0];

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Plano e faturamento"
        subtitle="Controle do plano atual e recursos disponíveis para o mercado ativo."
      />

      <section className="grid gap-4 md:grid-cols-2">
        <article className="rounded-2xl border border-[var(--color-line)] bg-white p-5 shadow-[var(--shadow-soft)]">
          <p className="text-xs uppercase tracking-[0.1em] text-[var(--color-muted)]">Plano atual</p>
          <h2 className="mt-2 text-3xl font-semibold text-[var(--color-ink)]">{market.plan}</h2>
          <p className="mt-3 text-sm text-[var(--color-muted)]">
            Renovação em 04/03/2026 · Recursos ativos para impulsionamento de ofertas e analytics.
          </p>
          <button className="mt-5 rounded-xl bg-[var(--color-primary)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--color-primary-deep)]">
            Fazer upgrade
          </button>
        </article>

        <article className="rounded-2xl border border-[var(--color-line)] bg-white p-5 shadow-[var(--shadow-soft)]">
          <h3 className="font-semibold text-[var(--color-ink)]">Recursos disponíveis</h3>
          <ul className="mt-3 space-y-2 text-sm text-[var(--color-muted)]">
            <li>- Importador IA com revisão manual</li>
            <li>- Analytics de campanhas e conversão</li>
            <li>- Alertas de performance em tempo real</li>
            <li>- Destaque em busca de ofertas</li>
          </ul>
        </article>
      </section>
    </div>
  );
}
