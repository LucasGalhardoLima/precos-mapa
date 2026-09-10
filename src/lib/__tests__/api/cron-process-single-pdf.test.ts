import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGetSupabaseAdmin = vi.fn();
vi.mock("@/lib/supabase-server", () => ({ getSupabaseAdmin: mockGetSupabaseAdmin }));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

// We do NOT mock runMultiPassExtraction here — we mock the storage download
// and test the status-transition logic at the route level.

// ---------------------------------------------------------------------------
// Import AFTER mocks
// ---------------------------------------------------------------------------
const { POST } = await import("@/app/api/cron/process-single-pdf/route");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CRON_SECRET = "placeholder-cron-secret-32-chars-long";
process.env.CRON_SECRET = CRON_SECRET;

function makeRequest(body: unknown, secret?: string) {
  return new Request("http://localhost/api/cron/process-single-pdf", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${secret ?? CRON_SECRET}`,
    },
    body: JSON.stringify(body),
  });
}

function makeChain(overrides: Record<string, unknown> = {}) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    insert: vi.fn().mockResolvedValue({ data: null, error: null }),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/cron/process-single-pdf", () => {
  beforeEach(() => {
    const chain = makeChain();
    const storageChain = { download: vi.fn() };

    mockGetSupabaseAdmin.mockReturnValue({
      from: vi.fn().mockReturnValue(chain),
      storage: { from: vi.fn().mockReturnValue(storageChain) },
    });
  });

  it("returns 401 when CRON_SECRET is missing", async () => {
    const res = await POST(makeRequest({ importId: "id-1" }, "wrong-secret") as Parameters<typeof POST>[0]);
    expect(res.status).toBe(401);
  });

  it("returns 400 when importId is missing from body", async () => {
    const res = await POST(makeRequest({}) as Parameters<typeof POST>[0]);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/importId/i);
  });

  it("returns 404 when import record is not found", async () => {
    const chain = makeChain();
    chain.single.mockResolvedValue({ data: null, error: { message: "not found" } });

    mockGetSupabaseAdmin.mockReturnValue({
      from: vi.fn().mockReturnValue(chain),
      storage: { from: vi.fn() },
    });

    const res = await POST(makeRequest({ importId: "nonexistent-id" }) as Parameters<typeof POST>[0]);
    expect(res.status).toBe(404);
  });

  it("returns skipped_already_done for already-processed imports", async () => {
    const chain = makeChain();
    chain.single.mockResolvedValue({
      data: {
        id: "import-1",
        store_id: "store-1",
        source_id: null,
        filename: "test.pdf",
        storage_path: "test/test.pdf",
        status: "done",
      },
      error: null,
    });

    mockGetSupabaseAdmin.mockReturnValue({
      from: vi.fn().mockReturnValue(chain),
      storage: { from: vi.fn() },
    });

    const res = await POST(makeRequest({ importId: "import-1" }) as Parameters<typeof POST>[0]);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe("skipped_already_done");
  });
});
