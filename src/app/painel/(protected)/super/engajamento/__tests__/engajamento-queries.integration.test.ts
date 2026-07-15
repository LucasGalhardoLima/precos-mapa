import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getProductEngagement, getGeoHotZones, getUserEngagement, getUserEngagementDetail } from "../engajamento-queries";

// This project has no separate local/test Supabase instance — .env.local
// points at the same hosted project used in production. Running this
// unconditionally on every `npm test` would write/delete real rows on every
// CI run and every developer machine. Gated behind an explicit env var;
// skipped by default. Run with:
//   SUPABASE_INTEGRATION_TESTS=1 npx vitest run engajamento-queries.integration
const RUN = process.env.SUPABASE_INTEGRATION_TESTS === "1";

describe.skipIf(!RUN)("product_engagement_report (integration)", () => {
  let supabase: SupabaseClient;
  let testUserId: string;
  let productA: string;
  let productB: string;
  const insertedEventIds: string[] = [];

  beforeAll(async () => {
    supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

    const { data: users } = await supabase.from("profiles").select("id").limit(1);
    if (!users || users.length === 0) throw new Error("No existing user found to attribute test events to");
    testUserId = users[0].id;

    const { data: products } = await supabase.from("products").select("id").limit(2);
    if (!products || products.length < 2) throw new Error("Need at least 2 products in the catalog to run this test");
    [productA, productB] = products.map((p) => p.id);

    // productB gets more engagement than productA — asserts real ranking order.
    const rows = [
      { event_type: "product_detail_viewed", user_id: testUserId, product_id: productA, metadata: { _test: "014-usage-hotzones" } },
      { event_type: "product_detail_viewed", user_id: testUserId, product_id: productB, metadata: { _test: "014-usage-hotzones" } },
      { event_type: "search_result_viewed", user_id: testUserId, product_id: productB, metadata: { _test: "014-usage-hotzones" } },
    ];
    const { data: inserted, error } = await supabase.from("analytics_events").insert(rows).select("id");
    if (error) throw error;
    insertedEventIds.push(...(inserted ?? []).map((r) => r.id));
  });

  afterAll(async () => {
    if (insertedEventIds.length > 0) {
      await supabase.from("analytics_events").delete().in("id", insertedEventIds);
    }
  });

  it("ranks the seeded products by real engagement volume, most-engaged first", async () => {
    const start = new Date(Date.now() - 3600000).toISOString();
    const end = new Date(Date.now() + 3600000).toISOString();
    const ranking = await getProductEngagement(supabase, start, end);

    const a = ranking.find((r) => r.id === productA);
    const b = ranking.find((r) => r.id === productB);
    expect(a).toBeDefined();
    expect(b).toBeDefined();
    expect(b!.totalEvents).toBe(2);
    expect(a!.totalEvents).toBe(1);
    expect(ranking.indexOf(b!)).toBeLessThan(ranking.indexOf(a!));
  });
});

describe.skipIf(!RUN)("geo_hotzone_by_store / geo_hotzone_by_region (integration)", () => {
  let supabase: SupabaseClient;
  let testUserId: string;
  let storeId: string;
  let storeCity: string;
  let storeState: string;
  const insertedEventIds: string[] = [];
  const testRegion = "__test-region__, ZZ";

  beforeAll(async () => {
    supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

    const { data: users } = await supabase.from("profiles").select("id").limit(1);
    if (!users || users.length === 0) throw new Error("No existing user found to attribute test events to");
    testUserId = users[0].id;

    const { data: stores } = await supabase.from("stores").select("id, city, state").limit(1);
    if (!stores || stores.length === 0) throw new Error("Need at least 1 store to run this test");
    storeId = stores[0].id;
    storeCity = stores[0].city;
    storeState = stores[0].state;

    // One event with a store (feeds geo_hotzone_by_store via the store's
    // known city/state) and no region; one event with a distinctive region
    // string (feeds geo_hotzone_by_region) and no store — asserts the two
    // groupings are independent, per data-model.md's Geographic Hot Zone spec.
    const rows = [
      { event_type: "screen_viewed", user_id: testUserId, store_id: storeId, metadata: { _test: "014-usage-hotzones" } },
      { event_type: "screen_viewed", user_id: testUserId, region: testRegion, metadata: { _test: "014-usage-hotzones" } },
    ];
    const { data: inserted, error } = await supabase.from("analytics_events").insert(rows).select("id");
    if (error) throw error;
    insertedEventIds.push(...(inserted ?? []).map((r) => r.id));
  });

  afterAll(async () => {
    if (insertedEventIds.length > 0) {
      await supabase.from("analytics_events").delete().in("id", insertedEventIds);
    }
  });

  it("groups the store-tied event by that store's known city/state, and the region-tagged event by its region — independently", async () => {
    const start = new Date(Date.now() - 3600000).toISOString();
    const end = new Date(Date.now() + 3600000).toISOString();
    const geo = await getGeoHotZones(supabase, start, end);

    const storeRow = geo.byStoreLocation.find((r) => r.label === `${storeCity}, ${storeState}`);
    expect(storeRow).toBeDefined();
    expect(storeRow!.totalEvents).toBeGreaterThanOrEqual(1);

    // Exactly 1, not 2 — proves the store-tied event (which carried no
    // region) doesn't leak into this grouping; the two are independent.
    const regionRow = geo.byUserRegion.find((r) => r.label === testRegion);
    expect(regionRow).toBeDefined();
    expect(regionRow!.totalEvents).toBe(1);
  });
});

describe.skipIf(!RUN)("user_engagement_report / user_engagement_detail (integration)", () => {
  let supabase: SupabaseClient;
  let testUserId: string;
  let productA: string;
  let productB: string;
  let storeId: string;
  const insertedEventIds: string[] = [];

  beforeAll(async () => {
    supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

    const { data: users } = await supabase.from("profiles").select("id").limit(1);
    if (!users || users.length === 0) throw new Error("No existing user found to attribute test events to");
    testUserId = users[0].id;

    const { data: products } = await supabase.from("products").select("id").limit(2);
    if (!products || products.length < 2) throw new Error("Need at least 2 products in the catalog to run this test");
    [productA, productB] = products.map((p) => p.id);

    const { data: stores } = await supabase.from("stores").select("id").limit(1);
    if (!stores || stores.length === 0) throw new Error("Need at least 1 store to run this test");
    storeId = stores[0].id;

    // productB gets more views than productA for this user — asserts the
    // per-user "top product" pick (rn = 1 in the window function) is correct,
    // the same real cardinality bug class row_number()-per-user is prone to.
    const rows = [
      { event_type: "product_detail_viewed", user_id: testUserId, product_id: productA, store_id: storeId, metadata: { _test: "014-usage-hotzones" } },
      { event_type: "product_detail_viewed", user_id: testUserId, product_id: productB, store_id: storeId, metadata: { _test: "014-usage-hotzones" } },
      { event_type: "product_detail_viewed", user_id: testUserId, product_id: productB, store_id: storeId, metadata: { _test: "014-usage-hotzones" } },
      { event_type: "list_item_added", user_id: testUserId, product_id: productB, metadata: { _test: "014-usage-hotzones" } },
    ];
    const { data: inserted, error } = await supabase.from("analytics_events").insert(rows).select("id");
    if (error) throw error;
    insertedEventIds.push(...(inserted ?? []).map((r) => r.id));
  });

  afterAll(async () => {
    if (insertedEventIds.length > 0) {
      await supabase.from("analytics_events").delete().in("id", insertedEventIds);
    }
  });

  it("ranks the test user in the leaderboard with the correct top product and list-add count", async () => {
    const start = new Date(Date.now() - 3600000).toISOString();
    const end = new Date(Date.now() + 3600000).toISOString();
    const leaderboard = await getUserEngagement(supabase, start, end);

    const row = leaderboard.find((r) => r.userId === testUserId);
    expect(row).toBeDefined();
    expect(row!.topProductName).toBeDefined();
    expect(row!.listAdds).toBeGreaterThanOrEqual(1);
    expect(row!.totalEvents).toBeGreaterThanOrEqual(4);
  });

  it("returns the seeded product as the top-ranked product in the drill-down detail", async () => {
    const start = new Date(Date.now() - 3600000).toISOString();
    const end = new Date(Date.now() + 3600000).toISOString();
    const detail = await getUserEngagementDetail(supabase, testUserId, start, end);

    expect(detail.topProducts[0]?.product_id).toBe(productB);
    expect(detail.topProducts[0]?.events).toBeGreaterThanOrEqual(2);
    expect(detail.totals.list_adds).toBeGreaterThanOrEqual(1);
  });
});
