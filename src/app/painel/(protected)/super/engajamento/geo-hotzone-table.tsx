"use client";

import { EngagementRankingTable } from "@/features/shared/engagement-ranking-table";
import type { GeoRanking } from "./engajamento-queries";

export function GeoHotzoneTable({ geo }: { geo: GeoRanking }) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-[var(--color-ink)]">Por localização do mercado</h3>
        <p className="mt-1 text-xs text-[var(--color-muted)]">
          Sempre disponível — usa a localização já cadastrada de cada mercado, mesmo para usuários que nunca concederam permissão de localização.
        </p>
        <EngagementRankingTable
          rows={geo.byStoreLocation}
          entityColumnLabel="Área"
          emptyStateMessage="Nenhum evento associado a um mercado neste período."
          showRank
        />
      </div>

      <div>
        <h3 className="text-sm font-semibold text-[var(--color-ink)]">Por região do usuário</h3>
        <p className="mt-1 text-xs text-[var(--color-muted)]">
          Baseado na localização já resolvida do dispositivo (quando o usuário já concedeu permissão para outra funcionalidade do app) — nenhuma nova permissão é solicitada.
        </p>
        <EngagementRankingTable
          rows={geo.byUserRegion}
          entityColumnLabel="Área"
          emptyStateMessage="Nenhum evento com região do usuário identificada neste período ainda."
          showRank
        />
      </div>
    </div>
  );
}
