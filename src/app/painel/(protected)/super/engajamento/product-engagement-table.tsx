"use client";

import { EngagementRankingTable } from "@/features/shared/engagement-ranking-table";
import type { RankingRow } from "./engajamento-queries";

export function ProductEngagementTable({ products }: { products: RankingRow[] }) {
  return (
    <EngagementRankingTable
      rows={products}
      entityColumnLabel="Produto"
      emptyStateMessage="Nenhum produto com engajamento neste período."
      footerNote="Números entre parênteses = usuários únicos."
      showRank
    />
  );
}
