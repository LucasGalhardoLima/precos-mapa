import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission } from "@/features/auth/session";
import { createClient } from "@/lib/supabase-server";
import {
  formatIndexValue,
  formatChangePercent,
  formatPeriodLabel,
  getTrend,
  getTrendBgColor,
  getQualityLabel,
  mapDbToIndex,
  mapDbToCategory,
} from "@/lib/index-calculator";
import type { PriceIndexProduct } from "@/features/shared/types";

function mapDbToProduct(row: Record<string, unknown>): PriceIndexProduct {
  return {
    id: row.id as string,
    indexId: row.index_id as string,
    productId: row.product_id as string,
    productName: (row.product as { name?: string } | null)?.name,
    categoryName: (row.product_category as { category?: { name?: string } | null } | null)?.category?.name,
    avgPrice: Number(row.avg_price),
    minPrice: Number(row.min_price),
    maxPrice: Number(row.max_price),
    snapshotDays: Number(row.snapshot_days),
    momChangePercent: row.mom_change_percent !== null ? Number(row.mom_change_percent) : null,
  };
}

export default async function IndexDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("moderation:manage");
  const { id } = await params;
  const supabase = await createClient();

  // Fetch index
  const { data: indexRow, error } = await supabase
    .from("price_indices")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !indexRow) notFound();

  const idx = mapDbToIndex(indexRow as Record<string, unknown>);
  const quality = getQualityLabel(idx.dataQualityScore);
  const trend = getTrend(idx.momChangePercent);

  // Fetch categories with names
  const { data: categoryRows } = await supabase
    .from("price_index_categories")
    .select("*, category:categories(name)")
    .eq("index_id", id)
    .order("avg_price", { ascending: false });

  const categories = (categoryRows ?? []).map((r: Record<string, unknown>) => mapDbToCategory(r));

  // Fetch top 10 rising products
  const { data: risingRows } = await supabase
    .from("price_index_products")
    .select("*, product:products(name, category_id), product_category:products(category:categories(name))")
    .eq("index_id", id)
    .not("mom_change_percent", "is", null)
    .order("mom_change_percent", { ascending: false })
    .limit(10);

  const risingProducts = (risingRows ?? []).map((r: Record<string, unknown>) => mapDbToProduct(r));

  // Fetch top 10 falling products
  const { data: fallingRows } = await supabase
    .from("price_index_products")
    .select("*, product:products(name, category_id), product_category:products(category:categories(name))")
    .eq("index_id", id)
    .not("mom_change_percent", "is", null)
    .order("mom_change_percent", { ascending: true })
    .limit(10);

  const fallingProducts = (fallingRows ?? []).map((r: Record<string, unknown>) => mapDbToProduct(r));

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href="/painel/super/indice"
        className="inline-flex items-center gap-1 text-sm text-[var(--color-muted)] transition hover:text-[var(--color-ink)]"
      >
        &larr; Voltar para Indices
      </Link>

      {/* Header */}
      <div className="rounded-2xl border border-[var(--color-line)] bg-white p-6 shadow-[var(--shadow-soft)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-[var(--color-ink)]">
              {formatPeriodLabel(idx.periodStart)}
            </h1>
            <p className="text-sm text-[var(--color-muted)]">{idx.city}/{idx.state}</p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
            idx.status === "draft" ? "bg-amber-100 text-amber-700" :
            idx.status === "published" ? "bg-emerald-100 text-emerald-700" :
            "bg-gray-100 text-gray-600"
          }`}>
            {idx.status === "draft" ? "Rascunho" : idx.status === "published" ? "Publicado" : "Arquivado"}
          </span>
        </div>

        <div className="mt-4 flex flex-wrap gap-6 text-sm">
          <div>
            <span className="text-[var(--color-muted)]">Indice</span>
            <p className="text-2xl font-semibold text-[var(--color-ink)]">{formatIndexValue(idx.indexValue)}</p>
          </div>
          {idx.momChangePercent !== null && (
            <div>
              <span className="text-[var(--color-muted)]">MoM</span>
              <p className={`text-lg font-semibold ${getTrendBgColor(trend)} rounded px-2 py-0.5 mt-0.5`}>
                {formatChangePercent(idx.momChangePercent)}
              </p>
            </div>
          )}
          {idx.yoyChangePercent !== null && (
            <div>
              <span className="text-[var(--color-muted)]">YoY</span>
              <p className={`text-lg font-semibold ${getTrendBgColor(getTrend(idx.yoyChangePercent))} rounded px-2 py-0.5 mt-0.5`}>
                {formatChangePercent(idx.yoyChangePercent)}
              </p>
            </div>
          )}
          <div>
            <span className="text-[var(--color-muted)]">Produtos</span>
            <p className="text-lg font-semibold">{idx.productCount}</p>
          </div>
          <div>
            <span className="text-[var(--color-muted)]">Mercados</span>
            <p className="text-lg font-semibold">{idx.storeCount}</p>
          </div>
          <div>
            <span className="text-[var(--color-muted)]">Snapshots</span>
            <p className="text-lg font-semibold">{idx.snapshotCount}</p>
          </div>
          <div>
            <span className="text-[var(--color-muted)]">Qualidade</span>
            <p className={`text-sm font-semibold rounded-full px-3 py-1 mt-0.5 ${quality.bgColor} ${quality.color}`}>
              {quality.label} ({idx.dataQualityScore}/100)
            </p>
          </div>
        </div>
      </div>

      {/* Categories */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.1em] text-[var(--color-ink)]">
          Categorias ({categories.length})
        </h2>
        <div className="overflow-x-auto rounded-2xl border border-[var(--color-line)] bg-white shadow-[var(--shadow-soft)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-line)] text-left text-xs uppercase tracking-wider text-[var(--color-muted)]">
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3 text-right">Preco Medio</th>
                <th className="px-4 py-3 text-right">Min</th>
                <th className="px-4 py-3 text-right">Max</th>
                <th className="px-4 py-3 text-right">Produtos</th>
                <th className="px-4 py-3 text-right">MoM%</th>
                <th className="px-4 py-3 text-right">Peso</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((cat) => (
                <tr key={cat.id} className="border-b border-[var(--color-line)] last:border-0">
                  <td className="px-4 py-3 font-medium text-[var(--color-ink)]">{cat.categoryName ?? cat.categoryId}</td>
                  <td className="px-4 py-3 text-right">R$ {cat.avgPrice.toFixed(2).replace(".", ",")}</td>
                  <td className="px-4 py-3 text-right">R$ {cat.minPrice.toFixed(2).replace(".", ",")}</td>
                  <td className="px-4 py-3 text-right">R$ {cat.maxPrice.toFixed(2).replace(".", ",")}</td>
                  <td className="px-4 py-3 text-right">{cat.productCount}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={`rounded px-1.5 py-0.5 text-xs font-semibold ${getTrendBgColor(getTrend(cat.momChangePercent))}`}>
                      {formatChangePercent(cat.momChangePercent)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">{(cat.weight * 100).toFixed(1)}%</td>
                </tr>
              ))}
              {categories.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-[var(--color-muted)]">
                    Nenhuma categoria encontrada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Top Rising */}
      {risingProducts.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.1em] text-rose-600">
            Maiores Altas
          </h2>
          <div className="overflow-x-auto rounded-2xl border border-[var(--color-line)] bg-white shadow-[var(--shadow-soft)]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-line)] text-left text-xs uppercase tracking-wider text-[var(--color-muted)]">
                  <th className="px-4 py-3">Produto</th>
                  <th className="px-4 py-3">Categoria</th>
                  <th className="px-4 py-3 text-right">Preco Medio</th>
                  <th className="px-4 py-3 text-right">MoM%</th>
                </tr>
              </thead>
              <tbody>
                {risingProducts.map((p) => (
                  <tr key={p.id} className="border-b border-[var(--color-line)] last:border-0">
                    <td className="px-4 py-3 font-medium text-[var(--color-ink)]">{p.productName ?? p.productId}</td>
                    <td className="px-4 py-3 text-[var(--color-muted)]">{p.categoryName ?? "—"}</td>
                    <td className="px-4 py-3 text-right">R$ {p.avgPrice.toFixed(2).replace(".", ",")}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`rounded px-1.5 py-0.5 text-xs font-semibold ${getTrendBgColor(getTrend(p.momChangePercent))}`}>
                        {formatChangePercent(p.momChangePercent)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Top Falling */}
      {fallingProducts.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.1em] text-emerald-600">
            Maiores Baixas
          </h2>
          <div className="overflow-x-auto rounded-2xl border border-[var(--color-line)] bg-white shadow-[var(--shadow-soft)]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-line)] text-left text-xs uppercase tracking-wider text-[var(--color-muted)]">
                  <th className="px-4 py-3">Produto</th>
                  <th className="px-4 py-3">Categoria</th>
                  <th className="px-4 py-3 text-right">Preco Medio</th>
                  <th className="px-4 py-3 text-right">MoM%</th>
                </tr>
              </thead>
              <tbody>
                {fallingProducts.map((p) => (
                  <tr key={p.id} className="border-b border-[var(--color-line)] last:border-0">
                    <td className="px-4 py-3 font-medium text-[var(--color-ink)]">{p.productName ?? p.productId}</td>
                    <td className="px-4 py-3 text-[var(--color-muted)]">{p.categoryName ?? "—"}</td>
                    <td className="px-4 py-3 text-right">R$ {p.avgPrice.toFixed(2).replace(".", ",")}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`rounded px-1.5 py-0.5 text-xs font-semibold ${getTrendBgColor(getTrend(p.momChangePercent))}`}>
                        {formatChangePercent(p.momChangePercent)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
