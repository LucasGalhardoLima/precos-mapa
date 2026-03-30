import { requirePermission } from "@/features/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { SectionHeader } from "@/features/panel/components/section-header";
import { KpiCard } from "@/features/panel/components/kpi-card";
import { StoreEngagementTable } from "./store-engagement-table";
import { DailyTrendChart } from "./daily-trend-chart";

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

interface DailyAggregate {
  event_date: string;
  event_type: string;
  event_count: number;
  unique_users: number;
}

export default async function EngagementDashboardPage() {
  await requirePermission("dashboard:global:view");
  const supabase = getSupabaseAdmin();

  const [
    { data: storeEngagement },
    { data: dailyAggregates },
    { count: totalEvents },
  ] = await Promise.all([
    supabase
      .from("store_engagement_summary")
      .select("*")
      .order("total_events", { ascending: false }),
    supabase
      .from("analytics_aggregate_summary")
      .select("*")
      .gte("event_date", new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0])
      .order("event_date", { ascending: true }),
    supabase
      .from("analytics_events")
      .select("id", { count: "exact", head: true }),
  ]);

  const stores = (storeEngagement ?? []) as unknown as StoreEngagement[];
  const daily = (dailyAggregates ?? []) as unknown as DailyAggregate[];

  // Compute KPIs
  const totalUniqueUsers = new Set(stores.map((s) => s.total_unique_users)).size > 0
    ? stores.reduce((max, s) => Math.max(max, s.total_unique_users), 0)
    : 0;
  const totalSearches = stores.reduce((sum, s) => sum + s.search_impressions, 0);
  const totalDetailViews = stores.reduce((sum, s) => sum + s.detail_views, 0);
  const totalListAdds = stores.reduce((sum, s) => sum + s.list_adds, 0);

  const kpis = [
    {
      id: "kpi-events",
      label: "Total de eventos",
      value: (totalEvents ?? 0).toLocaleString("pt-BR"),
      helper: "todos os tempos",
      trend: "stable" as const,
    },
    {
      id: "kpi-searches",
      label: "Buscas com resultado",
      value: totalSearches.toLocaleString("pt-BR"),
      helper: "impressões em mercados",
      trend: "stable" as const,
    },
    {
      id: "kpi-details",
      label: "Detalhes de produto",
      value: totalDetailViews.toLocaleString("pt-BR"),
      helper: "visualizações de preço",
      trend: "stable" as const,
    },
    {
      id: "kpi-list-adds",
      label: "Adições à lista",
      value: totalListAdds.toLocaleString("pt-BR"),
      helper: "produtos adicionados",
      trend: "stable" as const,
    },
  ];

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Engajamento por Mercado"
        subtitle="Métricas de uso do app por loja — base para pitch B2B. &quot;Seu mercado foi buscado X vezes por Y usuários.&quot;"
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <KpiCard
            key={kpi.id}
            label={kpi.label}
            value={kpi.value}
            helper={kpi.helper}
            trend={kpi.trend}
          />
        ))}
      </div>

      {/* Daily trend */}
      <section className="rounded-2xl border border-[var(--color-line)] bg-white p-5 shadow-[var(--shadow-soft)]">
        <h2 className="text-lg font-semibold text-[var(--color-ink)]">
          Tendência diária (últimos 30 dias)
        </h2>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          Eventos por dia agrupados por tipo.
        </p>
        <DailyTrendChart data={daily} />
      </section>

      {/* Per-store engagement table */}
      <section className="rounded-2xl border border-[var(--color-line)] bg-white p-5 shadow-[var(--shadow-soft)]">
        <h2 className="text-lg font-semibold text-[var(--color-ink)]">
          Engajamento por mercado
        </h2>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          Dados que compõem o relatório B2B: &quot;Seu mercado foi buscado X vezes por Y usuários únicos este mês.&quot;
        </p>
        <StoreEngagementTable stores={stores} />
      </section>
    </div>
  );
}
