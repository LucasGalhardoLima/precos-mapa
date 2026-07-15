"use client";

import { EngagementRankingTable } from "@/features/shared/engagement-ranking-table";
import type { RankingRow } from "./engajamento-queries";

export function StoreEngagementTable({ stores }: { stores: RankingRow[] }) {
  return (
    <EngagementRankingTable
      rows={stores}
      entityColumnLabel="Mercado"
      emptyStateMessage="Nenhum evento registrado ainda. Os dados aparecerão conforme os usuários interagirem com o app."
      footerNote="Números entre parênteses = usuários únicos. Dados de todos os tempos."
    />
  );
}
