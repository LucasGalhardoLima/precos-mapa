"use client";

import { Fragment, useState } from "react";
import { fetchUserEngagementDetail } from "./user-engagement-detail-action";
import type { UserEngagementDetail, UserRankingRow } from "./engajamento-queries";

function formatNumber(n: number): string {
  return n.toLocaleString("pt-BR");
}

interface UserEngagementTableProps {
  users: UserRankingRow[];
  startDate: string;
  endDate: string;
}

export function UserEngagementTable({ users, startDate, endDate }: UserEngagementTableProps) {
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [detailByUser, setDetailByUser] = useState<Record<string, UserEngagementDetail>>({});
  const [loadingUserId, setLoadingUserId] = useState<string | null>(null);
  const [errorByUser, setErrorByUser] = useState<Record<string, string>>({});

  if (users.length === 0) {
    return (
      <p className="mt-4 text-center text-sm text-[var(--color-muted)]">
        Nenhum usuário com engajamento neste período.
      </p>
    );
  }

  async function toggleRow(userId: string) {
    if (expandedUserId === userId) {
      setExpandedUserId(null);
      return;
    }
    setExpandedUserId(userId);
    if (detailByUser[userId] || loadingUserId === userId) return;

    setLoadingUserId(userId);
    try {
      const detail = await fetchUserEngagementDetail(userId, startDate, endDate);
      setDetailByUser((prev) => ({ ...prev, [userId]: detail }));
    } catch {
      setErrorByUser((prev) => ({ ...prev, [userId]: "Erro ao carregar detalhes deste usuário." }));
    } finally {
      setLoadingUserId(null);
    }
  }

  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-[var(--color-line)] text-xs text-[var(--color-muted)]">
            <th className="py-3 pr-4 font-medium">#</th>
            <th className="py-3 pr-4 font-medium">Usuário</th>
            <th className="py-3 pr-4 font-medium">Produto mais visto</th>
            <th className="py-3 pr-4 font-medium">Mercado mais visitado</th>
            <th className="py-3 pr-4 font-medium">Cidade mais frequente</th>
            <th className="py-3 pr-4 font-medium text-right">Lista</th>
            <th className="py-3 font-medium text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user, index) => {
            const isExpanded = expandedUserId === user.userId;
            const detail = detailByUser[user.userId];
            const isLoading = loadingUserId === user.userId;
            const error = errorByUser[user.userId];

            return (
              <Fragment key={user.userId}>
                <tr
                  onClick={() => toggleRow(user.userId)}
                  className="cursor-pointer border-b border-[var(--color-line)] last:border-0 hover:bg-[var(--color-surface-strong)]"
                >
                  <td className="py-3 pr-4 text-xs text-[var(--color-muted)]">{index + 1}</td>
                  <td className="py-3 pr-4 font-medium text-[var(--color-ink)]">{user.label}</td>
                  <td className="py-3 pr-4 text-[var(--color-muted)]">{user.topProductName ?? "—"}</td>
                  <td className="py-3 pr-4 text-[var(--color-muted)]">{user.topStoreName ?? "—"}</td>
                  <td className="py-3 pr-4 text-[var(--color-muted)]">{user.topCityLabel ?? "—"}</td>
                  <td className="py-3 pr-4 text-right tabular-nums">{formatNumber(user.listAdds)}</td>
                  <td className="py-3 text-right tabular-nums font-semibold text-[var(--color-ink)]">
                    {formatNumber(user.totalEvents)}
                  </td>
                </tr>
                {isExpanded && (
                  <tr className="border-b border-[var(--color-line)] last:border-0">
                    <td colSpan={7} className="bg-[var(--color-surface-strong)] p-4">
                      {isLoading && (
                        <p className="text-sm text-[var(--color-muted)]">Carregando detalhes…</p>
                      )}
                      {error && <p className="text-sm text-red-600">{error}</p>}
                      {detail && <UserEngagementDetailPanel detail={detail} />}
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
      <p className="mt-3 text-xs text-[var(--color-muted)]">
        Clique em um usuário para ver o detalhamento (top 5 produtos, mercados, cidades e regiões).
      </p>
    </div>
  );
}

function UserEngagementDetailPanel({ detail }: { detail: UserEngagementDetail }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <DetailList
        title="Produtos mais vistos"
        emptyMessage="Nenhum produto visualizado."
        items={detail.topProducts.map((p) => ({ label: p.product_name, count: p.events }))}
      />
      <DetailList
        title="Mercados mais visitados"
        emptyMessage="Nenhum mercado visitado."
        items={detail.topStores.map((s) => ({ label: s.store_name, sublabel: `${s.city}, ${s.state}`, count: s.events }))}
      />
      <DetailList
        title="Cidades mais frequentes"
        emptyMessage="Nenhuma cidade identificada."
        items={detail.topCities.map((c) => ({ label: `${c.city}, ${c.state}`, count: c.events }))}
      />
      <DetailList
        title="Regiões autodeclaradas"
        emptyMessage="Nenhuma região capturada ainda (depende de permissão de localização já concedida)."
        items={detail.topRegions.map((r) => ({ label: r.region, count: r.events }))}
      />
      <div className="md:col-span-2 xl:col-span-4">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
          Total no período
        </h4>
        <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm text-[var(--color-ink)]">
          <span>Buscas: <strong>{formatNumber(detail.totals.search_impressions)}</strong></span>
          <span>Detalhes: <strong>{formatNumber(detail.totals.detail_views)}</strong></span>
          <span>Lista: <strong>{formatNumber(detail.totals.list_adds)}</strong></span>
          <span>Alertas: <strong>{formatNumber(detail.totals.alerts_created)}</strong></span>
          <span>Mapa: <strong>{formatNumber(detail.totals.map_taps)}</strong></span>
        </div>
      </div>
    </div>
  );
}

function DetailList({
  title,
  emptyMessage,
  items,
}: {
  title: string;
  emptyMessage: string;
  items: Array<{ label: string; sublabel?: string; count: number }>;
}) {
  return (
    <div>
      <h4 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">{title}</h4>
      {items.length === 0 ? (
        <p className="mt-2 text-xs text-[var(--color-muted)]">{emptyMessage}</p>
      ) : (
        <ul className="mt-2 space-y-1 text-sm text-[var(--color-ink)]">
          {items.map((item, i) => (
            <li key={i} className="flex items-baseline justify-between gap-2">
              <span className="truncate">
                {item.label}
                {item.sublabel && <span className="ml-1 text-xs text-[var(--color-muted)]">{item.sublabel}</span>}
              </span>
              <span className="shrink-0 tabular-nums text-xs font-medium text-[var(--color-muted)]">
                {formatNumber(item.count)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
