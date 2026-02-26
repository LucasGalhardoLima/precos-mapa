import { requirePermission } from "@/features/auth/session";
import { createClient } from "@/lib/supabase-server";
import { SectionHeader } from "@/features/panel/components/section-header";
import { KpiCard } from "@/features/panel/components/kpi-card";
import { formatCurrency } from "@/features/shared/format";
import {
  computeBenchmarks,
  computeOfferAnalytics,
  computeStoreRanking,
  computeComparisonCoverage,
  type RawPromotion,
} from "./dashboard-queries";
import { SectionOfferAnalytics } from "./section-offer-analytics";
import { SectionStoreRanking } from "./section-store-ranking";
import { SectionComparisonCoverage } from "./section-comparison-coverage";

export default async function SuperDashboardPage() {
  await requirePermission("dashboard:global:view");
  const supabase = await createClient();
  const now = new Date().toISOString();

  // KPIs + unified promotions query
  const [
    { count: activeStores },
    { count: activeConsumers },
    { count: activeOffers },
    { data: rawPromos },
  ] = await Promise.all([
    supabase.from("stores").select("id", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "consumer"),
    supabase
      .from("promotions")
      .select("id", { count: "exact", head: true })
      .eq("status", "active")
      .gt("end_date", now),
    supabase
      .from("promotions")
      .select("product_id, store_id, original_price, promo_price, source, end_date, product:products(name, category_id, category:categories(name)), store:stores(name, city, state)")
      .eq("status", "active")
      .gt("end_date", now),
  ]);

  const promos = (rawPromos ?? []) as unknown as RawPromotion[];

  const totalSavings = promos.reduce(
    (sum, p) => sum + (Number(p.original_price) - Number(p.promo_price)),
    0,
  );

  const kpis = [
    { id: "kpi-mercados", label: "Mercados ativos", value: String(activeStores ?? 0), helper: "total na plataforma", trend: "stable" as const },
    { id: "kpi-usuarios", label: "Consumidores ativos", value: String(activeConsumers ?? 0), helper: "total na plataforma", trend: "stable" as const },
    { id: "kpi-ofertas", label: "Ofertas ativas", value: String(activeOffers ?? 0), helper: "total na plataforma", trend: "stable" as const },
    { id: "kpi-economia", label: "Economia gerada", value: formatCurrency(totalSavings), helper: "soma dos descontos ativos", trend: "stable" as const },
  ];

  // Aggregate all sections from the single dataset
  const benchmarks = computeBenchmarks(promos);
  const offerAnalytics = computeOfferAnalytics(promos);
  const storeRanking = computeStoreRanking(promos);
  const comparisonCoverage = computeComparisonCoverage(promos);

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Dashboard Global"
        subtitle="Visão consolidada da plataforma para super admin com troca de contexto por mercado."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <KpiCard key={kpi.id} label={kpi.label} value={kpi.value} helper={kpi.helper} trend={kpi.trend} />
        ))}
      </div>

      {/* Benchmark */}
      <section className="rounded-2xl border border-[var(--color-line)] bg-white p-5 shadow-[var(--shadow-soft)]">
        <h2 className="text-lg font-semibold text-[var(--color-ink)]">Benchmark de preços por produto</h2>
        <p className="mt-1 text-sm text-[var(--color-muted)]">Comparativo entre melhor e pior preço monitorado na plataforma.</p>

        {benchmarks.length === 0 ? (
          <p className="mt-4 text-sm text-[var(--color-muted)]">Nenhum produto com preços comparáveis no momento.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[700px] text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.08em] text-[var(--color-muted)]">
                <tr>
                  <th className="pb-3">Produto</th>
                  <th className="pb-3">Melhor preço</th>
                  <th className="pb-3">Mercado</th>
                  <th className="pb-3">Pior preço</th>
                  <th className="pb-3">Mercado</th>
                </tr>
              </thead>
              <tbody>
                {benchmarks.map((item) => (
                  <tr key={item.productName} className="border-t border-[var(--color-line)]">
                    <td className="py-3 font-medium text-[var(--color-ink)]">{item.productName}</td>
                    <td className="py-3 text-emerald-700">{formatCurrency(item.bestPrice)}</td>
                    <td className="py-3 text-[var(--color-muted)]">{item.bestStore}</td>
                    <td className="py-3 text-rose-700">{formatCurrency(item.worstPrice)}</td>
                    <td className="py-3 text-[var(--color-muted)]">{item.worstStore}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Offer Analytics */}
      <SectionOfferAnalytics data={offerAnalytics} />

      {/* Store Ranking */}
      <SectionStoreRanking data={storeRanking} />

      {/* Comparison Coverage */}
      <SectionComparisonCoverage data={comparisonCoverage} />
    </div>
  );
}
