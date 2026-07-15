import type { SupabaseClient } from "@supabase/supabase-js";

// ─── Shared ranking-row shape (store/product/geo tables all render this) ──

export interface RankingBreakdownEntry {
  key: string;
  label: string;
  count: number;
  uniqueUsers: number;
}

export interface RankingRow {
  id: string;
  label: string;
  /** Optional secondary line under the label — e.g. a store's city/chain. */
  sublabel?: string;
  totalEvents: number;
  totalUniqueUsers: number;
  breakdown: RankingBreakdownEntry[];
}

function sortByTotalEventsDesc(rows: RankingRow[]): RankingRow[] {
  return [...rows].sort((a, b) => b.totalEvents - a.totalEvents);
}

// ─── Store engagement (existing — normalized here so the shared ranking
//     table can render it alongside product/geo, per the 3rd-repetition
//     extraction in T024) ───────────────────────────────────────────────────

export interface StoreEngagementRow {
  store_id: string;
  store_name: string;
  city: string;
  chain: string | null;
  search_impressions: number;
  search_unique_users: number;
  detail_views: number;
  detail_unique_users: number;
  list_adds: number;
  list_unique_users: number;
  alerts_created: number;
  alert_unique_users: number;
  map_taps: number;
  map_unique_users: number;
  total_events: number;
  total_unique_users: number;
}

export function mapStoreRows(rows: StoreEngagementRow[]): RankingRow[] {
  const mapped = rows.map((r) => ({
    id: r.store_id,
    label: r.store_name,
    sublabel: r.chain ? `${r.city} · ${r.chain}` : r.city,
    totalEvents: r.total_events,
    totalUniqueUsers: r.total_unique_users,
    breakdown: [
      { key: "search", label: "Buscas", count: r.search_impressions, uniqueUsers: r.search_unique_users },
      { key: "detail", label: "Detalhes", count: r.detail_views, uniqueUsers: r.detail_unique_users },
      { key: "list", label: "Lista", count: r.list_adds, uniqueUsers: r.list_unique_users },
      { key: "alerts", label: "Alertas", count: r.alerts_created, uniqueUsers: r.alert_unique_users },
      { key: "map", label: "Mapa", count: r.map_taps, uniqueUsers: r.map_unique_users },
    ],
  }));
  return sortByTotalEventsDesc(mapped);
}

// ─── Product engagement (User Story 1) ─────────────────────────────────────

export interface ProductEngagementRow {
  product_id: string;
  product_name: string;
  search_impressions: number;
  search_unique_users: number;
  detail_views: number;
  detail_unique_users: number;
  total_events: number;
  total_unique_users: number;
}

export function mapProductRows(rows: ProductEngagementRow[]): RankingRow[] {
  const mapped = rows.map((r) => ({
    id: r.product_id,
    label: r.product_name,
    totalEvents: r.total_events,
    totalUniqueUsers: r.total_unique_users,
    breakdown: [
      { key: "search", label: "Buscas", count: r.search_impressions, uniqueUsers: r.search_unique_users },
      { key: "detail", label: "Detalhes", count: r.detail_views, uniqueUsers: r.detail_unique_users },
    ],
  }));
  return sortByTotalEventsDesc(mapped);
}

export async function getProductEngagement(
  supabase: SupabaseClient,
  startDate: string,
  endDate: string,
): Promise<RankingRow[]> {
  const { data, error } = await supabase.rpc("product_engagement_report", {
    start_date: startDate,
    end_date: endDate,
  });
  if (error) throw error;
  return mapProductRows((data ?? []) as ProductEngagementRow[]);
}

// ─── Geographic hot zones (User Story 2) ───────────────────────────────────

export interface GeoByStoreRow {
  city: string;
  state: string;
  total_events: number;
  total_unique_users: number;
  store_count: number;
}

export interface GeoByRegionRow {
  region: string;
  total_events: number;
  total_unique_users: number;
}

export interface GeoRanking {
  byStoreLocation: RankingRow[];
  byUserRegion: RankingRow[];
}

export function mapGeoRows(byStore: GeoByStoreRow[], byRegion: GeoByRegionRow[]): GeoRanking {
  const storeRows = byStore.map((r) => ({
    id: `${r.city}|${r.state}`,
    label: `${r.city}, ${r.state}`,
    totalEvents: r.total_events,
    totalUniqueUsers: r.total_unique_users,
    breakdown: [{ key: "stores", label: "Mercados", count: r.store_count, uniqueUsers: r.total_unique_users }],
  }));

  const regionRows = byRegion.map((r) => ({
    id: r.region,
    label: r.region,
    totalEvents: r.total_events,
    totalUniqueUsers: r.total_unique_users,
    breakdown: [],
  }));

  return {
    byStoreLocation: sortByTotalEventsDesc(storeRows),
    byUserRegion: sortByTotalEventsDesc(regionRows),
  };
}

export async function getGeoHotZones(
  supabase: SupabaseClient,
  startDate: string,
  endDate: string,
): Promise<GeoRanking> {
  const [{ data: byStore, error: storeErr }, { data: byRegion, error: regionErr }] = await Promise.all([
    supabase.rpc("geo_hotzone_by_store", { start_date: startDate, end_date: endDate }),
    supabase.rpc("geo_hotzone_by_region", { start_date: startDate, end_date: endDate }),
  ]);
  if (storeErr) throw storeErr;
  if (regionErr) throw regionErr;
  return mapGeoRows((byStore ?? []) as GeoByStoreRow[], (byRegion ?? []) as GeoByRegionRow[]);
}

// ─── Per-user engagement leaderboard + drill-down ──────────────────────────

export interface UserEngagementRow {
  user_id: string;
  display_name: string | null;
  search_impressions: number;
  detail_views: number;
  list_adds: number;
  alerts_created: number;
  map_taps: number;
  total_events: number;
  top_product_id: string | null;
  top_product_name: string | null;
  top_store_id: string | null;
  top_store_name: string | null;
  top_city: string | null;
  top_state: string | null;
  first_event_at: string;
  last_event_at: string;
}

export interface UserRankingRow {
  userId: string;
  label: string;
  totalEvents: number;
  listAdds: number;
  topProductName: string | null;
  topStoreName: string | null;
  topCityLabel: string | null;
}

export function mapUserRows(rows: UserEngagementRow[]): UserRankingRow[] {
  const mapped = rows.map((r) => ({
    userId: r.user_id,
    label: r.display_name?.trim() || `Usuário ${r.user_id.slice(0, 8)}`,
    totalEvents: r.total_events,
    listAdds: r.list_adds,
    topProductName: r.top_product_name,
    topStoreName: r.top_store_name,
    topCityLabel: r.top_city ? `${r.top_city}, ${r.top_state}` : null,
  }));
  return [...mapped].sort((a, b) => b.totalEvents - a.totalEvents);
}

export async function getUserEngagement(
  supabase: SupabaseClient,
  startDate: string,
  endDate: string,
): Promise<UserRankingRow[]> {
  const { data, error } = await supabase.rpc("user_engagement_report", {
    start_date: startDate,
    end_date: endDate,
  });
  if (error) throw error;
  return mapUserRows((data ?? []) as UserEngagementRow[]);
}

export interface UserEngagementDetailProductRow {
  product_id: string;
  product_name: string;
  events: number;
}

export interface UserEngagementDetailStoreRow {
  store_id: string;
  store_name: string;
  city: string;
  state: string;
  events: number;
}

export interface UserEngagementDetailCityRow {
  city: string;
  state: string;
  events: number;
}

export interface UserEngagementDetailRegionRow {
  region: string;
  events: number;
}

export interface UserEngagementDetailTotals {
  search_impressions: number;
  detail_views: number;
  list_adds: number;
  alerts_created: number;
  map_taps: number;
  total_events: number;
}

export interface UserEngagementDetail {
  topProducts: UserEngagementDetailProductRow[];
  topStores: UserEngagementDetailStoreRow[];
  topCities: UserEngagementDetailCityRow[];
  topRegions: UserEngagementDetailRegionRow[];
  totals: UserEngagementDetailTotals;
}

export function mapUserDetail(raw: {
  top_products?: UserEngagementDetailProductRow[];
  top_stores?: UserEngagementDetailStoreRow[];
  top_cities?: UserEngagementDetailCityRow[];
  top_regions?: UserEngagementDetailRegionRow[];
  totals?: UserEngagementDetailTotals;
}): UserEngagementDetail {
  return {
    topProducts: raw.top_products ?? [],
    topStores: raw.top_stores ?? [],
    topCities: raw.top_cities ?? [],
    topRegions: raw.top_regions ?? [],
    totals: raw.totals ?? {
      search_impressions: 0,
      detail_views: 0,
      list_adds: 0,
      alerts_created: 0,
      map_taps: 0,
      total_events: 0,
    },
  };
}

export async function getUserEngagementDetail(
  supabase: SupabaseClient,
  targetUserId: string,
  startDate: string,
  endDate: string,
): Promise<UserEngagementDetail> {
  const { data, error } = await supabase.rpc("user_engagement_detail", {
    target_user_id: targetUserId,
    start_date: startDate,
    end_date: endDate,
    top_n: 5,
  });
  if (error) throw error;
  return mapUserDetail(data ?? {});
}

// ─── Date-range helpers (shared by all sections on this page) ─────────────

export const DATE_RANGE_PRESETS = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
} as const;

export type DateRangePreset = keyof typeof DATE_RANGE_PRESETS;

export function resolveDateRange(preset: string | undefined): { startDate: string; endDate: string } {
  const days = DATE_RANGE_PRESETS[(preset as DateRangePreset) ?? "30d"] ?? DATE_RANGE_PRESETS["30d"];
  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - days * 86400000);
  return { startDate: startDate.toISOString(), endDate: endDate.toISOString() };
}
