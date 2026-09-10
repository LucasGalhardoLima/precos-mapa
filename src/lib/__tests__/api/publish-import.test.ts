import { describe, it, expect, vi, beforeEach } from "vitest";
import type { User } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Mocks — hoisted before imports
// ---------------------------------------------------------------------------

const mockRequireApiAuth = vi.fn<() => Promise<{ user: User | null; error: Response | null }>>();
const mockCheckRateLimit = vi.fn<() => boolean>().mockReturnValue(true);
const mockGetClientIp = vi.fn<() => string>().mockReturnValue("127.0.0.1");
const mockFindOrCreateProduct = vi.fn<() => Promise<{ id: string }>>();

vi.mock("@/lib/api-auth", () => ({ requireApiAuth: mockRequireApiAuth }));
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: mockCheckRateLimit,
  getClientIp: mockGetClientIp,
}));
vi.mock("@/lib/product-match", () => ({ findOrCreateProduct: mockFindOrCreateProduct }));

// Supabase chain factory — each table gets its own chain so per-test overrides work
function makeChain(defaults: Record<string, unknown> = {}) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    insert: vi.fn().mockResolvedValue({ data: null, error: null }),
    upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
    ...defaults,
  };
}

let chains: Record<string, ReturnType<typeof makeChain>>;
const mockGetSupabaseAdmin = vi.fn();

vi.mock("@/lib/supabase-server", () => ({ getSupabaseAdmin: mockGetSupabaseAdmin }));

// ---------------------------------------------------------------------------
// Import route handler AFTER mocks
// ---------------------------------------------------------------------------
const { POST } = await import("@/app/api/publish-import/route");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_USER = { id: "user-1", email: "test@test.com" } as User;

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/publish-import", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: "Bearer tok" },
    body: JSON.stringify(body),
  });
}

const VALID_BODY = {
  storeId: "store-1",
  products: [
    { name: "Arroz 5kg", price: 24.9, unit: "un", validity: null },
    { name: "Feijão 1kg", price: 8.49, unit: "kg", validity: null },
  ],
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/publish-import", () => {
  beforeEach(() => {
    chains = {
      store_members: makeChain(),
      categories: makeChain(),
      promotions: makeChain(),
      store_prices: makeChain(),
    };

    mockGetSupabaseAdmin.mockReturnValue({
      from: vi.fn((table: string) => chains[table] ?? makeChain()),
    });

    mockFindOrCreateProduct.mockResolvedValue({ id: "prod-uuid" });
  });

  it("returns 401 when unauthenticated", async () => {
    mockRequireApiAuth.mockResolvedValue({
      user: null,
      error: Response.json({ error: "Token de acesso obrigatório." }, { status: 401 }),
    });

    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(401);
  });

  it("returns 429 when rate limited", async () => {
    mockRequireApiAuth.mockResolvedValue({ user: VALID_USER, error: null });
    mockCheckRateLimit.mockReturnValueOnce(false);

    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(429);
  });

  it("returns 400 when storeId is missing", async () => {
    mockRequireApiAuth.mockResolvedValue({ user: VALID_USER, error: null });

    const res = await POST(makeRequest({ products: VALID_BODY.products }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/obrigatório/i);
  });

  it("returns 403 when user is not a store member", async () => {
    mockRequireApiAuth.mockResolvedValue({ user: VALID_USER, error: null });
    chains.store_members.maybeSingle.mockResolvedValue({ data: null, error: null });

    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(403);
  });

  it("publishes 2 products and returns count: 2", async () => {
    mockRequireApiAuth.mockResolvedValue({ user: VALID_USER, error: null });
    chains.store_members.maybeSingle.mockResolvedValue({ data: { store_id: "store-1" }, error: null });
    // categories check returns existing
    chains.categories.maybeSingle.mockResolvedValue({ data: { id: "cat_alimentos" }, error: null });

    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.count).toBe(2);
    expect(json.error).toBeUndefined();
  });

  it("returns partial success when one product fails findOrCreateProduct", async () => {
    mockRequireApiAuth.mockResolvedValue({ user: VALID_USER, error: null });
    chains.store_members.maybeSingle.mockResolvedValue({ data: { store_id: "store-1" }, error: null });
    chains.categories.maybeSingle.mockResolvedValue({ data: { id: "cat_alimentos" }, error: null });

    mockFindOrCreateProduct
      .mockResolvedValueOnce({ id: "prod-1" })
      .mockRejectedValueOnce(new Error("DB timeout"));

    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.count).toBe(1);
    expect(json.error).toMatch(/falharam/i);
  });
});
