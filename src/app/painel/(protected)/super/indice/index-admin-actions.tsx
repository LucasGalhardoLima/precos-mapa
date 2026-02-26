"use client";

import { useTransition } from "react";
import Link from "next/link";
import { updateIndexStatus, deleteIndex, recalculateIndex, exportIndexCsv } from "./index-server-actions";

interface IndexAdminActionsProps {
  indexId: string;
  currentStatus: "draft" | "published" | "archived";
  periodStart: string;
  city: string;
  state: string;
}

export function IndexAdminActions({ indexId, currentStatus, periodStart, city, state }: IndexAdminActionsProps) {
  const [isPending, startTransition] = useTransition();

  function handleStatusChange(newStatus: "published" | "archived") {
    startTransition(async () => {
      await updateIndexStatus(indexId, newStatus);
    });
  }

  function handleDelete() {
    if (!confirm(`Deseja excluir o indice de ${city}/${state} (${periodStart})? Esta acao nao pode ser desfeita.`)) return;
    startTransition(async () => {
      await deleteIndex(indexId);
    });
  }

  function handleRecalculate() {
    if (!confirm(`Recalcular o indice de ${city}/${state} (${periodStart})? O indice atual sera substituido.`)) return;
    startTransition(async () => {
      await recalculateIndex(indexId);
    });
  }

  function handleExport() {
    startTransition(async () => {
      const csv = await exportIndexCsv(indexId);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `indice-${city}-${periodStart}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  const detailsButton = (
    <Link
      href={`/painel/super/indice/${indexId}`}
      className="rounded-lg border border-[var(--color-line)] px-3 py-1.5 text-xs font-semibold text-[var(--color-muted)] transition hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
    >
      Ver Detalhes
    </Link>
  );

  return (
    <div className="flex flex-wrap gap-2">
      {currentStatus === "draft" && (
        <>
          {detailsButton}
          <button
            onClick={handleRecalculate}
            disabled={isPending}
            className="rounded-lg border border-amber-300 px-3 py-1.5 text-xs font-semibold text-amber-600 transition hover:bg-amber-50 disabled:opacity-50"
          >
            {isPending ? "Recalculando..." : "Recalcular"}
          </button>
          <button
            onClick={handleDelete}
            disabled={isPending}
            className="rounded-lg border border-rose-300 px-3 py-1.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 disabled:opacity-50"
          >
            {isPending ? "Excluindo..." : "Excluir"}
          </button>
          <button
            onClick={() => handleStatusChange("published")}
            disabled={isPending}
            className="rounded-lg bg-[var(--color-primary)] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[var(--color-primary-deep)] disabled:opacity-50"
          >
            {isPending ? "Publicando..." : "Publicar"}
          </button>
        </>
      )}

      {currentStatus === "published" && (
        <>
          {detailsButton}
          <button
            onClick={handleExport}
            disabled={isPending}
            className="rounded-lg border border-[var(--color-line)] px-3 py-1.5 text-xs font-semibold text-[var(--color-muted)] transition hover:border-emerald-300 hover:text-emerald-600 disabled:opacity-50"
          >
            {isPending ? "Exportando..." : "Exportar CSV"}
          </button>
          <button
            onClick={() => handleStatusChange("archived")}
            disabled={isPending}
            className="rounded-lg border border-[var(--color-line)] px-3 py-1.5 text-xs font-semibold text-[var(--color-muted)] transition hover:border-rose-300 hover:text-rose-600 disabled:opacity-50"
          >
            {isPending ? "Arquivando..." : "Arquivar"}
          </button>
        </>
      )}

      {currentStatus === "archived" && (
        <>
          {detailsButton}
          <button
            onClick={handleExport}
            disabled={isPending}
            className="rounded-lg border border-[var(--color-line)] px-3 py-1.5 text-xs font-semibold text-[var(--color-muted)] transition hover:border-emerald-300 hover:text-emerald-600 disabled:opacity-50"
          >
            {isPending ? "Exportando..." : "Exportar CSV"}
          </button>
          <button
            onClick={() => handleStatusChange("published")}
            disabled={isPending}
            className="rounded-lg border border-[var(--color-line)] px-3 py-1.5 text-xs font-semibold text-[var(--color-muted)] transition hover:border-emerald-300 hover:text-emerald-600 disabled:opacity-50"
          >
            {isPending ? "Republicando..." : "Republicar"}
          </button>
        </>
      )}
    </div>
  );
}
