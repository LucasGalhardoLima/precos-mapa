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

  let query = supabase
    .from("promotions")
    .select(
      crossMarket
        ? "id, store_id, promo_price, original_price, status, source, end_date, created_at, product:products(name, brand, category:categories(name)), store:stores(name)"
        : "id, store_id, promo_price, original_price, status, source, end_date, created_at, product:products(name, brand, category:categories(name))",
      { count: "exact" },
    );

  if (!crossMarket) {
    query = query.eq("store_id", storeId);
  }

  const { data: promotions, count, error } = await query
    .order(sort, { ascending: dir === "asc" })
    .range(from, to);

  if (error) {
    console.error("Offers query error:", error.message);
  }

  return (
    <OffersTable
      promotions={(promotions ?? []) as unknown as PromotionRow[]}
      storeId={crossMarket ? undefined : storeId}
      showStoreColumn={crossMarket}
      totalCount={count ?? 0}
      page={page}
      pageSize={PAGE_SIZE}
      sort={sort}
      dir={dir}
    />
  );
}
