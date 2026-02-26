"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  createPdfSource,
  togglePdfSource,
  deletePdfSource,
  triggerManualImport,
} from "./pdf-source-actions";

interface Store {
  id: string;
  name: string;
}

interface PdfSource {
  id: string;
  storeId: string;
  storeName: string;
  url: string;
  label: string | null;
  isActive: boolean;
  lastCheckedAt: string | null;
  lastHash: string | null;
}

interface PdfSourcesClientProps {
  stores: Store[];
  sources: PdfSource[];
}

export function PdfSourcesClient({ stores, sources }: PdfSourcesClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [storeId, setStoreId] = useState("");
  const [url, setUrl] = useState("");
  const [label, setLabel] = useState("");

  const handleCreate = () => {
    setFormError(null);
    startTransition(async () => {
      const result = await createPdfSource({ storeId, url, label });
      if (result.error) {
        setFormError(result.error);
      } else {
        setShowForm(false);
        setStoreId("");
        setUrl("");
        setLabel("");
        router.refresh();
      }
    });
  };

  const handleToggle = (sourceId: string, currentActive: boolean) => {
    setActionError(null);
    startTransition(async () => {
      const result = await togglePdfSource(sourceId, !currentActive);
      if (result.error) setActionError(result.error);
      else router.refresh();
    });
  };

  const handleDelete = (sourceId: string) => {
    setActionError(null);
    startTransition(async () => {
      const result = await deletePdfSource(sourceId);
      if (result.error) setActionError(result.error);
      else router.refresh();
    });
  };

  const handleTest = (sourceId: string) => {
    setActionError(null);
    startTransition(async () => {
      const result = await triggerManualImport(sourceId);
      if (result.error) setActionError(result.error);
      else router.refresh();
    });
  };

  return (
    <div className="space-y-4">
      {actionError && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {actionError}
        </div>
      )}

      {/* Add new source button */}
      {!showForm && (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="min-h-[44px] rounded-xl bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
        >
          + Adicionar Fonte
        </button>
      )}

      {/* New source form */}
      {showForm && (
        <div className="rounded-2xl border border-[var(--color-line)] bg-white p-5 shadow-[var(--shadow-soft)]">
          <h3 className="mb-3 text-sm font-semibold text-[var(--color-ink)]">Nova fonte de PDF</h3>

          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs text-[var(--color-muted)]">Mercado</label>
              <select
                value={storeId}
                onChange={(e) => setStoreId(e.target.value)}
                className="min-h-[44px] w-full rounded-xl border border-[var(--color-line)] px-3 py-2 text-sm"
              >
                <option value="">Selecione...</option>
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs text-[var(--color-muted)]">URL do PDF</label>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://mercado.com/encarte.pdf"
                className="min-h-[44px] w-full rounded-xl border border-[var(--color-line)] px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs text-[var(--color-muted)]">Label (opcional)</label>
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Encarte Semanal"
                className="min-h-[44px] w-full rounded-xl border border-[var(--color-line)] px-3 py-2 text-sm"
              />
            </div>

            {formError && (
              <p className="text-sm text-rose-600">{formError}</p>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                disabled={isPending}
                onClick={handleCreate}
                className="min-h-[44px] rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
              >
                Salvar
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setFormError(null);
                }}
                className="min-h-[44px] rounded-xl border border-[var(--color-line)] px-4 py-2 text-sm font-medium text-[var(--color-muted)] transition hover:bg-[var(--color-surface-strong)]"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sources table */}
      {sources.length === 0 ? (
        <div className="rounded-2xl border border-[var(--color-line)] bg-white p-8 text-center shadow-[var(--shadow-soft)]">
          <p className="text-sm text-[var(--color-muted)]">Nenhuma fonte de PDF cadastrada.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-[var(--color-line)] bg-white shadow-[var(--shadow-soft)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-line)] text-left text-xs font-medium uppercase tracking-wider text-[var(--color-muted)]">
                <th className="px-4 py-3">Mercado</th>
                <th className="px-4 py-3">URL</th>
                <th className="px-4 py-3">Label</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Ultimo check</th>
                <th className="px-4 py-3">Acoes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-line)]">
              {sources.map((source) => (
                <tr key={source.id}>
                  <td className="px-4 py-3 font-medium text-[var(--color-ink)]">
                    {source.storeName}
                  </td>
                  <td className="max-w-[200px] truncate px-4 py-3 text-[var(--color-muted)]">
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-[var(--color-primary)] hover:underline"
                    >
                      {source.url}
                    </a>
                  </td>
                  <td className="px-4 py-3 text-[var(--color-muted)]">
                    {source.label ?? "-"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        source.isActive
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {source.isActive ? "Ativo" : "Inativo"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[var(--color-muted)]">
                    {source.lastCheckedAt
                      ? new Date(source.lastCheckedAt).toLocaleDateString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "Nunca"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => handleToggle(source.id, source.isActive)}
                        className="rounded-lg border border-[var(--color-line)] px-2.5 py-1 text-xs font-medium text-[var(--color-muted)] transition hover:bg-[var(--color-surface-strong)] disabled:opacity-50"
                      >
                        {source.isActive ? "Desativar" : "Ativar"}
                      </button>
                      <button
                        type="button"
                        disabled={isPending || !source.isActive}
                        onClick={() => handleTest(source.id)}
                        className="rounded-lg border border-[var(--color-primary)] px-2.5 py-1 text-xs font-medium text-[var(--color-primary)] transition hover:bg-[var(--color-primary-soft)] disabled:opacity-50"
                      >
                        Testar
                      </button>
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => handleDelete(source.id)}
                        className="rounded-lg border border-rose-300 px-2.5 py-1 text-xs font-medium text-rose-600 transition hover:bg-rose-50 disabled:opacity-50"
                      >
                        Excluir
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
