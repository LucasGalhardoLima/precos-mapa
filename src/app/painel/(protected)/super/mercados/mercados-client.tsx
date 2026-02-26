"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, MapPin, Pencil, Plus, Trash2, X } from "lucide-react";
import { createStoreAction, updateStoreAction, deleteStoreAction } from "./store-actions";
import type { MarketRow } from "./page";

const PLAN_OPTIONS = [
  { value: "free", label: "Free" },
  { value: "premium", label: "Premium" },
  { value: "premium_plus", label: "Premium+" },
  { value: "enterprise", label: "Enterprise" },
] as const;

interface FormState {
  name: string;
  address: string;
  city: string;
  state: string;
  is_active: boolean;
  b2b_plan: string;
}

const emptyForm: FormState = {
  name: "",
  address: "",
  city: "",
  state: "SP",
  is_active: true,
  b2b_plan: "free",
};

export function MercadosClient({ markets }: { markets: MarketRow[] }) {
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setShowCreate(true);
    setFeedback(null);
  }

  function openEdit(market: MarketRow) {
    setShowCreate(false);
    setEditingId(market.id);
    setForm({
      name: market.name,
      address: market.address,
      city: market.city,
      state: market.state,
      is_active: market.is_active,
      b2b_plan: market.b2b_plan,
    });
    setFeedback(null);
  }

  function closeForm() {
    setShowCreate(false);
    setEditingId(null);
    setFeedback(null);
  }

  async function handleCreate() {
    setLoading(true);
    setFeedback(null);
    const result = await createStoreAction({
      name: form.name,
      address: form.address,
      city: form.city,
      state: form.state,
    });
    setLoading(false);

    if (result.error) {
      setFeedback(result.error);
      return;
    }

    closeForm();
  }

  async function handleUpdate() {
    if (!editingId) return;
    setLoading(true);
    setFeedback(null);
    const result = await updateStoreAction({
      id: editingId,
      name: form.name,
      address: form.address,
      city: form.city,
      state: form.state,
      is_active: form.is_active,
      b2b_plan: form.b2b_plan,
    });
    setLoading(false);

    if (result.error) {
      setFeedback(result.error);
      return;
    }

    closeForm();
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Deseja realmente excluir/desativar "${name}"?`)) return;
    setLoading(true);
    setFeedback(null);
    const result = await deleteStoreAction({ id });
    setLoading(false);

    if (result.error) {
      setFeedback(result.error);
    }
  }

  function isGeocoded(lat: number, lng: number) {
    return lat !== 0 || lng !== 0;
  }

  const formUI = (
    <div className="space-y-3 rounded-2xl border border-[var(--color-line)] bg-white p-5 shadow-[var(--shadow-soft)]">
      <p className="text-sm font-semibold text-[var(--color-ink)]">
        {editingId ? "Editar mercado" : "Novo mercado"}
      </p>

      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--color-muted)]">Nome</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full rounded-lg border border-[var(--color-line)] px-3 py-2 text-sm focus:border-[var(--color-primary)] focus:outline-none"
            placeholder="Nome do mercado"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--color-muted)]">Endereco</label>
          <input
            type="text"
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            className="w-full rounded-lg border border-[var(--color-line)] px-3 py-2 text-sm focus:border-[var(--color-primary)] focus:outline-none"
            placeholder="Rua, numero, bairro"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--color-muted)]">Cidade</label>
          <input
            type="text"
            value={form.city}
            onChange={(e) => setForm({ ...form, city: e.target.value })}
            className="w-full rounded-lg border border-[var(--color-line)] px-3 py-2 text-sm focus:border-[var(--color-primary)] focus:outline-none"
            placeholder="Cidade"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--color-muted)]">UF</label>
          <input
            type="text"
            value={form.state}
            onChange={(e) => setForm({ ...form, state: e.target.value })}
            maxLength={2}
            className="w-full rounded-lg border border-[var(--color-line)] px-3 py-2 text-sm uppercase focus:border-[var(--color-primary)] focus:outline-none"
            placeholder="SP"
          />
        </div>
      </div>

      {editingId && (
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--color-muted)]">Plano</label>
            <select
              value={form.b2b_plan}
              onChange={(e) => setForm({ ...form, b2b_plan: e.target.value })}
              className="w-full rounded-lg border border-[var(--color-line)] px-3 py-2 text-sm focus:border-[var(--color-primary)] focus:outline-none"
            >
              {PLAN_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end gap-2 pb-0.5">
            <label className="flex items-center gap-2 text-sm text-[var(--color-ink)]">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                className="rounded"
              />
              Ativo
            </label>
          </div>
        </div>
      )}

      {feedback && (
        <p className="text-sm text-rose-600">{feedback}</p>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={editingId ? handleUpdate : handleCreate}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--color-primary-deep)] disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {editingId ? "Salvar" : "Criar mercado"}
        </button>
        <button
          type="button"
          onClick={closeForm}
          className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--color-line)] px-4 py-2 text-sm text-[var(--color-muted)] transition hover:bg-[var(--color-surface)]"
        >
          <X className="h-4 w-4" />
          Cancelar
        </button>
      </div>
    </div>
  );

  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--color-muted)]">{markets.length} mercado(s)</p>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--color-primary-deep)]"
        >
          <Plus className="h-4 w-4" />
          Novo mercado
        </button>
      </div>

      {(showCreate || editingId) && formUI}

      {markets.length === 0 ? (
        <div className="rounded-2xl border border-[var(--color-line)] bg-white p-8 text-center shadow-[var(--shadow-soft)]">
          <p className="text-sm text-[var(--color-muted)]">Nenhum mercado cadastrado.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[var(--color-line)] bg-white shadow-[var(--shadow-soft)]">
          <table className="w-full min-w-[700px] text-left text-sm">
            <thead className="bg-[var(--color-surface-strong)] text-xs uppercase tracking-[0.08em] text-[var(--color-muted)]">
              <tr>
                <th className="px-4 py-3">Mercado</th>
                <th className="px-4 py-3">Endereco</th>
                <th className="px-4 py-3">Plano</th>
                <th className="px-4 py-3">Ofertas</th>
                <th className="px-4 py-3">Local</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {markets.map((market) => (
                <tr key={market.id} className="border-t border-[var(--color-line)]">
                  <td className="px-4 py-3">
                    <p className="font-medium text-[var(--color-ink)]">{market.name}</p>
                    <p className="text-xs text-[var(--color-muted)]">{market.city}/{market.state}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-xs text-[var(--color-muted)] max-w-[200px] truncate">
                      {market.address || "—"}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-[var(--color-muted)]">{market.plan}</td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/painel/ofertas?store=${market.id}`}
                      className="font-medium text-[var(--color-primary-deep)] hover:underline"
                    >
                      {market.activeOffers}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span title={`${market.latitude.toFixed(4)}, ${market.longitude.toFixed(4)}`}>
                      <MapPin
                        className={`h-4 w-4 ${
                          isGeocoded(market.latitude, market.longitude)
                            ? "text-emerald-500"
                            : "text-rose-400"
                        }`}
                      />
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-semibold ${
                        market.status === "ativo"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-zinc-200 text-zinc-700"
                      }`}
                    >
                      {market.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => openEdit(market)}
                        className="rounded-lg p-1.5 text-[var(--color-muted)] transition hover:bg-[var(--color-surface)] hover:text-[var(--color-primary)]"
                        title="Editar"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(market.id, market.name)}
                        className="rounded-lg p-1.5 text-[var(--color-muted)] transition hover:bg-rose-50 hover:text-rose-600"
                        title="Excluir"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
