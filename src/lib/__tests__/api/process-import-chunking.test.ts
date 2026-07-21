import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks — no real network/PDF rendering
// ---------------------------------------------------------------------------

const mockDiscoverAndDownloadAllPdfs = vi.fn();
const mockGetPdfPageCount = vi.fn();
const mockRenderPdfPagesIncrementally = vi.fn();

vi.mock("@/lib/crawler/service", () => ({
  discoverAndDownloadAllPdfs: (...args: unknown[]) => mockDiscoverAndDownloadAllPdfs(...args),
  discoverAndDownloadImages: vi.fn(),
  getPdfPageCount: (...args: unknown[]) => mockGetPdfPageCount(...args),
  renderPdfPagesIncrementally: (...args: unknown[]) => mockRenderPdfPagesIncrementally(...args),
  NATIVE_PDF_MAX_BYTES: 8 * 1024 * 1024,
}));

const mockGetSupabaseAdmin = vi.fn();
vi.mock("@/lib/supabase-server", () => ({ getSupabaseAdmin: mockGetSupabaseAdmin }));

const { discoverAndPreparePdfFiles } = await import("@/app/api/cron/process-import/route");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePages(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    buffer: Buffer.from(`page-${i + 1}`),
    pageNumber: i + 1,
    totalPages: count,
  }));
}

// Drives renderPdfPagesIncrementally's onPage callback for a given page set,
// mirroring the real (streaming) implementation closely enough for tests.
function mockIncrementalRender(pages: ReturnType<typeof makePages>) {
  mockRenderPdfPagesIncrementally.mockImplementation(async (_buffer: unknown, onPage: (p: unknown) => Promise<void>) => {
    for (const page of pages) await onPage(page);
  });
}

// existingStatus: status of a pre-existing pdf_imports row for this hash, or
// null/undefined if none exists.
function mockDedupLookup(existingStatus: string | null | undefined) {
  const maybeSingle = vi.fn().mockResolvedValue({
    data: existingStatus ? { status: existingStatus } : null,
    error: null,
  });
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle,
  };
  mockGetSupabaseAdmin.mockReturnValue({ from: vi.fn().mockReturnValue(chain) });
  return chain;
}

const STORE_ID = "store-1";

describe("discoverAndPreparePdfFiles", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps a small PDF as a single non-image entry, without touching dedup or rendering", async () => {
    mockDiscoverAndDownloadAllPdfs.mockResolvedValue([
      { pdfBuffer: Buffer.alloc(1024), filename: "small.pdf", resolvedPdfUrl: "https://x/small.pdf" },
    ]);

    const files = await discoverAndPreparePdfFiles("https://x", STORE_ID);

    expect(files).toHaveLength(1);
    expect(files[0]).toMatchObject({ filename: "small.pdf", asImage: false });
    expect(mockGetSupabaseAdmin).not.toHaveBeenCalled();
    expect(mockGetPdfPageCount).not.toHaveBeenCalled();
    expect(mockRenderPdfPagesIncrementally).not.toHaveBeenCalled();
  });

  it("skips page-count and rendering entirely for an oversized PDF that's already done", async () => {
    mockDiscoverAndDownloadAllPdfs.mockResolvedValue([
      { pdfBuffer: Buffer.alloc(20 * 1024 * 1024), filename: "already-done.pdf", resolvedPdfUrl: "https://x/a.pdf" },
    ]);
    mockDedupLookup("done");

    const files = await discoverAndPreparePdfFiles("https://x", STORE_ID);

    expect(files).toHaveLength(1);
    expect(files[0]).toMatchObject({ filename: "already-done.pdf", asImage: false });
    expect(mockGetPdfPageCount).not.toHaveBeenCalled();
    expect(mockRenderPdfPagesIncrementally).not.toHaveBeenCalled();
  });

  it("keeps an oversized, not-yet-done PDF as a single entry when page count is at or under the chunk threshold", async () => {
    mockDiscoverAndDownloadAllPdfs.mockResolvedValue([
      { pdfBuffer: Buffer.alloc(9 * 1024 * 1024), filename: "medium.pdf", resolvedPdfUrl: "https://x/medium.pdf" },
    ]);
    mockDedupLookup(null);
    mockGetPdfPageCount.mockResolvedValue(6);

    const files = await discoverAndPreparePdfFiles("https://x", STORE_ID);

    expect(files).toHaveLength(1);
    expect(files[0]).toMatchObject({ filename: "medium.pdf", asImage: false });
    expect(mockRenderPdfPagesIncrementally).not.toHaveBeenCalled();
  });

  it("splits an oversized, not-yet-done, many-page PDF into one image entry per page", async () => {
    mockDiscoverAndDownloadAllPdfs.mockResolvedValue([
      { pdfBuffer: Buffer.alloc(14 * 1024 * 1024), filename: "Ofertas_de_Matao_13.pdf", resolvedPdfUrl: "https://x/big.pdf" },
    ]);
    mockDedupLookup(null);
    mockGetPdfPageCount.mockResolvedValue(13);
    mockIncrementalRender(makePages(13));

    const files = await discoverAndPreparePdfFiles("https://x", STORE_ID);

    expect(files).toHaveLength(13);
    expect(files.every((f) => f.asImage)).toBe(true);
    expect(files[0].filename).toBe("Ofertas_de_Matao_13_p1.png");
    expect(files[12].filename).toBe("Ofertas_de_Matao_13_p13.png");
    expect(files[0].buffer.equals(Buffer.from("page-1"))).toBe(true);
  });

  it("re-attempts a many-page PDF stuck in a non-done status (e.g. a stale 'processing' row) via chunking", async () => {
    mockDiscoverAndDownloadAllPdfs.mockResolvedValue([
      { pdfBuffer: Buffer.alloc(14 * 1024 * 1024), filename: "stuck.pdf", resolvedPdfUrl: "https://x/stuck.pdf" },
    ]);
    mockDedupLookup("processing");
    mockGetPdfPageCount.mockResolvedValue(10);
    mockIncrementalRender(makePages(10));

    const files = await discoverAndPreparePdfFiles("https://x", STORE_ID);

    expect(files).toHaveLength(10);
    expect(files.every((f) => f.asImage)).toBe(true);
  });

  it("handles a mix of small and chunked PDFs from the same source", async () => {
    mockDiscoverAndDownloadAllPdfs.mockResolvedValue([
      { pdfBuffer: Buffer.alloc(1024), filename: "small.pdf", resolvedPdfUrl: "https://x/small.pdf" },
      { pdfBuffer: Buffer.alloc(20 * 1024 * 1024), filename: "huge.pdf", resolvedPdfUrl: "https://x/huge.pdf" },
    ]);
    mockDedupLookup(null);
    mockGetPdfPageCount.mockResolvedValue(10);
    mockIncrementalRender(makePages(10));

    const files = await discoverAndPreparePdfFiles("https://x", STORE_ID);

    expect(files).toHaveLength(1 + 10);
    expect(files[0]).toMatchObject({ filename: "small.pdf", asImage: false });
    expect(files.slice(1).every((f) => f.asImage)).toBe(true);
  });
});
