"use client";

import type { RankingRow } from "@/app/painel/(protected)/super/engajamento/engajamento-queries";

function formatNumber(n: number): string {
  return n.toLocaleString("pt-BR");
}

export interface EngagementRankingTableProps {
  rows: RankingRow[];
  /** Header for the entity column, e.g. "Mercado" | "Produto" | "Área". */
  entityColumnLabel: string;
  /** pt-BR message shown when rows is empty. */
  emptyStateMessage: string;
  /** Optional footer note, e.g. explaining what the parenthesized numbers mean. */
  footerNote?: string;
  /** Show the rank (#) column — off by default for groupings without a natural rank feel (e.g. geo). */
  showRank?: boolean;
}

export function EngagementRankingTable({
  rows,
  entityColumnLabel,
  emptyStateMessage,
  footerNote,
  showRank = false,
}: EngagementRankingTableProps) {
  if (rows.length === 0) {
    return <p className="mt-4 text-center text-sm text-[var(--color-muted)]">{emptyStateMessage}</p>;
  }

  const breakdownColumns = rows[0].breakdown;

  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-[var(--color-line)] text-xs text-[var(--color-muted)]">
            {showRank && <th className="py-3 pr-4 font-medium">#</th>}
            <th className="py-3 pr-4 font-medium">{entityColumnLabel}</th>
            {breakdownColumns.map((col) => (
              <th key={col.key} className="py-3 pr-4 font-medium text-right">
                {col.label}
              </th>
            ))}
            <th className="py-3 pr-4 font-medium text-right">Total</th>
            <th className="py-3 font-medium text-right">Usuários</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.id} className="border-b border-[var(--color-line)] last:border-0">
              {showRank && <td className="py-3 pr-4 text-xs text-[var(--color-muted)]">{index + 1}</td>}
              <td className="py-3 pr-4">
                <div className="font-medium text-[var(--color-ink)]">{row.label}</div>
                {row.sublabel && <div className="text-xs text-[var(--color-muted)]">{row.sublabel}</div>}
              </td>
              {row.breakdown.map((col) => (
                <td key={col.key} className="py-3 pr-4 text-right tabular-nums">
                  <span className="font-medium">{formatNumber(col.count)}</span>
                  <span className="ml-1 text-xs text-[var(--color-muted)]">({formatNumber(col.uniqueUsers)})</span>
                </td>
              ))}
              <td className="py-3 pr-4 text-right tabular-nums font-semibold text-[var(--color-ink)]">
                {formatNumber(row.totalEvents)}
              </td>
              <td className="py-3 text-right tabular-nums font-semibold text-emerald-700">
                {formatNumber(row.totalUniqueUsers)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {footerNote && <p className="mt-3 text-xs text-[var(--color-muted)]">{footerNote}</p>}
    </div>
  );
}
