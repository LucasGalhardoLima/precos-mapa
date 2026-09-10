import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockConstructEvent = vi.fn();
const mockSubscriptionsRetrieve = vi.fn();

vi.mock("@/lib/stripe", () => ({
  getStripe: vi.fn(() => ({
    webhooks: { constructEvent: mockConstructEvent },
    subscriptions: { retrieve: mockSubscriptionsRetrieve },
  })),
}));

const mockStoresChain = {
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  single: vi.fn().mockResolvedValue({ data: { stripe_customer_id: null }, error: null }),
};

const mockWebhookEventsChain = {
  insert: vi.fn().mockResolvedValue({ data: null, error: null }),
};

const mockGetSupabaseAdmin = vi.fn();

vi.mock("@/lib/supabase-server", () => ({ getSupabaseAdmin: mockGetSupabaseAdmin }));

// Import AFTER mocks
const { POST } = await import("@/app/api/webhooks/stripe/route");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(body: string, signature: string | null) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (signature) headers["stripe-signature"] = signature;
  return new Request("http://localhost/api/webhooks/stripe", {
    method: "POST",
    headers,
    body,
  });
}

const STORE_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
const CHECKOUT_EVENT = {
  id: "evt_test_1",
  type: "checkout.session.completed",
  data: {
    object: {
      metadata: { store_id: STORE_ID },
      customer: "cus_test",
      subscription: "sub_test",
    },
  },
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/webhooks/stripe", () => {
  beforeEach(() => {
    mockGetSupabaseAdmin.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "webhook_events") return mockWebhookEventsChain;
        return mockStoresChain;
      }),
    });

    mockStoresChain.single.mockResolvedValue({ data: { stripe_customer_id: null }, error: null });
    mockWebhookEventsChain.insert.mockResolvedValue({ data: null, error: null });
    mockSubscriptionsRetrieve.mockResolvedValue({
      id: "sub_test",
      items: { data: [{ price: { id: "" } }] },
      trial_end: null,
    });
  });

  it("returns 400 when stripe-signature header is missing", async () => {
    const res = await POST(makeRequest("{}", null) as Parameters<typeof POST>[0]);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/signature/i);
  });

  it("returns 400 when signature is invalid", async () => {
    mockConstructEvent.mockImplementationOnce(() => {
      throw new Error("No signatures found matching the expected signature");
    });

    const res = await POST(makeRequest("{}", "bad-sig") as Parameters<typeof POST>[0]);
    expect(res.status).toBe(400);
  });

  it("handles checkout.session.completed and returns 200", async () => {
    mockConstructEvent.mockReturnValue(CHECKOUT_EVENT);

    const res = await POST(makeRequest(JSON.stringify(CHECKOUT_EVENT), "valid-sig") as Parameters<typeof POST>[0]);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.received).toBe(true);
  });

  it("returns 200 no-op for unknown event types", async () => {
    mockConstructEvent.mockReturnValue({ id: "evt_2", type: "unknown.event", data: { object: {} } });

    const res = await POST(makeRequest("{}", "valid-sig") as Parameters<typeof POST>[0]);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.received).toBe(true);
  });

  it("returns 200 with duplicate:true for replayed events", async () => {
    mockConstructEvent.mockReturnValue(CHECKOUT_EVENT);
    mockWebhookEventsChain.insert.mockResolvedValue({
      data: null,
      error: { code: "23505", message: "unique_violation" },
    });

    const res = await POST(makeRequest(JSON.stringify(CHECKOUT_EVENT), "valid-sig") as Parameters<typeof POST>[0]);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.duplicate).toBe(true);
  });
});
