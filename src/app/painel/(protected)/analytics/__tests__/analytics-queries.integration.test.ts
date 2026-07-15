import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getBusinessStoreEngagement } from "../analytics-queries";

// store_engagement_report is `security definer`, so RLS on analytics_events
// never applied to it — it was callable by the public anon key with zero
// login (verified live), and had no internal check that the caller owned
// target_store_id, contradicting spec FR-009. 046_lock_down_engagement_rpc_family.sql
// adds that check: service_role (used below to seed/read, matching every
// other integration test in this suite) is explicitly allowed to bypass it,
// same as it already bypasses RLS everywhere else in this app — so the
// existing tests below are unaffected. The new test at the bottom of this
// file exercises the actual denial path with the anon key.

// Same rationale as engajamento-queries.integration.test.ts: this project has
// no separate test/local Supabase instance, only the shared hosted one.
// Gated behind an explicit env var; skipped by default. Run with:
//   SUPABASE_INTEGRATION_TESTS=1 npx vitest run analytics-queries.integration
const RUN = process.env.SUPABASE_INTEGRATION_TESTS === "1";

describe.skipIf(!RUN)("store_engagement_report — business isolation (integration)", () => {
  let supabase: SupabaseClient;
  let testUserId: string;
  let storeA: string;
  let storeB: string;
  const insertedEventIds: string[] = [];

  beforeAll(async () => {
    supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

    const { data: users } = await supabase.from("profiles").select("id").limit(1);
    if (!users || users.length === 0) throw new Error("No existing user found to attribute test events to");
    testUserId = users[0].id;

    const { data: stores } = await supabase.from("stores").select("id").limit(2);
    if (!stores || stores.length < 2) throw new Error("Need at least 2 stores to run this test");
    [storeA, storeB] = stores.map((s) => s.id);

    const { data: inserted, error } = await supabase
      .from("analytics_events")
      .insert([
        { event_type: "product_detail_viewed", user_id: testUserId, store_id: storeA, metadata: { _test: "014-usage-hotzones" } },
        { event_type: "product_detail_viewed", user_id: testUserId, store_id: storeB, metadata: { _test: "014-usage-hotzones" } },
      ])
      .select("id");
    if (error) throw error;
    insertedEventIds.push(...(inserted ?? []).map((r) => r.id));
  });

  afterAll(async () => {
    if (insertedEventIds.length > 0) {
      await supabase.from("analytics_events").delete().in("id", insertedEventIds);
    }
  });

  it("scoped to storeA never returns storeB's data, and vice versa", async () => {
    const start = new Date(Date.now() - 3600000).toISOString();
    const end = new Date(Date.now() + 3600000).toISOString();

    const resultA = await getBusinessStoreEngagement(supabase, storeA, start, end);
    const resultB = await getBusinessStoreEngagement(supabase, storeB, start, end);

    expect(resultA?.id).toBe(storeA);
    expect(resultB?.id).toBe(storeB);
    expect(resultA?.id).not.toBe(resultB?.id);
  });

  it("rejects an unauthenticated (anon) caller with no store_members row for the target store", async () => {
    const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    const { error } = await anon.rpc("store_engagement_report", {
      target_store_id: storeA,
      start_date: new Date(Date.now() - 3600000).toISOString(),
      end_date: new Date(Date.now() + 3600000).toISOString(),
    });
    expect(error).not.toBeNull();
    expect(error!.message).toMatch(/access denied/i);
  });

  it("rejects a call with no target_store_id at all (previously meant \"all stores\")", async () => {
    const { error } = await supabase.rpc("store_engagement_report", {
      start_date: new Date(Date.now() - 3600000).toISOString(),
      end_date: new Date(Date.now() + 3600000).toISOString(),
    });
    expect(error).not.toBeNull();
    expect(error!.message).toMatch(/target_store_id is required/i);
  });
});
