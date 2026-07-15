import { describe, it, expect, vi } from "vitest";
import { getBusinessStoreEngagement, mapStoreReportRow } from "../analytics-queries";

describe("mapStoreReportRow", () => {
  it("maps only the categories with accurate per-category unique-user counts (search, detail)", () => {
    const row = {
      store_id: "s1",
      store_name: "Savegnago Matão",
      city: "Matão",
      chain: "Savegnago",
      search_impressions: 10,
      search_unique_users: 4,
      detail_views: 6,
      detail_unique_users: 3,
      list_adds: 2,
      alerts_created: 1,
      map_taps: 5,
      total_events: 24,
      total_unique_users: 6,
    };
    expect(mapStoreReportRow(row)).toEqual({
      id: "s1",
      label: "Savegnago Matão",
      sublabel: "Matão · Savegnago",
      totalEvents: 24,
      totalUniqueUsers: 6,
      breakdown: [
        { key: "search", label: "Buscas", count: 10, uniqueUsers: 4 },
        { key: "detail", label: "Detalhes", count: 6, uniqueUsers: 3 },
      ],
    });
  });
});

describe("getBusinessStoreEngagement", () => {
  it("calls store_engagement_report scoped to exactly the given store id, never another", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          store_id: "store-a",
          store_name: "Store A",
          city: "Matão",
          chain: null,
          search_impressions: 1,
          search_unique_users: 1,
          detail_views: 0,
          detail_unique_users: 0,
          list_adds: 0,
          alerts_created: 0,
          map_taps: 0,
          total_events: 1,
          total_unique_users: 1,
        },
      ],
      error: null,
    });
    const supabase = { rpc } as unknown as Parameters<typeof getBusinessStoreEngagement>[0];

    const result = await getBusinessStoreEngagement(supabase, "store-a", "2026-01-01", "2026-02-01");

    expect(rpc).toHaveBeenCalledWith("store_engagement_report", {
      target_store_id: "store-a",
      start_date: "2026-01-01",
      end_date: "2026-02-01",
    });
    expect(result?.id).toBe("store-a");
  });

  it("returns null (not an error) when the store has no engagement in range", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [], error: null });
    const supabase = { rpc } as unknown as Parameters<typeof getBusinessStoreEngagement>[0];

    const result = await getBusinessStoreEngagement(supabase, "store-empty", "2026-01-01", "2026-02-01");
    expect(result).toBeNull();
  });

  it("throws when the RPC errors, rather than silently returning empty data", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: new Error("boom") });
    const supabase = { rpc } as unknown as Parameters<typeof getBusinessStoreEngagement>[0];

    await expect(getBusinessStoreEngagement(supabase, "store-a", "2026-01-01", "2026-02-01")).rejects.toThrow(
      "boom",
    );
  });
});
