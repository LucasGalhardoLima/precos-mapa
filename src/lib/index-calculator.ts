import type { PriceIndex, PriceIndexCategory } from "@/features/shared/types";

/**
 * Format index value for display (e.g., "102,34")
 */
export function formatIndexValue(value: number): string {
  return value.toFixed(2).replace(".", ",");
}

/**
 * Format percentage change with sign (e.g., "+2,3%" or "-1,5%")
 */
export function formatChangePercent(value: number | null): string {
  if (value === null || value === undefined) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1).replace(".", ",")}%`;
}

/**
 * Get trend direction from change percent
 */
export function getTrend(value: number | null): "up" | "down" | "stable" {
  if (value === null || value === undefined) return "stable";
  if (value > 0.5) return "up";
  if (value < -0.5) return "down";
  return "stable";
}

/**
 * Get CSS color class for trend
 */
export function getTrendColor(trend: "up" | "down" | "stable"): string {
  switch (trend) {
    case "up":
      return "text-rose-600";
    case "down":
      return "text-emerald-600";
    case "stable":
      return "text-gray-500";
  }
}

/**
 * Get background color class for trend badge
 */
export function getTrendBgColor(trend: "up" | "down" | "stable"): string {
  switch (trend) {
    case "up":
      return "bg-rose-50 text-rose-700";
    case "down":
      return "bg-emerald-50 text-emerald-700";
    case "stable":
      return "bg-gray-50 text-gray-600";
  }
}

/**
 * Format a month period label in pt-BR (e.g., "Janeiro 2026")
 */
export function formatPeriodLabel(periodStart: string): string {
  const date = new Date(periodStart + "T00:00:00");
  return new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
  }).format(date);
}

/**
 * Format short month label (e.g., "Jan/26")
 */
export function formatShortMonth(periodStart: string): string {
  const date = new Date(periodStart + "T00:00:00");
  const month = new Intl.DateTimeFormat("pt-BR", { month: "short" }).format(date);
  const year = date.getFullYear().toString().slice(2);
  return `${month.replace(".", "")}/${year}`;
}

/**
 * Get quality score label and color
 */
export function getQualityLabel(score: number): {
  label: string;
  color: string;
  bgColor: string;
} {
  if (score >= 80) return { label: "Excelente", color: "text-emerald-700", bgColor: "bg-emerald-50" };
  if (score >= 70) return { label: "Bom", color: "text-blue-700", bgColor: "bg-blue-50" };
  if (score >= 50) return { label: "Regular", color: "text-amber-700", bgColor: "bg-amber-50" };
  return { label: "Insuficiente", color: "text-rose-700", bgColor: "bg-rose-50" };
}

/**
 * Get a human-readable summary of the index for social/SEO
 */
export function getIndexSummary(index: PriceIndex): string {
  const period = formatPeriodLabel(index.periodStart);
  const trend = getTrend(index.momChangePercent);

  if (trend === "up") {
    return `Em ${period}, os precos subiram ${formatChangePercent(index.momChangePercent)} em ${index.city}/${index.state}. O indice regional ficou em ${formatIndexValue(index.indexValue)}.`;
  }
  if (trend === "down") {
    return `Em ${period}, os precos cairam ${formatChangePercent(index.momChangePercent)} em ${index.city}/${index.state}. O indice regional ficou em ${formatIndexValue(index.indexValue)}.`;
  }
  return `Em ${period}, os precos se mantiveram estaveis em ${index.city}/${index.state}. O indice regional ficou em ${formatIndexValue(index.indexValue)}.`;
}

/**
 * Convert DB row (snake_case) to PriceIndex type (camelCase)
 */
export function mapDbToIndex(row: Record<string, unknown>): PriceIndex {
  return {
    id: row.id as string,
    city: row.city as string,
    state: row.state as string,
    periodStart: row.period_start as string,
    periodEnd: row.period_end as string,
    indexValue: Number(row.index_value),
    momChangePercent: row.mom_change_percent !== null ? Number(row.mom_change_percent) : null,
    yoyChangePercent: row.yoy_change_percent !== null ? Number(row.yoy_change_percent) : null,
    dataQualityScore: Number(row.data_quality_score),
    productCount: Number(row.product_count),
    storeCount: Number(row.store_count),
    snapshotCount: Number(row.snapshot_count),
    status: row.status as PriceIndex["status"],
    publishedAt: row.published_at as string | null,
  };
}

/**
 * Convert DB row to PriceIndexCategory
 */
export function mapDbToCategory(row: Record<string, unknown>): PriceIndexCategory {
  return {
    id: row.id as string,
    indexId: row.index_id as string,
    categoryId: row.category_id as string,
    categoryName: (row.category as { name?: string } | null)?.name,
    avgPrice: Number(row.avg_price),
    minPrice: Number(row.min_price),
    maxPrice: Number(row.max_price),
    productCount: Number(row.product_count),
    momChangePercent: row.mom_change_percent !== null ? Number(row.mom_change_percent) : null,
    weight: Number(row.weight),
  };
}
