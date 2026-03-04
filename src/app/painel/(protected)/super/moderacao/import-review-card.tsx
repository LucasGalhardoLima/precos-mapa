"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { approveImportPass, rejectImport } from "./import-review-server-actions";

interface ExtractedProduct {
  name: string;
  price: number;
  original_price?: number | null;
  unit?: string;
  category?: string;
  validity?: string | null;
}

interface PassSummary {
  productCount: number;
  products: ExtractedProduct[];
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

function formatPrice(value: number): string {
  return `R$ ${value.toFixed(2).replace(".", ",")}`;
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

  // Find the pass with the most products for the "best pass" indicator
  const validPasses = item.passes
    .map((p, i) => ({ index: i + 1, count: p.productCount, hasError: p.hasError }))
    .filter((p) => !p.hasError && p.count > 0);
  const bestPass = validPasses.length > 0
    ? validPasses.reduce((a, b) => (a.count >= b.count ? a : b))
    : null;

  return (
    <article className="rounded-2xl border border-[var(--color-line)] bg-white p-5 shadow-[var(--shadow-soft)]">
      {/* Header */}
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

      {/* Pass comparison summary */}
      <div className="mt-3 flex flex-wrap gap-3 text-xs text-[var(--color-muted)]">
        {item.passes.map((pass, i) => (
          <span key={i}>
            Pass {i + 1}:{" "}
            <span className={pass.hasError ? "text-rose-500" : "font-medium text-[var(--color-ink)]"}>
              {pass.hasError ? "erro" : `${pass.productCount} produtos`}
            </span>
          </span>
        ))}
      </div>

      {/* Pass tabs */}
      <div className="mt-4 flex gap-1">
        {([1, 2, 3] as const).map((passNum) => {
          const pass = item.passes[passNum - 1];
          const isBest = bestPass?.index === passNum;
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
              {isBest && (
                <span className="ml-1 rounded bg-emerald-100 px-1 py-0.5 text-[9px] font-bold text-emerald-700">
                  melhor
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Pass content */}
      <div className="mt-3 rounded-xl bg-[var(--color-surface-strong)] p-3">
        {currentPass.hasError ? (
          <p className="text-sm text-rose-600">Erro: {currentPass.errorMessage}</p>
        ) : currentPass.productCount === 0 ? (
          <p className="text-sm text-[var(--color-muted)]">Nenhum produto extraido nesta passagem.</p>
        ) : (
          <>
            <p className="mb-2 text-sm font-medium text-[var(--color-ink)]">
              {currentPass.productCount} produtos extraidos
            </p>
            <div className="max-h-[400px] overflow-auto rounded-lg border border-[var(--color-line)] bg-white">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-[var(--color-surface)] text-left text-[var(--color-muted)]">
                  <tr>
                    <th className="px-3 py-2 font-medium">#</th>
                    <th className="px-3 py-2 font-medium">Produto</th>
                    <th className="px-3 py-2 font-medium text-right">Preco</th>
                    <th className="px-3 py-2 font-medium text-right">Original</th>
                    <th className="px-3 py-2 font-medium">Un.</th>
                    <th className="px-3 py-2 font-medium">Categoria</th>
                    <th className="px-3 py-2 font-medium">Validade</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-line)]">
                  {currentPass.products.map((product, i) => (
                    <tr key={i} className="hover:bg-[var(--color-surface-strong)]">
                      <td className="px-3 py-1.5 text-[var(--color-muted)]">{i + 1}</td>
                      <td className="max-w-[250px] truncate px-3 py-1.5 font-medium text-[var(--color-ink)]">
                        {product.name}
                      </td>
                      <td className="whitespace-nowrap px-3 py-1.5 text-right font-semibold text-emerald-700">
                        {formatPrice(product.price)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-1.5 text-right text-[var(--color-muted)]">
                        {product.original_price ? formatPrice(product.original_price) : "—"}
                      </td>
                      <td className="px-3 py-1.5 text-[var(--color-muted)]">
                        {product.unit ?? "un"}
                      </td>
                      <td className="px-3 py-1.5 text-[var(--color-muted)]">
                        {product.category ?? "—"}
                      </td>
                      <td className="whitespace-nowrap px-3 py-1.5 text-[var(--color-muted)]">
                        {product.validity ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Actions */}
      <div className="mt-4 flex flex-wrap gap-2">
        {([1, 2, 3] as const).map((passNum) => {
          const pass = item.passes[passNum - 1];
          if (pass.hasError || pass.productCount === 0) return null;
          const isBest = bestPass?.index === passNum;
          return (
            <button
              key={passNum}
              type="button"
              disabled={isPending}
              onClick={() => handleApprove(passNum)}
              className={`min-h-[44px] rounded-xl px-4 py-2 text-sm font-semibold text-white transition disabled:opacity-50 ${
                isBest
                  ? "bg-emerald-600 hover:bg-emerald-700"
                  : "bg-emerald-500 hover:bg-emerald-600"
              }`}
            >
              Aprovar Pass {passNum}
              {isBest && " (recomendado)"}
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
