"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { approveImportPass, rejectImport } from "./import-review-server-actions";

interface PassSummary {
  productCount: number;
  sampleProducts: string[];
  hasError: boolean;
  errorMessage?: string;
}

interface ImportReviewItem {
  id: string;
  storeName: string;
  filename: string;
  createdAt: string;
  passes: [PassSummary, PassSummary, PassSummary];
}

export function ImportReviewCard({ item }: { item: ImportReviewItem }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [activePass, setActivePass] = useState<1 | 2 | 3>(1);

  const handleApprove = (passNumber: 1 | 2 | 3) => {
    startTransition(async () => {
      await approveImportPass(item.id, passNumber);
      router.refresh();
    });
  };

  const handleReject = () => {
    startTransition(async () => {
      await rejectImport(item.id);
      router.refresh();
    });
  };

  const currentPass = item.passes[activePass - 1];

  return (
    <article className="rounded-2xl border border-[var(--color-line)] bg-white p-5 shadow-[var(--shadow-soft)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-[var(--color-ink)]">{item.storeName}</p>
          <p className="text-sm text-[var(--color-muted)]">{item.filename}</p>
          <p className="text-xs text-[var(--color-muted)]">
            {new Date(item.createdAt).toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>
        <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-700">
          Sem consenso
        </span>
      </div>

      {/* Pass tabs */}
      <div className="mt-4 flex gap-1">
        {([1, 2, 3] as const).map((passNum) => {
          const pass = item.passes[passNum - 1];
          return (
            <button
              key={passNum}
              type="button"
              onClick={() => setActivePass(passNum)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                activePass === passNum
                  ? "bg-[var(--color-primary-soft)] text-[var(--color-primary-deep)]"
                  : "bg-[var(--color-surface-strong)] text-[var(--color-muted)] hover:bg-[var(--color-surface)]"
              }`}
            >
              Pass {passNum}
              <span className="ml-1.5 text-[10px]">
                {pass.hasError ? "erro" : `${pass.productCount} itens`}
              </span>
            </button>
          );
        })}
      </div>

      {/* Pass content */}
      <div className="mt-3 rounded-xl bg-[var(--color-surface-strong)] p-3">
        {currentPass.hasError ? (
          <p className="text-sm text-rose-600">Erro: {currentPass.errorMessage}</p>
        ) : (
          <>
            <p className="text-sm font-medium text-[var(--color-ink)]">
              {currentPass.productCount} produtos extraidos
            </p>
            {currentPass.sampleProducts.length > 0 && (
              <ul className="mt-1.5 space-y-0.5">
                {currentPass.sampleProducts.map((name, i) => (
                  <li key={i} className="text-xs text-[var(--color-muted)]">
                    {name}
                  </li>
                ))}
                {currentPass.productCount > currentPass.sampleProducts.length && (
                  <li className="text-xs text-[var(--color-muted)]">
                    ... e mais {currentPass.productCount - currentPass.sampleProducts.length}
                  </li>
                )}
              </ul>
            )}
          </>
        )}
      </div>

      {/* Actions */}
      <div className="mt-4 flex flex-wrap gap-2">
        {([1, 2, 3] as const).map((passNum) => {
          const pass = item.passes[passNum - 1];
          if (pass.hasError || pass.productCount === 0) return null;
          return (
            <button
              key={passNum}
              type="button"
              disabled={isPending}
              onClick={() => handleApprove(passNum)}
              className="min-h-[44px] rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
            >
              Aprovar Pass {passNum}
            </button>
          );
        })}
        <button
          type="button"
          disabled={isPending}
          onClick={handleReject}
          className="min-h-[44px] rounded-xl border border-rose-300 px-4 py-2 text-sm font-semibold text-rose-600 transition hover:bg-rose-50 disabled:opacity-50"
        >
          Rejeitar
        </button>
      </div>
    </article>
  );
}
