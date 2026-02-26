"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { PlusCircle, ChevronUp, ChevronDown } from "lucide-react";
import { SectionHeader } from "@/features/panel/components/section-header";
import { formatCurrency, formatDateLabel } from "@/features/shared/format";
import { toggleOfferStatus, deleteOffer } from "@/features/offers/actions";

export interface PromotionRow {
  id: string;
  store_id: string;
  promo_price: number;
  original_price: number;
  status: string;
  source: string;
  end_date: string;
  created_at: string;
  product: { name: string; brand: string | null; category: { name: string } | null } | null;
  store?: { name: string } | null;
}

interface OffersTableProps {
  promotions: PromotionRow[];
  storeId?: string;
  showStoreColumn?: boolean;
  totalCount: number;
  page: number;
  pageSize: number;
  sort: string;
  dir: string;
}

function buildHref(
  storeId: string | undefined,
  overrides: { page?: number; sort?: string; dir?: string },
  current: { page: number; sort: string; dir: string },
) {
  const p = new URLSearchParams();
  if (storeId) p.set("store", storeId);
  p.set("page", String(overrides.page ?? current.page));
  p.set("sort", overrides.sort ?? current.sort);
  p.set("dir", overrides.dir ?? current.dir);
  return `/painel/ofertas?${p.toString()}`;
}

function SortableHeader({
  label,
  column,
  storeId,
  currentSort,
  currentDir,
}: {
  label: string;
  column: string;
  storeId?: string;
  currentSort: string;
  currentDir: string;
}) {
  const isActive = currentSort === column;
  const nextDir = isActive && currentDir === "asc" ? "desc" : "asc";
  const Icon = isActive && currentDir === "asc" ? ChevronUp : ChevronDown;

  return (
    <th className="px-4 py-3">
      <Link
        href={buildHref(storeId, { sort: column, dir: nextDir, page: 1 }, { page: 1, sort: currentSort, dir: currentDir })}
        className="inline-flex items-center gap-1 hover:text-[var(--color-ink)]"
      >
        {label}
        {isActive && <Icon className="h-3.5 w-3.5" />}
      </Link>
    </th>
  );
}

export function OffersTable({
  promotions,
  storeId,
  showStoreColumn,
  totalCount,
  page,
  pageSize,
  sort,
  dir,
}: OffersTableProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const totalPages = Math.ceil(totalCount / pageSize);
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalCount);

  const handleToggle = (id: string, rowStoreId: string) => {
    startTransition(async () => {
      await toggleOfferStatus(id, rowStoreId);
      router.refresh();
    });
  };

  const handleDelete = (id: string, rowStoreId: string) => {
    if (!confirm("Deseja excluir esta oferta?")) return;
    startTransition(async () => {
      await deleteOffer(id, rowStoreId);
      router.refresh();
    });
  };

  const colCount = showStoreColumn ? 8 : 7;

  return (
    <div className="space-y-5">
      <SectionHeader
        title={showStoreColumn ? "Todas as Ofertas" : "Minhas Ofertas"}
        subtitle={showStoreColumn
          ? "Visao consolidada de todas as promocoes da plataforma."
          : "Gestao das promocoes da loja. Itens importados via IA aparecem automaticamente aqui."}
        action={
          !showStoreColumn ? (
            <Link
              href="/painel/ofertas/nova"
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[var(--color-primary)] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[var(--color-primary-deep)]"
            >
              <PlusCircle className="h-4 w-4" />
              Nova oferta
            </Link>
          ) : undefined
        }
      />

      <div className="overflow-x-auto rounded-2xl border border-[var(--color-line)] bg-white shadow-[var(--shadow-soft)]">
        <table className={`w-full text-left text-sm ${showStoreColumn ? "min-w-[940px]" : "min-w-[780px]"}`}>
          <thead className="bg-[var(--color-surface-strong)] text-xs uppercase tracking-[0.08em] text-[var(--color-muted)]">
            <tr>
              <SortableHeader label="Produto" column="created_at" storeId={storeId} currentSort={sort} currentDir={dir} />
              {showStoreColumn && <th className="px-4 py-3 whitespace-nowrap">Mercado</th>}
              <th className="px-4 py-3 whitespace-nowrap">Categoria</th>
              <SortableHeader label="Preco" column="promo_price" storeId={storeId} currentSort={sort} currentDir={dir} />
              <SortableHeader label="Validade" column="end_date" storeId={storeId} currentSort={sort} currentDir={dir} />
              <th className="px-4 py-3 whitespace-nowrap">Origem</th>
              <SortableHeader label="Status" column="status" storeId={storeId} currentSort={sort} currentDir={dir} />
              <th className="px-4 py-3 text-right whitespace-nowrap">Acoes</th>
            </tr>
          </thead>
          <tbody>
            {promotions.map((p) => (
              <tr key={p.id} className="border-t border-[var(--color-line)]">
                <td className="px-4 py-3">
                  <p className="font-medium text-[var(--color-ink)]">
                    {p.product?.name ?? "Produto"}
                  </p>
                  <p className="text-xs text-[var(--color-muted)]">
                    {p.product?.brand ?? ""}
                  </p>
                </td>
                {showStoreColumn && (
                  <td className="px-4 py-3">
                    <Link
                      href={`/painel/ofertas?store=${p.store_id}`}
                      className="font-medium text-[var(--color-primary-deep)] hover:underline"
                    >
                      {p.store?.name ?? "—"}
                    </Link>
                  </td>
                )}
                <td className="px-4 py-3 text-[var(--color-muted)]">
                  {p.product?.category?.name ?? ""}
                </td>
                <td className="px-4 py-3">
                  <p className="font-semibold text-[var(--color-primary-deep)]">
                    {formatCurrency(p.promo_price)}
                  </p>
                  <p className="text-xs text-[var(--color-muted)] line-through">
                    {formatCurrency(p.original_price)}
                  </p>
                </td>
                <td className="px-4 py-3 text-[var(--color-muted)]">
                  {formatDateLabel(p.end_date)}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-semibold ${
                      p.source === "importador_ia"
                        ? "bg-sky-100 text-sky-700"
                        : "bg-zinc-100 text-zinc-700"
                    }`}
                  >
                    {p.source === "importador_ia" ? "Importador IA" : "Manual"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-semibold ${
                      p.status === "active"
                        ? "bg-emerald-100 text-emerald-700"
                        : p.status === "pending_review"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-zinc-100 text-zinc-500"
                    }`}
                  >
                    {p.status === "active" ? "Ativa" : p.status === "pending_review" ? "Em revisao" : "Expirada"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => handleToggle(p.id, p.store_id)}
                      className="min-h-[36px] rounded-lg border border-[var(--color-line)] px-2.5 py-1.5 text-xs font-medium text-[var(--color-muted)] transition hover:border-[var(--color-primary)] hover:text-[var(--color-primary-deep)] disabled:opacity-50"
                    >
                      {p.status === "active" ? "Desativar" : "Ativar"}
                    </button>
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => handleDelete(p.id, p.store_id)}
                      className="min-h-[36px] rounded-lg border border-[var(--color-line)] px-2.5 py-1.5 text-xs font-medium text-rose-500 transition hover:border-rose-300 hover:bg-rose-50 disabled:opacity-50"
                    >
                      Excluir
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {promotions.length === 0 && (
              <tr>
                <td colSpan={colCount} className="px-4 py-8 text-center text-sm text-[var(--color-muted)]">
                  {showStoreColumn
                    ? "Nenhuma oferta na plataforma."
                    : "Nenhuma oferta cadastrada. Crie sua primeira oferta!"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalCount > 0 && (
        <div className="flex items-center justify-between text-sm text-[var(--color-muted)]">
          <span>
            Mostrando {from}&ndash;{to} de {totalCount} ofertas
          </span>
          <div className="flex items-center gap-2">
            {page > 1 ? (
              <Link
                href={buildHref(storeId, { page: page - 1 }, { page, sort, dir })}
                className="rounded-lg border border-[var(--color-line)] px-3 py-1.5 text-xs font-medium transition hover:border-[var(--color-primary)] hover:text-[var(--color-primary-deep)]"
              >
                Anterior
              </Link>
            ) : (
              <span className="cursor-not-allowed rounded-lg border border-[var(--color-line)] px-3 py-1.5 text-xs font-medium opacity-40">
                Anterior
              </span>
            )}
            <span className="text-xs">
              {page} / {totalPages}
            </span>
            {page < totalPages ? (
              <Link
                href={buildHref(storeId, { page: page + 1 }, { page, sort, dir })}
                className="rounded-lg border border-[var(--color-line)] px-3 py-1.5 text-xs font-medium transition hover:border-[var(--color-primary)] hover:text-[var(--color-primary-deep)]"
              >
                Proxima
              </Link>
            ) : (
              <span className="cursor-not-allowed rounded-lg border border-[var(--color-line)] px-3 py-1.5 text-xs font-medium opacity-40">
                Proxima
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
