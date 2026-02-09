"use client";

import Link from "next/link";
import { BellRing, PlusCircle, ScanLine } from "lucide-react";
import { KpiCard } from "@/features/panel/components/kpi-card";
import { SectionHeader } from "@/features/panel/components/section-header";
import { useOffersStore } from "@/features/offers/offers-store";
import { usePanelSession } from "@/features/panel/panel-session-context";
import { mockMarketKpisByMarket, mockMarkets } from "@/features/shared/mock-data";
import { formatCurrency, formatDateLabel } from "@/features/shared/format";

export default function MarketDashboardPage() {
  const session = usePanelSession();
  const { getOffers } = useOffersStore();

  const market = mockMarkets.find((entry) => entry.id === session.currentMarketId) ?? mockMarkets[0];
  const offers = getOffers(market.id);
  const kpis = mockMarketKpisByMarket[market.id] ?? [];

  const dynamicKpis = kpis.map((kpi) => {
    if (kpi.label === "Ofertas ativas") {
      return {
        ...kpi,
        value: String(offers.filter((offer) => offer.status === "ativa").length),
      };
    }
    return kpi;
  });

  return (
    <div className="space-y-6">
      <SectionHeader
        title={`Dashboard ${market.name}`}
        subtitle="Acompanhe performance local, ofertas e resultados de publicação em tempo real (mock)."
        action={
          <div className="flex gap-2">
            <Link
              href="/painel/ofertas/nova"
              className="inline-flex items-center gap-2 rounded-xl border border-[var(--color-line)] bg-white px-3 py-2 text-sm font-medium text-[var(--color-ink)] transition hover:border-[var(--color-primary)]"
            >
              <PlusCircle className="h-4 w-4" />
              Criar oferta
            </Link>
            <Link
              href="/painel/importador-ia"
              className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-primary)] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[var(--color-primary-deep)]"
            >
              <ScanLine className="h-4 w-4" />
              Abrir importador IA
            </Link>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {dynamicKpis.map((kpi) => (
          <KpiCard key={kpi.id} label={kpi.label} value={kpi.value} helper={kpi.helper} trend="up" />
        ))}
      </div>

      <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <article className="rounded-2xl border border-[var(--color-line)] bg-white p-5 shadow-[var(--shadow-soft)]">
          <h2 className="text-lg font-semibold text-[var(--color-ink)]">Ofertas recentes</h2>
          <div className="mt-4 space-y-3">
            {offers.slice(0, 5).map((offer) => (
              <div key={offer.id} className="flex items-center justify-between rounded-xl border border-[var(--color-line)] px-4 py-3">
                <div>
                  <p className="font-medium text-[var(--color-ink)]">{offer.productName}</p>
                  <p className="text-xs text-[var(--color-muted)]">
                    Até {formatDateLabel(offer.validUntil)} · {offer.source === "importador_ia" ? "Importador IA" : "Manual"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xl font-semibold text-[var(--color-primary-deep)]">{formatCurrency(offer.price)}</p>
                  <p className="text-xs text-[var(--color-muted)] line-through">{formatCurrency(offer.listPrice)}</p>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-2xl border border-[var(--color-line)] bg-white p-5 shadow-[var(--shadow-soft)]">
          <h2 className="text-lg font-semibold text-[var(--color-ink)]">Alertas inteligentes</h2>
          <p className="mt-1 text-sm text-[var(--color-muted)]">Insights automáticos para ações rápidas do mercado.</p>

          <div className="mt-4 space-y-3">
            <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
              <p className="font-semibold">Leite Integral perdeu tração</p>
              <p className="mt-1">Cliques caíram 12% nas últimas 48h. Considere ajuste de preço.</p>
            </div>
            <div className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">
              <p className="font-semibold">Oferta de detergente em destaque</p>
              <p className="mt-1">Sua oferta está entre as 3 melhores da cidade e converteu acima da média.</p>
            </div>
          </div>

          <button className="mt-5 inline-flex items-center gap-2 rounded-xl border border-[var(--color-line)] px-3 py-2 text-sm font-medium text-[var(--color-ink)] transition hover:border-[var(--color-primary)]">
            <BellRing className="h-4 w-4" />
            Ajustar alertas
          </button>
        </article>
      </section>
    </div>
  );
}
