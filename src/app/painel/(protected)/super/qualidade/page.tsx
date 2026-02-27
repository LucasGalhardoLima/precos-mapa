import { requirePermission } from "@/features/auth/session";
import { createClient } from "@/lib/supabase-server";
import { SectionHeader } from "@/features/panel/components/section-header";
import { formatCurrency } from "@/features/shared/format";
import { QualityActions } from "./quality-actions";

const FLAG_TYPE_LABELS: Record<string, string> = {
  outlier_high: "Preco muito alto",
  outlier_low: "Preco muito baixo",
  stale: "Dados desatualizados",
  missing_data: "Dados ausentes",
  suspicious_pattern: "Padrao suspeito",
};

const SEVERITY_STYLES: Record<string, string> = {
  critical: "bg-rose-100 text-rose-700",
  high: "bg-orange-100 text-orange-700",
  medium: "bg-amber-100 text-amber-700",
  low: "bg-gray-100 text-gray-600",
};

export default async function SuperQualityPage() {
  await requirePermission("moderation:manage");
  const supabase = await createClient();

  // Unresolved flags
  const { data: flagRows } = await supabase
    .from("price_quality_flags")
    .select("*, product:products(name), store:stores(name)")
    .eq("is_resolved", false)
    .order("created_at", { ascending: false })
    .limit(100);

  const flags = (flagRows ?? []).map((f) => {
    const product = Array.isArray(f.product) ? f.product[0] : f.product;
    const store = Array.isArray(f.store) ? f.store[0] : f.store;
    return {
    id: f.id,
    productId: f.product_id,
    productName: product?.name ?? "Produto",
    storeId: f.store_id,
    storeName: store?.name,
    flagType: f.flag_type,
    severity: f.severity,
    detail: f.detail,
    referenceValue: f.reference_value,
    actualValue: f.actual_value,
    createdAt: f.created_at,
  };});

  // Data coverage stats
  const { count: totalProducts } = await supabase
    .from("products")
    .select("id", { count: "exact", head: true });

  const { count: productsWithPromos } = await supabase
    .from("promotions")
    .select("product_id", { count: "exact", head: true })
    .eq("status", "active")
    .gt("end_date", new Date().toISOString());

  const coverage = totalProducts
    ? Math.round(((productsWithPromos ?? 0) / totalProducts) * 100)
    : 0;

  // Severity breakdown
  const criticalCount = flags.filter((f) => f.severity === "critical").length;
  const highCount = flags.filter((f) => f.severity === "high").length;
  const mediumCount = flags.filter((f) => f.severity === "medium").length;
  const lowCount = flags.filter((f) => f.severity === "low").length;

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Qualidade de Dados"
        subtitle="Monitore a integridade dos dados de precos e resolva anomalias detectadas."
      />

      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-[var(--color-line)] bg-white p-5 shadow-[var(--shadow-soft)]">
          <p className="text-xs uppercase tracking-[0.1em] text-[var(--color-muted)]">
            Cobertura de Dados
          </p>
          <p className="mt-2 text-3xl font-semibold text-[var(--color-ink)]">{coverage}%</p>
          <p className="mt-1 text-xs text-[var(--color-muted)]">
            {productsWithPromos ?? 0} de {totalProducts ?? 0} produtos com ofertas ativas
          </p>
        </div>

        <div className="rounded-2xl border border-[var(--color-line)] bg-white p-5 shadow-[var(--shadow-soft)]">
          <p className="text-xs uppercase tracking-[0.1em] text-[var(--color-muted)]">
            Flags Nao Resolvidas
          </p>
          <p className="mt-2 text-3xl font-semibold text-[var(--color-ink)]">{flags.length}</p>
          <p className="mt-1 text-xs text-[var(--color-muted)]">anomalias pendentes de revisao</p>
        </div>

        <div className="rounded-2xl border border-rose-200 bg-white p-5 shadow-[var(--shadow-soft)]">
          <p className="text-xs uppercase tracking-[0.1em] text-rose-600">Criticas + Altas</p>
          <p className="mt-2 text-3xl font-semibold text-rose-700">{criticalCount + highCount}</p>
          <p className="mt-1 text-xs text-[var(--color-muted)]">
            {criticalCount} criticas, {highCount} altas
          </p>
        </div>

        <div className="rounded-2xl border border-[var(--color-line)] bg-white p-5 shadow-[var(--shadow-soft)]">
          <p className="text-xs uppercase tracking-[0.1em] text-[var(--color-muted)]">
            Media + Baixa
          </p>
          <p className="mt-2 text-3xl font-semibold text-[var(--color-ink)]">{mediumCount + lowCount}</p>
          <p className="mt-1 text-xs text-[var(--color-muted)]">
            {mediumCount} medias, {lowCount} baixas
          </p>
        </div>
      </div>

      {/* Flag list */}
      {flags.length === 0 ? (
        <div className="rounded-2xl border border-[var(--color-line)] bg-white p-8 text-center shadow-[var(--shadow-soft)]">
          <p className="text-sm text-[var(--color-muted)]">
            Nenhuma anomalia detectada. Os dados estao em boa condicao.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {flags.map((flag) => (
            <article
              key={flag.id}
              className="rounded-2xl border border-[var(--color-line)] bg-white p-5 shadow-[var(--shadow-soft)]"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-[var(--color-ink)]">{flag.productName}</p>
                  {flag.storeName && (
                    <p className="text-sm text-[var(--color-muted)]">{flag.storeName}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${SEVERITY_STYLES[flag.severity] ?? SEVERITY_STYLES.low}`}>
                    {flag.severity === "critical" ? "Critica" : flag.severity === "high" ? "Alta" : flag.severity === "medium" ? "Media" : "Baixa"}
                  </span>
                  <span className="rounded-full bg-[var(--color-surface-strong)] px-2.5 py-1 text-xs font-medium text-[var(--color-muted)]">
                    {FLAG_TYPE_LABELS[flag.flagType] ?? flag.flagType}
                  </span>
                </div>
              </div>

              <p className="mt-2 text-sm text-[var(--color-muted)]">{flag.detail}</p>

              {(flag.referenceValue !== null || flag.actualValue !== null) && (
                <div className="mt-2 flex gap-4 text-sm">
                  {flag.referenceValue !== null && (
                    <div>
                      <span className="text-[var(--color-muted)]">Referencia: </span>
                      <span className="font-medium">{formatCurrency(flag.referenceValue)}</span>
                    </div>
                  )}
                  {flag.actualValue !== null && (
                    <div>
                      <span className="text-[var(--color-muted)]">Encontrado: </span>
                      <span className="font-semibold text-rose-600">
                        {formatCurrency(flag.actualValue)}
                      </span>
                    </div>
                  )}
                </div>
              )}

              <div className="mt-3 flex items-center justify-between">
                <p className="text-xs text-[var(--color-muted)]">
                  {new Intl.DateTimeFormat("pt-BR", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  }).format(new Date(flag.createdAt))}
                </p>
                <QualityActions flagId={flag.id} />
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
