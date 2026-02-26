import { requirePermission } from "@/features/auth/session";
import { createClient } from "@/lib/supabase-server";
import { SectionHeader } from "@/features/panel/components/section-header";
import {
  formatIndexValue,
  formatChangePercent,
  formatPeriodLabel,
  getTrend,
  getTrendBgColor,
  getQualityLabel,
  mapDbToIndex,
} from "@/lib/index-calculator";
import { IndexAdminActions } from "./index-admin-actions";
import { GenerateIndexButton } from "./generate-index-button";

export default async function SuperIndexPage() {
  await requirePermission("moderation:manage");
  const supabase = await createClient();

  const { data: indexRows } = await supabase
    .from("price_indices")
    .select("*")
    .order("period_start", { ascending: false })
    .limit(24);

  const indices = (indexRows ?? []).map(mapDbToIndex);

  const drafts = indices.filter((i) => i.status === "draft");
  const published = indices.filter((i) => i.status === "published");
  const archived = indices.filter((i) => i.status === "archived");

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Indice de Precos"
        subtitle="Gerencie a publicacao dos indices mensais de precos regionais."
        action={<GenerateIndexButton />}
      />

      {/* Drafts requiring attention */}
      {drafts.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.1em] text-amber-600">
            Rascunhos ({drafts.length})
          </h2>
          <div className="space-y-3">
            {drafts.map((idx) => {
              const quality = getQualityLabel(idx.dataQualityScore);
              return (
                <article
                  key={idx.id}
                  className="rounded-2xl border border-amber-200 bg-white p-5 shadow-[var(--shadow-soft)]"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-[var(--color-ink)]">
                        {formatPeriodLabel(idx.periodStart)}
                      </p>
                      <p className="text-sm text-[var(--color-muted)]">
                        {idx.city}/{idx.state}
                      </p>
                    </div>
                    <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">
                      Rascunho
                    </span>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-4 text-sm">
                    <div>
                      <span className="text-[var(--color-muted)]">Indice: </span>
                      <span className="font-semibold text-[var(--color-ink)]">
                        {formatIndexValue(idx.indexValue)}
                      </span>
                    </div>
                    {idx.momChangePercent !== null && (
                      <div>
                        <span className="text-[var(--color-muted)]">MoM: </span>
                        <span className={`font-semibold ${getTrendBgColor(getTrend(idx.momChangePercent))} rounded px-1.5`}>
                          {formatChangePercent(idx.momChangePercent)}
                        </span>
                      </div>
                    )}
                    <div>
                      <span className="text-[var(--color-muted)]">Produtos: </span>
                      <span className="font-medium">{idx.productCount}</span>
                    </div>
                    <div>
                      <span className="text-[var(--color-muted)]">Mercados: </span>
                      <span className="font-medium">{idx.storeCount}</span>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between">
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${quality.bgColor} ${quality.color}`}>
                      Qualidade: {quality.label} ({idx.dataQualityScore}/100)
                    </span>
                    <IndexAdminActions indexId={idx.id} currentStatus={idx.status} periodStart={idx.periodStart} city={idx.city} state={idx.state} />
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {/* Published */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.1em] text-emerald-600">
          Publicados ({published.length})
        </h2>
        {published.length === 0 ? (
          <div className="rounded-2xl border border-[var(--color-line)] bg-white p-8 text-center shadow-[var(--shadow-soft)]">
            <p className="text-sm text-[var(--color-muted)]">Nenhum indice publicado ainda.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {published.map((idx) => {
              const trend = getTrend(idx.momChangePercent);
              return (
                <article
                  key={idx.id}
                  className="rounded-2xl border border-[var(--color-line)] bg-white p-5 shadow-[var(--shadow-soft)]"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div>
                        <p className="font-semibold text-[var(--color-ink)]">
                          {formatPeriodLabel(idx.periodStart)}
                        </p>
                        <p className="text-xs text-[var(--color-muted)]">{idx.city}/{idx.state}</p>
                      </div>
                      <span className="text-2xl font-semibold text-[var(--color-ink)]">
                        {formatIndexValue(idx.indexValue)}
                      </span>
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${getTrendBgColor(trend)}`}>
                        {formatChangePercent(idx.momChangePercent)}
                      </span>
                    </div>
                    <IndexAdminActions indexId={idx.id} currentStatus={idx.status} periodStart={idx.periodStart} city={idx.city} state={idx.state} />
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* Archived */}
      {archived.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.1em] text-[var(--color-muted)]">
            Arquivados ({archived.length})
          </h2>
          <div className="space-y-2">
            {archived.map((idx) => (
              <article
                key={idx.id}
                className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] p-4"
              >
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[var(--color-muted)]">
                    {formatPeriodLabel(idx.periodStart)} — {idx.city}/{idx.state}
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-[var(--color-muted)]">
                      {formatIndexValue(idx.indexValue)}
                    </span>
                    <IndexAdminActions indexId={idx.id} currentStatus={idx.status} periodStart={idx.periodStart} city={idx.city} state={idx.state} />
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
