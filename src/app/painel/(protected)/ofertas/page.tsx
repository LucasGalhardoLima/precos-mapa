"use client";

import Link from "next/link";
import { PlusCircle } from "lucide-react";
import { SectionHeader } from "@/features/panel/components/section-header";
import { useOffersStore } from "@/features/offers/offers-store";
import { usePanelSession } from "@/features/panel/panel-session-context";
import { formatCurrency, formatDateLabel } from "@/features/shared/format";

export default function MarketOffersPage() {
  const session = usePanelSession();
  const { getOffers, toggleOfferStatus } = useOffersStore();

  const offers = getOffers(session.currentMarketId);

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Minhas Ofertas"
        subtitle="Gestão das promoções do mercado ativo. Itens importados via IA aparecem automaticamente aqui."
        action={
          <Link
            href="/painel/ofertas/nova"
            className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-primary)] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[var(--color-primary-deep)]"
          >
            <PlusCircle className="h-4 w-4" />
            Nova oferta
          </Link>
        }
      />

      <div className="overflow-hidden rounded-2xl border border-[var(--color-line)] bg-white shadow-[var(--shadow-soft)]">
        <table className="w-full min-w-[780px] text-left text-sm">
          <thead className="bg-[var(--color-surface-strong)] text-xs uppercase tracking-[0.08em] text-[var(--color-muted)]">
            <tr>
              <th className="px-4 py-3">Produto</th>
              <th className="px-4 py-3">Categoria</th>
              <th className="px-4 py-3">Preço</th>
              <th className="px-4 py-3">Validade</th>
              <th className="px-4 py-3">Origem</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {offers.map((offer) => (
              <tr key={offer.id} className="border-t border-[var(--color-line)]">
                <td className="px-4 py-3">
                  <p className="font-medium text-[var(--color-ink)]">{offer.productName}</p>
                  <p className="text-xs text-[var(--color-muted)]">{offer.brand}</p>
                </td>
                <td className="px-4 py-3 text-[var(--color-muted)]">{offer.category}</td>
                <td className="px-4 py-3">
                  <p className="font-semibold text-[var(--color-primary-deep)]">{formatCurrency(offer.price)}</p>
                  <p className="text-xs text-[var(--color-muted)] line-through">{formatCurrency(offer.listPrice)}</p>
                </td>
                <td className="px-4 py-3 text-[var(--color-muted)]">{formatDateLabel(offer.validUntil)}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-1 text-xs font-semibold ${offer.source === "importador_ia" ? "bg-sky-100 text-sky-700" : "bg-zinc-100 text-zinc-700"}`}>
                    {offer.source === "importador_ia" ? "Importador IA" : "Manual"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-1 text-xs font-semibold ${offer.status === "ativa" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                    {offer.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => toggleOfferStatus(session.currentMarketId, offer.id)}
                    className="rounded-lg border border-[var(--color-line)] px-2.5 py-1.5 text-xs font-medium text-[var(--color-muted)] transition hover:border-[var(--color-primary)] hover:text-[var(--color-primary-deep)]"
                  >
                    {offer.status === "ativa" ? "Mover para rascunho" : "Ativar"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
