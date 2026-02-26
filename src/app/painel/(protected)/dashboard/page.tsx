import Link from "next/link";
import { redirect } from "next/navigation";
import { BellRing, PlusCircle, ScanLine } from "lucide-react";
import { KpiCard } from "@/features/panel/components/kpi-card";
import { SectionHeader } from "@/features/panel/components/section-header";
import { requireSessionContext } from "@/features/auth/session";
import { createClient } from "@/lib/supabase-server";
import { formatCurrency, formatDateLabel } from "@/features/shared/format";

function getMonthStart(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
}

export default async function MarketDashboardPage() {
  const session = await requireSessionContext();

  if (session.role === "super_admin") {
    redirect("/painel/super/dashboard");
  }

  const supabase = await createClient();
  const storeId = session.currentMarketId;

  if (!storeId) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-sm text-[var(--color-muted)]">Nenhuma loja vinculada a esta conta.</p>
      </div>
    );
  }

  const [storeRes, activeRes, monthlyRes, recentRes] = await Promise.all([
    supabase.from("stores").select("name, b2b_plan").eq("id", storeId).single(),
    supabase
      .from("promotions")
      .select("*", { count: "exact", head: true })
      .eq("store_id", storeId)
      .eq("status", "active"),
    supabase
      .from("promotions")
      .select("*", { count: "exact", head: true })
      .eq("store_id", storeId)
      .gte("created_at", getMonthStart()),
    supabase
      .from("promotions")
      .select("id, promo_price, original_price, end_date, source, product:products(name)")
      .eq("store_id", storeId)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const storeName = storeRes.data?.name ?? "Sua loja";
  const activeCount = activeRes.count ?? 0;
  const monthlyCount = monthlyRes.count ?? 0;
  const recentOffers = recentRes.data ?? [];

  const kpis = [
    { id: "kpi-active", label: "Ofertas ativas", value: String(activeCount), helper: "em exibicao para consumidores" },
    { id: "kpi-monthly", label: "Ofertas este mes", value: String(monthlyCount), helper: "publicadas desde dia 1" },
    { id: "kpi-views", label: "Visualizacoes", value: "--", helper: "em breve" },
    { id: "kpi-clicks", label: "Cliques", value: "--", helper: "em breve" },
  ];

  return (
    <div className="space-y-6">
      <SectionHeader
        title={`Dashboard ${storeName}`}
        subtitle="Acompanhe performance, ofertas e resultados de publicacao."
        action={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/painel/ofertas/nova"
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-[var(--color-line)] bg-white px-3 py-2 text-sm font-medium text-[var(--color-ink)] transition hover:border-[var(--color-primary)]"
            >
              <PlusCircle className="h-4 w-4" />
              Criar oferta
            </Link>
            <Link
              href="/painel/importador-ia"
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[var(--color-primary)] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[var(--color-primary-deep)]"
            >
              <ScanLine className="h-4 w-4" />
              Abrir importador IA
            </Link>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <KpiCard key={kpi.id} label={kpi.label} value={kpi.value} helper={kpi.helper} trend="up" />
        ))}
      </div>

      <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <article className="rounded-2xl border border-[var(--color-line)] bg-white p-5 shadow-[var(--shadow-soft)]">
          <h2 className="text-lg font-semibold text-[var(--color-ink)]">Ofertas recentes</h2>
          <div className="mt-4 space-y-3">
            {recentOffers.map((offer: { id: string; promo_price: number; original_price: number; end_date: string; source: string; product: { name: string } | null }) => (
              <div key={offer.id} className="flex items-center justify-between rounded-xl border border-[var(--color-line)] px-4 py-3">
                <div>
                  <p className="font-medium text-[var(--color-ink)]">{offer.product?.name ?? "Produto"}</p>
                  <p className="text-xs text-[var(--color-muted)]">
                    Ate {formatDateLabel(offer.end_date)} · {offer.source === "importador_ia" ? "Importador IA" : "Manual"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xl font-semibold text-[var(--color-primary-deep)]">{formatCurrency(offer.promo_price)}</p>
                  <p className="text-xs text-[var(--color-muted)] line-through">{formatCurrency(offer.original_price)}</p>
                </div>
              </div>
            ))}
            {recentOffers.length === 0 && (
              <p className="py-4 text-center text-sm text-[var(--color-muted)]">Nenhuma oferta ativa</p>
            )}
          </div>
        </article>

        <article className="rounded-2xl border border-[var(--color-line)] bg-white p-5 shadow-[var(--shadow-soft)]">
          <h2 className="text-lg font-semibold text-[var(--color-ink)]">Alertas inteligentes</h2>
          <p className="mt-1 text-sm text-[var(--color-muted)]">Insights automaticos para acoes rapidas da loja.</p>

          <div className="mt-4 space-y-3">
            <div className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">
              <p className="font-semibold">Suas ofertas estao no ar</p>
              <p className="mt-1">{activeCount} ofertas ativas visiveis para consumidores na regiao.</p>
            </div>
          </div>

          <button className="mt-5 inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-[var(--color-line)] px-3 py-2 text-sm font-medium text-[var(--color-ink)] transition hover:border-[var(--color-primary)]">
            <BellRing className="h-4 w-4" />
            Ajustar alertas
          </button>
        </article>
      </section>
    </div>
  );
}
