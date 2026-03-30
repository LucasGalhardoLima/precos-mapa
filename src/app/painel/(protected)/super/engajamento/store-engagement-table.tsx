"use client";

interface StoreEngagement {
  store_id: string;
  store_name: string;
  city: string;
  chain: string | null;
  search_impressions: number;
  search_unique_users: number;
  detail_views: number;
  detail_unique_users: number;
  list_adds: number;
  list_unique_users: number;
  alerts_created: number;
  alert_unique_users: number;
  map_taps: number;
  map_unique_users: number;
  total_events: number;
  total_unique_users: number;
  first_event_at: string;
  last_event_at: string;
}

function formatNumber(n: number): string {
  return n.toLocaleString("pt-BR");
}

export function StoreEngagementTable({
  stores,
}: {
  stores: StoreEngagement[];
}) {
  if (stores.length === 0) {
    return (
      <p className="mt-4 text-center text-sm text-[var(--color-muted)]">
        Nenhum evento registrado ainda. Os dados aparecerão conforme os
        usuários interagirem com o app.
      </p>
    );
  }

  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-[var(--color-line)] text-xs text-[var(--color-muted)]">
            <th className="py-3 pr-4 font-medium">Mercado</th>
            <th className="py-3 pr-4 font-medium text-right">Buscas</th>
            <th className="py-3 pr-4 font-medium text-right">Detalhes</th>
            <th className="py-3 pr-4 font-medium text-right">Lista</th>
            <th className="py-3 pr-4 font-medium text-right">Alertas</th>
            <th className="py-3 pr-4 font-medium text-right">Mapa</th>
            <th className="py-3 pr-4 font-medium text-right">Total</th>
            <th className="py-3 font-medium text-right">Usuários</th>
          </tr>
        </thead>
        <tbody>
          {stores.map((store) => (
            <tr
              key={store.store_id}
              className="border-b border-[var(--color-line)] last:border-0"
            >
              <td className="py-3 pr-4">
                <div className="font-medium text-[var(--color-ink)]">
                  {store.store_name}
                </div>
                <div className="text-xs text-[var(--color-muted)]">
                  {store.city}
                  {store.chain ? ` · ${store.chain}` : ""}
                </div>
              </td>
              <td className="py-3 pr-4 text-right tabular-nums">
                <span className="font-medium">{formatNumber(store.search_impressions)}</span>
                <span className="ml-1 text-xs text-[var(--color-muted)]">
                  ({formatNumber(store.search_unique_users)})
                </span>
              </td>
              <td className="py-3 pr-4 text-right tabular-nums">
                <span className="font-medium">{formatNumber(store.detail_views)}</span>
                <span className="ml-1 text-xs text-[var(--color-muted)]">
                  ({formatNumber(store.detail_unique_users)})
                </span>
              </td>
              <td className="py-3 pr-4 text-right tabular-nums">
                <span className="font-medium">{formatNumber(store.list_adds)}</span>
                <span className="ml-1 text-xs text-[var(--color-muted)]">
                  ({formatNumber(store.list_unique_users)})
                </span>
              </td>
              <td className="py-3 pr-4 text-right tabular-nums">
                <span className="font-medium">{formatNumber(store.alerts_created)}</span>
                <span className="ml-1 text-xs text-[var(--color-muted)]">
                  ({formatNumber(store.alert_unique_users)})
                </span>
              </td>
              <td className="py-3 pr-4 text-right tabular-nums">
                <span className="font-medium">{formatNumber(store.map_taps)}</span>
                <span className="ml-1 text-xs text-[var(--color-muted)]">
                  ({formatNumber(store.map_unique_users)})
                </span>
              </td>
              <td className="py-3 pr-4 text-right tabular-nums font-semibold text-[var(--color-ink)]">
                {formatNumber(store.total_events)}
              </td>
              <td className="py-3 text-right tabular-nums font-semibold text-emerald-700">
                {formatNumber(store.total_unique_users)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3 text-xs text-[var(--color-muted)]">
        Números entre parênteses = usuários únicos. Dados de todos os tempos.
      </p>
    </div>
  );
}
