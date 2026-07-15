import { requirePermission } from "@/features/auth/session";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { SectionHeader } from "@/features/panel/components/section-header";
import { KpiCard } from "@/features/panel/components/kpi-card";
import { StoreEngagementTable } from "./store-engagement-table";
import { DailyTrendChart } from "./daily-trend-chart";
import { ProductEngagementTable } from "./product-engagement-table";
import { GeoHotzoneTable } from "./geo-hotzone-table";
import { UserEngagementTable } from "./user-engagement-table";
import { DateRangeSelector } from "./date-range-selector";
import {
  getProductEngagement,
  getGeoHotZones,
  getUserEngagement,
  mapStoreRows,
  resolveDateRange,
  type StoreEngagementRow,
} from "./engajamento-queries";

interface DailyAggregate {
  event_date: string;
  event_type: string;
  event_count: number;
  unique_users: number;
}

interface PageProps {
  searchParams: Promise<{ range?: string }>;
}

export default async function EngagementDashboardPage({ searchParams }: PageProps) {
  await requirePermission("dashboard:global:view");
  const supabase = getSupabaseAdmin();
  const params = await searchParams;
  const { startDate, endDate } = resolveDateRange(params.range);
  const trendWindowStart = new Date(Date.parse(endDate) - 30 * 86400000).toISOString().split("T")[0];

  const [
    { data: storeEngagement },
    { data: dailyAggregates },
    { count: totalEvents },
    productRanking,
    geoRanking,
    userRanking,
  ] = await Promise.all([
    supabase
      .from("store_engagement_summary")
      .select("*")
      .order("total_events", { ascending: false }),
    supabase
      .from("analytics_aggregate_summary")
      .select("*")
      .gte("event_date", trendWindowStart)
      .order("event_date", { ascending: true }),
    supabase
      .from("analytics_events")
      .select("id", { count: "exact", head: true }),
    getProductEngagement(supabase, startDate, endDate),
    getGeoHotZones(supabase, startDate, endDate),
    getUserEngagement(supabase, startDate, endDate),
  ]);

  const rawStores = (storeEngagement ?? []) as unknown as StoreEngagementRow[];
  const stores = mapStoreRows(rawStores);
  const daily = (dailyAggregates ?? []) as unknown as DailyAggregate[];

  // Compute KPIs
  const totalUniqueUsers = rawStores.reduce((max, s) => Math.max(max, s.total_unique_users), 0);
  const totalSearches = rawStores.reduce((sum, s) => sum + s.search_impressions, 0);
  const totalDetailViews = rawStores.reduce((sum, s) => sum + s.detail_views, 0);
  const totalListAdds = rawStores.reduce((sum, s) => sum + s.list_adds, 0);

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
      <div className="flex flex-wrap items-center justify-between gap-4">
        <SectionHeader
          title="Engajamento por Mercado"
          subtitle="Métricas de uso do app por loja — base para pitch B2B. &quot;Seu mercado foi buscado X vezes por Y usuários.&quot;"
        />
        <DateRangeSelector />
      </div>

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
          Esta tabela mostra dados de todos os tempos (não filtrada pelo período selecionado acima).
        </p>
        <StoreEngagementTable stores={stores} />
      </section>

      {/* Per-product engagement ranking */}
      <section className="rounded-2xl border border-[var(--color-line)] bg-white p-5 shadow-[var(--shadow-soft)]">
        <h2 className="text-lg font-semibold text-[var(--color-ink)]">
          Produtos mais engajados
        </h2>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          Ranking de produtos por buscas e visualizações de detalhe no período selecionado.
        </p>
        <ProductEngagementTable products={productRanking} />
      </section>

      {/* Geographic hot zones */}
      <section className="rounded-2xl border border-[var(--color-line)] bg-white p-5 shadow-[var(--shadow-soft)]">
        <h2 className="text-lg font-semibold text-[var(--color-ink)]">
          Áreas de maior engajamento
        </h2>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          Onde o engajamento está concentrado no período selecionado.
        </p>
        <GeoHotzoneTable geo={geoRanking} />
      </section>

      {/* Per-user engagement leaderboard + drill-down */}
      <section className="rounded-2xl border border-[var(--color-line)] bg-white p-5 shadow-[var(--shadow-soft)]">
        <h2 className="text-lg font-semibold text-[var(--color-ink)]">
          Engajamento por usuário
        </h2>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          Ranking de usuários por volume de eventos no período selecionado, com o produto, mercado e cidade mais frequentes de cada um.
        </p>
        <UserEngagementTable users={userRanking} startDate={startDate} endDate={endDate} />
      </section>
    </div>
  );
}
