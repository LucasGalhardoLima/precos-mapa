import { Suspense } from "react";
import { requireSessionContext } from "@/features/auth/session";
import { createClient } from "@/lib/supabase-server";
import { OffersTable, type PromotionRow } from "./offers-table";

const PAGE_SIZE = 20;
const SORTABLE_COLUMNS = ["created_at", "end_date", "promo_price", "status"] as const;
type SortColumn = (typeof SORTABLE_COLUMNS)[number];

interface PageProps {
  searchParams: Promise<{
    store?: string;
    page?: string;
    sort?: string;
    dir?: string;
    q?: string;
    category?: string;
    source?: string;
    status?: string;
    date?: string;
    date_from?: string;
    date_to?: string;
  }>;
}

export default async function MarketOffersPage({ searchParams }: PageProps) {
  const session = await requireSessionContext();
  const params = await searchParams;

  // Allow store override via query param (used by importer redirect & drill-down).
  // RLS on promotions handles access control — no need to gate here.
  const isSuperAdmin = session.role === "super_admin";
  const crossMarket = isSuperAdmin && !params.store;
  const storeId = params.store || session.currentMarketId;

  const page = Math.max(1, parseInt(params.page || "1", 10) || 1);
  const sort: SortColumn = SORTABLE_COLUMNS.includes(params.sort as SortColumn)
    ? (params.sort as SortColumn)
    : "created_at";
  const dir = params.dir === "asc" ? "asc" : "desc";

  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const supabase = await createClient();

  const [{ data: storesList }, { data: categoriesList }] = await Promise.all([
    supabase.from("stores").select("id, name").order("name"),
    supabase.from("categories").select("id, name").order("sort_order"),
  ]);

  const needsInnerJoin = params.q || params.category;
  const productJoin = needsInnerJoin
    ? "product:products!inner(name, brand, category:categories(name))"
    : "product:products(name, brand, category:categories(name))";

  const selectCols = crossMarket
    ? `id, store_id, promo_price, original_price, status, source, end_date, created_at, ${productJoin}, store:stores(name)`
    : `id, store_id, promo_price, original_price, status, source, end_date, created_at, ${productJoin}`;

  let query = supabase
    .from("promotions")
    .select(selectCols, { count: "exact" });

  if (!crossMarket) {
    query = query.eq("store_id", storeId);
  }

  // Product name search (ILIKE)
  if (params.q) {
    query = query.ilike("products.name", `%${params.q}%`);
  }

  // Category filter
  if (params.category) {
    query = query.eq("products.category_id", params.category);
  }

  // Source filter
  if (params.source) {
    query = query.eq("source", params.source);
  }

  // Status filter
  if (params.status) {
    query = query.eq("status", params.status);
  }

  // Date filters
  if (params.date && params.date !== "custom") {
    const now = new Date();
    switch (params.date) {
      case "expired":
        query = query.lt("end_date", now.toISOString());
        break;
      case "today": {
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
        const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();
        query = query.gte("end_date", startOfDay).lt("end_date", endOfDay);
        break;
      }
      case "week": {
        const inWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
        query = query.gte("end_date", now.toISOString()).lte("end_date", inWeek);
        break;
      }
      case "month": {
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();
        query = query.gte("end_date", now.toISOString()).lte("end_date", endOfMonth);
        break;
      }
    }
  } else if (params.date === "custom") {
    if (params.date_from) {
      query = query.gte("end_date", params.date_from);
    }
    if (params.date_to) {
      query = query.lte("end_date", `${params.date_to}T23:59:59`);
    }
  }

  const { data: promotions, count, error } = await query
    .order(sort, { ascending: dir === "asc" })
    .range(from, to);

  if (error) {
    console.error("Offers query error:", error.message);
  }

  return (
    <Suspense>
      <OffersTable
        promotions={(promotions ?? []) as unknown as PromotionRow[]}
        storeId={crossMarket ? undefined : storeId}
        showStoreColumn={crossMarket}
        totalCount={count ?? 0}
        page={page}
        pageSize={PAGE_SIZE}
        sort={sort}
        dir={dir}
        stores={(storesList ?? []).map((s) => ({ value: s.id, label: s.name }))}
        categories={(categoriesList ?? []).map((c) => ({ value: c.id, label: c.name }))}
      />
    </Suspense>
  );
}
