import { requireSessionContext } from "@/features/auth/session";
import { createClient } from "@/lib/supabase-server";
import { SectionHeader } from "@/features/panel/components/section-header";
import { EngagementRankingTable } from "@/features/shared/engagement-ranking-table";
import { DateRangeSelector } from "../super/engajamento/date-range-selector";
import { resolveDateRange } from "../super/engajamento/engajamento-queries";
import { getBusinessStoreEngagement } from "./analytics-queries";

interface PageProps {
  searchParams: Promise<{ range?: string }>;
}

export default async function MarketAnalyticsPage({ searchParams }: PageProps) {
  const session = await requireSessionContext();
  const params = await searchParams;
  const { startDate, endDate } = resolveDateRange(params.range);
  const storeId = session.currentMarketId;

  if (!storeId) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-sm text-[var(--color-muted)]">Nenhuma loja vinculada a esta conta.</p>
      </div>
    );
  }

  const supabase = await createClient();
  const engagement = await getBusinessStoreEngagement(supabase, storeId, startDate, endDate);
  const rows = engagement ? [engagement] : [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <SectionHeader
          title="Analytics"
          subtitle={engagement ? `Leitura de engajamento real do mercado ${engagement.label}.` : "Leitura de engajamento do seu mercado."}
        />
        <DateRangeSelector />
      </div>

      <section className="rounded-2xl border border-[var(--color-line)] bg-white p-5 shadow-[var(--shadow-soft)]">
        <h2 className="text-lg font-semibold text-[var(--color-ink)]">Engajamento no período</h2>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          Buscas e visualizações de detalhe reais para o seu mercado, no período selecionado.
        </p>
        <EngagementRankingTable
          rows={rows}
          entityColumnLabel="Mercado"
          emptyStateMessage="Sem dados ainda. Os números aparecerão conforme os consumidores interagirem com o seu mercado no app."
          footerNote="Números entre parênteses = usuários únicos."
        />
      </section>
    </div>
  );
}
