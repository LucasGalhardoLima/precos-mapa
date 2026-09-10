import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockUpdateChain = {
  eq: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  single: vi.fn().mockResolvedValue({ data: null, error: { message: "not found" } }),
};

const mockGetSupabaseAdmin = vi.fn();
vi.mock("@/lib/supabase-server", () => ({ getSupabaseAdmin: mockGetSupabaseAdmin }));

// Import AFTER mocks
const { GET } = await import("@/app/api/unsubscribe/route");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(token?: string) {
  const url = token
    ? `http://localhost/api/unsubscribe?token=${encodeURIComponent(token)}`
    : "http://localhost/api/unsubscribe";
  return new NextRequest(url);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GET /api/unsubscribe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSupabaseAdmin.mockReturnValue({
      from: vi.fn().mockReturnValue(mockUpdateChain),
    });
    mockUpdateChain.eq.mockReturnThis();
    mockUpdateChain.update.mockReturnThis();
    mockUpdateChain.select.mockReturnThis();
    mockUpdateChain.single.mockResolvedValue({ data: null, error: { message: "not found" } });
  });

  it("returns 400 when token query param is missing", async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(400);
    const text = await res.text();
    expect(text).toMatch(/Token ausente/i);
  });

  it("returns 404 HTML when token is not found in DB", async () => {
    mockUpdateChain.single.mockResolvedValue({ data: null, error: { message: "not found" } });

    const res = await GET(makeRequest("invalid-token-xyz"));
    expect(res.status).toBe(404);
    const html = await res.text();
    expect(html).toContain("Link inválido");
  });

  it("returns 200 HTML and rotates token on valid unsubscribe", async () => {
    // First call (update email_digest=false) returns the user_id
    mockUpdateChain.single.mockResolvedValue({ data: { user_id: "user-1" }, error: null });

    const res = await GET(makeRequest("valid-token-abc"));
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Inscrição cancelada");

    // Verify token rotation: update should have been called twice (unsubscribe + rotate)
    expect(mockUpdateChain.update).toHaveBeenCalledTimes(2);
  });
});
