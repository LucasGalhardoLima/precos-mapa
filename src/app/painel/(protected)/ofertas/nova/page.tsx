"use client";

import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { SectionHeader } from "@/features/panel/components/section-header";
import { usePanelSession } from "@/features/panel/panel-session-context";
import { createOffer } from "./create-action";

interface OfferDraft {
  productName: string;
  brand: string;
  category: string;
  unit: string;
  price: number;
  listPrice: number;
  validUntil: string;
  note: string;
}

const initialDraft: OfferDraft = {
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
  const [draft, setDraft] = useState<OfferDraft>(initialDraft);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const session = usePanelSession();
  const router = useRouter();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!draft.productName || draft.price <= 0 || draft.listPrice <= 0 || !draft.validUntil) {
      setFeedback("Preencha produto, preco, preco de referencia e validade.");
      return;
    }

    startTransition(async () => {
      const result = await createOffer({
        storeId: session.currentMarketId,
        productName: draft.productName,
        brand: draft.brand,
        category: draft.category,
        unit: draft.unit,
        promoPrice: draft.price,
        originalPrice: draft.listPrice,
        endDate: draft.validUntil,
        note: draft.note,
      });

      if (result.error) {
        setFeedback(result.error);
        return;
      }

      setFeedback("Oferta criada com sucesso!");
      setDraft(initialDraft);

      setTimeout(() => {
        router.push("/painel/ofertas");
      }, 800);
    });
  }

  return (
    <div className="space-y-5">
      <SectionHeader title="Criar Oferta" subtitle="Cadastro manual de promocoes com publicacao imediata." />

      <form onSubmit={handleSubmit} className="grid gap-4 rounded-2xl border border-[var(--color-line)] bg-white p-5 shadow-[var(--shadow-soft)] md:grid-cols-2">
        <label className="grid gap-1.5">
          <span className="text-xs font-medium text-[var(--color-muted)]">Produto</span>
          <input
            value={draft.productName}
            onChange={(event) => setDraft((prev) => ({ ...prev, productName: event.target.value }))}
            className="rounded-xl border border-[var(--color-line)] px-3 py-2.5 text-sm focus:border-[var(--color-primary)] focus:outline-none"
            placeholder="Ex: Cafe Tradicional 500g"
          />
        </label>

        <label className="grid gap-1.5">
          <span className="text-xs font-medium text-[var(--color-muted)]">Marca</span>
          <input
            value={draft.brand}
            onChange={(event) => setDraft((prev) => ({ ...prev, brand: event.target.value }))}
            className="rounded-xl border border-[var(--color-line)] px-3 py-2.5 text-sm focus:border-[var(--color-primary)] focus:outline-none"
            placeholder="Ex: Pilao"
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
            onChange={(event) => setDraft((prev) => ({ ...prev, unit: event.target.value }))}
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
          <span className="text-xs font-medium text-[var(--color-muted)]">Preco da oferta</span>
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
          <span className="text-xs font-medium text-[var(--color-muted)]">Preco de referencia</span>
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
          <span className="text-xs font-medium text-[var(--color-muted)]">Valida ate</span>
          <input
            type="date"
            value={draft.validUntil}
            onChange={(event) => setDraft((prev) => ({ ...prev, validUntil: event.target.value }))}
            className="rounded-xl border border-[var(--color-line)] px-3 py-2.5 text-sm focus:border-[var(--color-primary)] focus:outline-none"
          />
        </label>

        <label className="grid gap-1.5 md:col-span-2">
          <span className="text-xs font-medium text-[var(--color-muted)]">Observacoes</span>
          <textarea
            value={draft.note}
            onChange={(event) => setDraft((prev) => ({ ...prev, note: event.target.value }))}
            rows={3}
            className="rounded-xl border border-[var(--color-line)] px-3 py-2.5 text-sm focus:border-[var(--color-primary)] focus:outline-none"
            placeholder="Ex: destaque em folheto de fim de semana"
          />
        </label>

        <div className="flex items-center justify-end md:col-span-2">
          <button
            type="submit"
            disabled={isPending}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[var(--color-primary)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--color-primary-deep)] disabled:opacity-50"
          >
            <Sparkles className="h-4 w-4" />
            {isPending ? "Publicando..." : "Publicar oferta"}
          </button>
        </div>

        {feedback ? (
          <p className="text-sm text-[var(--color-primary-deep)] md:col-span-2">{feedback}</p>
        ) : null}
      </form>
    </div>
  );
}
