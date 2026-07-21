import { describe, it, expect, vi, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks — extraction never resolves, to exercise the soft-timeout race.
// Kept in a separate file from cron-process-single-pdf.test.ts, which
// intentionally leaves import-pipeline unmocked.
// ---------------------------------------------------------------------------

const mockGetSupabaseAdmin = vi.fn();
vi.mock("@/lib/supabase-server", () => ({ getSupabaseAdmin: mockGetSupabaseAdmin }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const mockRunIncrementalExtraction = vi.fn();
vi.mock("@/lib/import-pipeline", () => ({
  runIncrementalExtraction: (...args: unknown[]) => mockRunIncrementalExtraction(...args),
  runIncrementalImageExtraction: vi.fn(),
}));

const { POST } = await import("@/app/api/cron/process-single-pdf/route");

const CRON_SECRET = "placeholder-cron-secret-32-chars-long";
process.env.CRON_SECRET = CRON_SECRET;

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/cron/process-single-pdf", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${CRON_SECRET}` },
    body: JSON.stringify(body),
  });
}

function makeChain() {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    insert: vi.fn().mockResolvedValue({ data: null, error: null }),
    single: vi.fn().mockResolvedValue({
      data: {
        id: "import-1",
        store_id: "store-1",
        source_id: null,
        filename: "huge.pdf",
        storage_path: "store-1/hash.pdf",
        status: "pending",
      },
      error: null,
    }),
  };
}

describe("POST /api/cron/process-single-pdf — soft timeout", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("marks the import as error instead of leaving it stuck at 'processing' when extraction runs past the soft budget", async () => {
    vi.useFakeTimers();

    const chain = makeChain();
    const storageChain = {
      download: vi.fn().mockResolvedValue({
        data: { arrayBuffer: async () => new ArrayBuffer(10) },
        error: null,
      }),
    };

    mockGetSupabaseAdmin.mockReturnValue({
      from: vi.fn().mockReturnValue(chain),
      storage: { from: vi.fn().mockReturnValue(storageChain) },
    });

    // Simulates an extraction that never resolves within a single invocation.
    mockRunIncrementalExtraction.mockReturnValue(new Promise(() => {}));

    const resPromise = POST(makeRequest({ importId: "import-1" }) as Parameters<typeof POST>[0]);
    await vi.advanceTimersByTimeAsync(260_000);
    const res = await resPromise;

    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toMatch(/soft budget/i);

    // The last update() call must land on a terminal status, never leave the
    // row at "processing" — that's what causes the infinite-retry loop.
    const updateCalls = chain.update.mock.calls.map((call) => call[0]);
    const lastUpdate = updateCalls[updateCalls.length - 1];
    expect(lastUpdate).toMatchObject({ status: "error" });
    expect(lastUpdate.error_message).toMatch(/soft budget/i);
  });
});
