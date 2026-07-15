import type { SupabaseClient } from "@supabase/supabase-js";
import type { RankingRow } from "../super/engajamento/engajamento-queries";

// store_engagement_report() (020_analytics_events.sql) only carries per-category
// unique-user counts for search/detail — not list/alerts/map, unlike the
// store_engagement_summary view. Pre-existing RPC limitation, out of scope to
// change here; only surfacing the categories with accurate data rather than
// fabricating unique-user numbers for the rest.
interface StoreEngagementReportRow {
  store_id: string;
  store_name: string;
  city: string;
  chain: string | null;
  search_impressions: number;
  search_unique_users: number;
  detail_views: number;
  detail_unique_users: number;
  list_adds: number;
  alerts_created: number;
  map_taps: number;
  total_events: number;
  total_unique_users: number;
}

export function mapStoreReportRow(row: StoreEngagementReportRow): RankingRow {
  return {
    id: row.store_id,
    label: row.store_name,
    sublabel: row.chain ? `${row.city} · ${row.chain}` : row.city,
    totalEvents: row.total_events,
    totalUniqueUsers: row.total_unique_users,
    breakdown: [
      { key: "search", label: "Buscas", count: row.search_impressions, uniqueUsers: row.search_unique_users },
      { key: "detail", label: "Detalhes", count: row.detail_views, uniqueUsers: row.detail_unique_users },
    ],
  };
}

/**
 * Fetches real engagement for the given business's current store, scoped by
 * the existing store_engagement_report() RPC — the same RLS-scoped, existing
 * function the super-admin dashboard uses for a single store's numbers, so a
 * business owner sees exactly what a super-admin would see for their store
 * (spec SC-003: zero discrepancy).
 */
export async function getBusinessStoreEngagement(
  supabase: SupabaseClient,
  storeId: string,
  startDate: string,
  endDate: string,
): Promise<RankingRow | null> {
  const { data, error } = await supabase.rpc("store_engagement_report", {
    target_store_id: storeId,
    start_date: startDate,
    end_date: endDate,
  });
  if (error) throw error;
  const rows = (data ?? []) as StoreEngagementReportRow[];
  if (rows.length === 0) return null;
  return mapStoreReportRow(rows[0]);
}
