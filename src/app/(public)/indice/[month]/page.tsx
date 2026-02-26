import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase-server";
import { mapDbToIndex, mapDbToCategory, formatPeriodLabel, getIndexSummary } from "@/lib/index-calculator";
import type { PriceIndexProduct } from "@/features/shared/types";
import { IndexHero } from "../components/index-hero";
import { CategoryBreakdown } from "../components/category-breakdown";
import { PriceMovers } from "../components/price-movers";

interface Props {
  params: Promise<{ month: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { month } = await params;
  const periodStart = `${month}-01`;

  const supabase = await createClient();
  const { data } = await supabase
    .from("price_indices")
    .select("*")
    .eq("status", "published")
    .eq("period_start", periodStart)
    .limit(1)
    .single();

  if (!data) {
    return { title: "Indice nao encontrado | PrecoMapa" };
  }

  const index = mapDbToIndex(data);
  const period = formatPeriodLabel(index.periodStart);

  return {
    title: `Indice de Precos de ${index.city} - ${period} | PrecoMapa`,
    description: getIndexSummary(index),
    openGraph: {
      title: `Indice de Precos de ${index.city} - ${period}`,
      description: getIndexSummary(index),
      type: "website",
      siteName: "PrecoMapa",
    },
  };
}

export default async function HistoricalIndexPage({ params }: Props) {
  const { month } = await params;
  const periodStart = `${month}-01`;

  const supabase = await createClient();

  const { data: indexRow } = await supabase
    .from("price_indices")
    .select("*")
    .eq("status", "published")
    .eq("period_start", periodStart)
    .limit(1)
    .single();

  if (!indexRow) notFound();

  const index = mapDbToIndex(indexRow);

  // Category breakdown
  const { data: catRows } = await supabase
    .from("price_index_categories")
    .select("*, category:categories(name)")
    .eq("index_id", index.id)
    .order("weight", { ascending: false });

  const categories = (catRows ?? []).map(mapDbToCategory);

  // Top movers
  const { data: riserRows } = await supabase.rpc("get_price_movers", {
    p_index_id: index.id,
    p_direction: "up",
    p_limit: 10,
  });

  const { data: fallerRows } = await supabase.rpc("get_price_movers", {
    p_index_id: index.id,
    p_direction: "down",
    p_limit: 10,
  });

  const mapMover = (r: Record<string, unknown>): PriceIndexProduct => ({
    id: r.product_id as string,
    indexId: index.id,
    productId: r.product_id as string,
    productName: r.product_name as string,
    categoryName: r.category_name as string,
    avgPrice: Number(r.avg_price),
    minPrice: Number(r.min_price),
    maxPrice: Number(r.max_price),
    snapshotDays: 0,
    momChangePercent: Number(r.mom_change_percent),
  });

  const risers = (riserRows ?? []).map(mapMover);
  const fallers = (fallerRows ?? []).map(mapMover);

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-5 py-10">
      <Link
        href="/indice"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--color-muted)] transition hover:text-[var(--color-primary-deep)]"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar ao indice atual
      </Link>

      <IndexHero index={index} />
      <CategoryBreakdown categories={categories} />
      <PriceMovers risers={risers} fallers={fallers} />
    </div>
  );
}
