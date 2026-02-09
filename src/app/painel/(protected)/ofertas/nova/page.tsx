"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { useOffersStore } from "@/features/offers/offers-store";
import { SectionHeader } from "@/features/panel/components/section-header";
import { usePanelSession } from "@/features/panel/panel-session-context";
import { PromotionDraft } from "@/features/shared/types";

const initialDraft: PromotionDraft = {
  productName: "",
  brand: "",
  category: "Mercearia",
  unit: "un",
  price: 0,
  listPrice: 0,
  validUntil: "",
  note: "",
};

export default function NewOfferPage() {
  const [draft, setDraft] = useState<PromotionDraft>(initialDraft);
  const [feedback, setFeedback] = useState<string | null>(null);
  const session = usePanelSession();
  const { createManualOffer } = useOffersStore();
  const router = useRouter();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!draft.productName || draft.price <= 0 || draft.listPrice <= 0 || !draft.validUntil) {
      setFeedback("Preencha produto, preço, preço de referência e validade.");
      return;
    }

    createManualOffer(session.currentMarketId, draft);
    setFeedback("Oferta criada com sucesso no mercado ativo.");
    setDraft(initialDraft);

    setTimeout(() => {
      router.push("/painel/ofertas");
    }, 800);
  }

  return (
    <div className="space-y-5">
      <SectionHeader title="Criar Oferta" subtitle="Cadastro manual de promoções com publicação imediata." />

      <form onSubmit={handleSubmit} className="grid gap-4 rounded-2xl border border-[var(--color-line)] bg-white p-5 shadow-[var(--shadow-soft)] md:grid-cols-2">
        <label className="grid gap-1.5">
          <span className="text-xs font-medium text-[var(--color-muted)]">Produto</span>
          <input
            value={draft.productName}
            onChange={(event) => setDraft((prev) => ({ ...prev, productName: event.target.value }))}
            className="rounded-xl border border-[var(--color-line)] px-3 py-2.5 text-sm focus:border-[var(--color-primary)] focus:outline-none"
            placeholder="Ex: Café Tradicional 500g"
          />
        </label>

        <label className="grid gap-1.5">
          <span className="text-xs font-medium text-[var(--color-muted)]">Marca</span>
          <input
            value={draft.brand}
            onChange={(event) => setDraft((prev) => ({ ...prev, brand: event.target.value }))}
            className="rounded-xl border border-[var(--color-line)] px-3 py-2.5 text-sm focus:border-[var(--color-primary)] focus:outline-none"
            placeholder="Ex: Pilão"
          />
        </label>

        <label className="grid gap-1.5">
          <span className="text-xs font-medium text-[var(--color-muted)]">Categoria</span>
          <input
            value={draft.category}
            onChange={(event) => setDraft((prev) => ({ ...prev, category: event.target.value }))}
            className="rounded-xl border border-[var(--color-line)] px-3 py-2.5 text-sm focus:border-[var(--color-primary)] focus:outline-none"
            placeholder="Ex: Mercearia"
          />
        </label>

        <label className="grid gap-1.5">
          <span className="text-xs font-medium text-[var(--color-muted)]">Unidade</span>
          <select
            value={draft.unit}
            onChange={(event) =>
              setDraft((prev) => ({
                ...prev,
                unit: event.target.value as PromotionDraft["unit"],
              }))
            }
            className="rounded-xl border border-[var(--color-line)] px-3 py-2.5 text-sm focus:border-[var(--color-primary)] focus:outline-none"
          >
            <option value="un">un</option>
            <option value="kg">kg</option>
            <option value="l">l</option>
            <option value="g">g</option>
            <option value="ml">ml</option>
            <option value="pack">pack</option>
          </select>
        </label>

        <label className="grid gap-1.5">
          <span className="text-xs font-medium text-[var(--color-muted)]">Preço da oferta</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={draft.price || ""}
            onChange={(event) => setDraft((prev) => ({ ...prev, price: Number(event.target.value) }))}
            className="rounded-xl border border-[var(--color-line)] px-3 py-2.5 text-sm focus:border-[var(--color-primary)] focus:outline-none"
          />
        </label>

        <label className="grid gap-1.5">
          <span className="text-xs font-medium text-[var(--color-muted)]">Preço de referência</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={draft.listPrice || ""}
            onChange={(event) => setDraft((prev) => ({ ...prev, listPrice: Number(event.target.value) }))}
            className="rounded-xl border border-[var(--color-line)] px-3 py-2.5 text-sm focus:border-[var(--color-primary)] focus:outline-none"
          />
        </label>

        <label className="grid gap-1.5">
          <span className="text-xs font-medium text-[var(--color-muted)]">Válida até</span>
          <input
            type="date"
            value={draft.validUntil}
            onChange={(event) => setDraft((prev) => ({ ...prev, validUntil: event.target.value }))}
            className="rounded-xl border border-[var(--color-line)] px-3 py-2.5 text-sm focus:border-[var(--color-primary)] focus:outline-none"
          />
        </label>

        <label className="grid gap-1.5 md:col-span-2">
          <span className="text-xs font-medium text-[var(--color-muted)]">Observações</span>
          <textarea
            value={draft.note ?? ""}
            onChange={(event) => setDraft((prev) => ({ ...prev, note: event.target.value }))}
            rows={3}
            className="rounded-xl border border-[var(--color-line)] px-3 py-2.5 text-sm focus:border-[var(--color-primary)] focus:outline-none"
            placeholder="Ex: destaque em folheto de fim de semana"
          />
        </label>

        <div className="flex items-center justify-between md:col-span-2">
          <p className="text-sm text-[var(--color-muted)]">Mercado ativo: {session.currentMarketId}</p>
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-primary)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--color-primary-deep)]"
          >
            <Sparkles className="h-4 w-4" />
            Publicar oferta
          </button>
        </div>

        {feedback ? <p className="md:col-span-2 text-sm text-[var(--color-primary-deep)]">{feedback}</p> : null}
      </form>
    </div>
  );
}
