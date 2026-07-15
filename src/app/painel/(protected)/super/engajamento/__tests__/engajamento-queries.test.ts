import { describe, it, expect } from "vitest";
import { mapProductRows, mapGeoRows, mapUserRows, mapUserDetail } from "../engajamento-queries";

describe("mapProductRows", () => {
  it("sorts by total_events descending, defensively re-sorting even if input isn't", () => {
    const rows = [
      { product_id: "a", product_name: "A", search_impressions: 1, search_unique_users: 1, detail_views: 0, detail_unique_users: 0, total_events: 2, total_unique_users: 1 },
      { product_id: "b", product_name: "B", search_impressions: 5, search_unique_users: 3, detail_views: 2, detail_unique_users: 2, total_events: 7, total_unique_users: 3 },
    ];
    const result = mapProductRows(rows);
    expect(result.map((r) => r.id)).toEqual(["b", "a"]);
  });

  it("maps every field into the shared ranking-row shape", () => {
    const rows = [
      { product_id: "a", product_name: "Azeitona Verde", search_impressions: 3, search_unique_users: 2, detail_views: 1, detail_unique_users: 1, total_events: 4, total_unique_users: 2 },
    ];
    const result = mapProductRows(rows);
    expect(result[0]).toEqual({
      id: "a",
      label: "Azeitona Verde",
      totalEvents: 4,
      totalUniqueUsers: 2,
      breakdown: [
        { key: "search", label: "Buscas", count: 3, uniqueUsers: 2 },
        { key: "detail", label: "Detalhes", count: 1, uniqueUsers: 1 },
      ],
    });
  });

  it("returns an empty array for no rows, never throws", () => {
    expect(mapProductRows([])).toEqual([]);
  });
});

describe("mapGeoRows", () => {
  it("groups the store-location shape into ranking rows keyed by city/state", () => {
    const byStore = [
      { city: "Matão", state: "SP", total_events: 10, total_unique_users: 4, store_count: 2 },
      { city: "Araraquara", state: "SP", total_events: 3, total_unique_users: 2, store_count: 1 },
    ];
    const result = mapGeoRows(byStore, []);
    expect(result.byStoreLocation.map((r) => r.label)).toEqual(["Matão, SP", "Araraquara, SP"]);
    expect(result.byStoreLocation[0].totalEvents).toBe(10);
  });

  it("groups the user-region shape separately, excluding it entirely when empty", () => {
    const result = mapGeoRows([], []);
    expect(result.byUserRegion).toEqual([]);
  });

  it("sorts both groupings by total_events descending", () => {
    const byRegion = [
      { region: "Araraquara, SP", total_events: 2, total_unique_users: 1 },
      { region: "Matão, SP", total_events: 9, total_unique_users: 5 },
    ];
    const result = mapGeoRows([], byRegion);
    expect(result.byUserRegion.map((r) => r.label)).toEqual(["Matão, SP", "Araraquara, SP"]);
  });
});

describe("mapUserRows", () => {
  it("falls back to a truncated user id when display_name is null", () => {
    const rows = [
      {
        user_id: "6b583bfc-03d3-4905-b248-3687c9a4f3de",
        display_name: null,
        search_impressions: 4,
        detail_views: 3,
        list_adds: 3,
        alerts_created: 2,
        map_taps: 3,
        total_events: 20,
        top_product_id: "p1",
        top_product_name: "Bombom Garoto",
        top_store_id: "s1",
        top_store_name: "Savegnago",
        top_city: "Matão",
        top_state: "SP",
        first_event_at: "2026-04-02T00:02:54Z",
        last_event_at: "2026-05-16T19:18:40Z",
      },
    ];
    const result = mapUserRows(rows);
    expect(result[0].label).toBe("Usuário 6b583bfc");
    expect(result[0].topCityLabel).toBe("Matão, SP");
  });

  it("uses display_name when present, and null-safe fields when a user has no top product/store/city", () => {
    const rows = [
      {
        user_id: "u1",
        display_name: "  Maria  ",
        search_impressions: 0,
        detail_views: 0,
        list_adds: 0,
        alerts_created: 0,
        map_taps: 1,
        total_events: 1,
        top_product_id: null,
        top_product_name: null,
        top_store_id: null,
        top_store_name: null,
        top_city: null,
        top_state: null,
        first_event_at: "2026-01-01T00:00:00Z",
        last_event_at: "2026-01-01T00:00:00Z",
      },
    ];
    const result = mapUserRows(rows);
    expect(result[0].label).toBe("Maria");
    expect(result[0].topProductName).toBeNull();
    expect(result[0].topCityLabel).toBeNull();
  });

  it("sorts by total_events descending, defensively re-sorting even if input isn't", () => {
    const rows = [
      { user_id: "a", display_name: "A", search_impressions: 0, detail_views: 0, list_adds: 0, alerts_created: 0, map_taps: 0, total_events: 2, top_product_id: null, top_product_name: null, top_store_id: null, top_store_name: null, top_city: null, top_state: null, first_event_at: "", last_event_at: "" },
      { user_id: "b", display_name: "B", search_impressions: 0, detail_views: 0, list_adds: 0, alerts_created: 0, map_taps: 0, total_events: 9, top_product_id: null, top_product_name: null, top_store_id: null, top_store_name: null, top_city: null, top_state: null, first_event_at: "", last_event_at: "" },
    ];
    const result = mapUserRows(rows);
    expect(result.map((r) => r.userId)).toEqual(["b", "a"]);
  });

  it("returns an empty array for no rows, never throws", () => {
    expect(mapUserRows([])).toEqual([]);
  });
});

describe("mapUserDetail", () => {
  it("defaults every list/totals field when the RPC returns an empty object", () => {
    const result = mapUserDetail({});
    expect(result).toEqual({
      topProducts: [],
      topStores: [],
      topCities: [],
      topRegions: [],
      totals: {
        search_impressions: 0,
        detail_views: 0,
        list_adds: 0,
        alerts_created: 0,
        map_taps: 0,
        total_events: 0,
      },
    });
  });

  it("passes through populated lists and totals unchanged", () => {
    const raw = {
      top_products: [{ product_id: "p1", product_name: "Bombom", events: 2 }],
      top_stores: [{ store_id: "s1", store_name: "Savegnago", city: "Matão", state: "SP", events: 7 }],
      top_cities: [{ city: "Matão", state: "SP", events: 13 }],
      top_regions: [],
      totals: {
        search_impressions: 4,
        detail_views: 3,
        list_adds: 3,
        alerts_created: 2,
        map_taps: 3,
        total_events: 20,
      },
    };
    expect(mapUserDetail(raw)).toEqual({
      topProducts: raw.top_products,
      topStores: raw.top_stores,
      topCities: raw.top_cities,
      topRegions: [],
      totals: raw.totals,
    });
  });
});
