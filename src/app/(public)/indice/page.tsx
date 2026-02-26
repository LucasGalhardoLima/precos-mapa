import type { Metadata } from "next";
import { createClient } from "@/lib/supabase-server";
import { mapDbToIndex, mapDbToCategory, formatPeriodLabel, getIndexSummary } from "@/lib/index-calculator";
import type { PriceIndexProduct } from "@/features/shared/types";
import { IndexHero } from "./components/index-hero";
import { IndexChart } from "./components/index-chart";
import { CategoryBreakdown } from "./components/category-breakdown";
import { PriceMovers } from "./components/price-movers";
import { HistoricalList } from "./components/historical-list";

export async function generateMetadata(): Promise<Metadata> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("price_indices")
    .select("city, state, period_start, index_value, mom_change_percent")
    .eq("status", "published")
    .order("period_start", { ascending: false })
    .limit(1)
    .single();

  if (!data) {
    return {
      title: "Indice Regional de Precos | PrecoMapa",
      description: "Acompanhe a evolucao dos precos do varejo na sua regiao com dados reais e metodologia transparente.",
    };
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

export default async function PublicIndexPage() {
  const supabase = await createClient();

  // Get last 12 published indices
  const { data: indexRows } = await supabase
    .from("price_indices")
    .select("*")
    .eq("status", "published")
    .order("period_start", { ascending: false })
    .limit(12);

  const indices = (indexRows ?? []).map(mapDbToIndex);
  const latestIndex = indices[0];

  if (!latestIndex) {
    return (
      <div className="mx-auto max-w-5xl px-5 py-16">
        <div className="rounded-3xl border border-[var(--color-line)] bg-white p-12 text-center shadow-[var(--shadow-soft)]">
          <p className="text-sm font-medium uppercase tracking-[0.1em] text-[var(--color-muted)]">
            Indice Regional de Precos do Varejo
          </p>
          <h1 className="mt-4 text-3xl font-semibold text-[var(--color-ink)]">
            Em breve
          </h1>
          <p className="mt-3 mx-auto max-w-md text-sm text-[var(--color-muted)]">
            O primeiro indice regional de precos sera publicado apos o periodo inicial de coleta de dados.
            Acompanhe nosso progresso e fique por dentro dos precos da sua regiao.
          </p>
        </div>
      </div>
    );
  }

  // Get category breakdown for latest index
  const { data: catRows } = await supabase
    .from("price_index_categories")
    .select("*, category:categories(name)")
    .eq("index_id", latestIndex.id)
    .order("weight", { ascending: false });

  const categories = (catRows ?? []).map(mapDbToCategory);

  // Get top movers
  const { data: riserRows } = await supabase.rpc("get_price_movers", {
    p_index_id: latestIndex.id,
    p_direction: "up",
    p_limit: 5,
  });

  const { data: fallerRows } = await supabase.rpc("get_price_movers", {
    p_index_id: latestIndex.id,
    p_direction: "down",
    p_limit: 5,
  });

  const risers: PriceIndexProduct[] = (riserRows ?? []).map((r: Record<string, unknown>) => ({
    id: r.product_id as string,
    indexId: latestIndex.id,
    productId: r.product_id as string,
    productName: r.product_name as string,
    categoryName: r.category_name as string,
    avgPrice: Number(r.avg_price),
    minPrice: Number(r.min_price),
    maxPrice: Number(r.max_price),
    snapshotDays: 0,
    momChangePercent: Number(r.mom_change_percent),
  }));

  const fallers: PriceIndexProduct[] = (fallerRows ?? []).map((r: Record<string, unknown>) => ({
    id: r.product_id as string,
    indexId: latestIndex.id,
    productId: r.product_id as string,
    productName: r.product_name as string,
    categoryName: r.category_name as string,
    avgPrice: Number(r.avg_price),
    minPrice: Number(r.min_price),
    maxPrice: Number(r.max_price),
    snapshotDays: 0,
    momChangePercent: Number(r.mom_change_percent),
  }));

  // Schema.org structured data
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: `Indice Regional de Precos do Varejo - ${latestIndex.city}/${latestIndex.state}`,
    description: getIndexSummary(latestIndex),
    temporalCoverage: `${latestIndex.periodStart}/${latestIndex.periodEnd}`,
    spatialCoverage: {
      "@type": "Place",
      name: `${latestIndex.city}, ${latestIndex.state}, Brasil`,
    },
    creator: {
      "@type": "Organization",
      name: "PrecoMapa",
      description: "Plataforma independente de inteligencia de precos do varejo",
    },
    distribution: {
      "@type": "DataDownload",
      contentUrl: `/indice`,
      encodingFormat: "text/html",
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      <div className="mx-auto max-w-5xl space-y-6 px-5 py-10">
        <IndexHero index={latestIndex} />
        <IndexChart indices={indices} />
        <CategoryBreakdown categories={categories} />
        <PriceMovers risers={risers} fallers={fallers} />
        <HistoricalList indices={indices} currentId={latestIndex.id} />
      </div>
    </>
  );
}
