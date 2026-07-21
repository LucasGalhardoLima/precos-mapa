import { describe, it, expect, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mocks — no real network/PDF rendering
// ---------------------------------------------------------------------------

const mockDiscoverAndDownloadAllPdfs = vi.fn();
const mockRenderPdfPagesAsImages = vi.fn();

vi.mock("@/lib/crawler/service", () => ({
  discoverAndDownloadAllPdfs: (...args: unknown[]) => mockDiscoverAndDownloadAllPdfs(...args),
  discoverAndDownloadImages: vi.fn(),
  renderPdfPagesAsImages: (...args: unknown[]) => mockRenderPdfPagesAsImages(...args),
  NATIVE_PDF_MAX_BYTES: 8 * 1024 * 1024,
}));

vi.mock("@/lib/supabase-server", () => ({ getSupabaseAdmin: vi.fn() }));

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

describe("discoverAndPreparePdfFiles", () => {
  it("keeps a small PDF as a single non-image entry", async () => {
    mockDiscoverAndDownloadAllPdfs.mockResolvedValue([
      { pdfBuffer: Buffer.alloc(1024), filename: "small.pdf", resolvedPdfUrl: "https://x/small.pdf" },
    ]);

    const files = await discoverAndPreparePdfFiles("https://x");

    expect(files).toHaveLength(1);
    expect(files[0]).toMatchObject({ filename: "small.pdf", asImage: false });
    expect(mockRenderPdfPagesAsImages).not.toHaveBeenCalled();
  });

  it("keeps an oversized PDF as a single entry when page count is at or under the chunk threshold", async () => {
    mockDiscoverAndDownloadAllPdfs.mockResolvedValue([
      { pdfBuffer: Buffer.alloc(9 * 1024 * 1024), filename: "medium.pdf", resolvedPdfUrl: "https://x/medium.pdf" },
    ]);
    mockRenderPdfPagesAsImages.mockResolvedValue(makePages(6));

    const files = await discoverAndPreparePdfFiles("https://x");

    expect(files).toHaveLength(1);
    expect(files[0]).toMatchObject({ filename: "medium.pdf", asImage: false });
  });

  it("splits an oversized, many-page PDF into one image entry per page", async () => {
    mockDiscoverAndDownloadAllPdfs.mockResolvedValue([
      { pdfBuffer: Buffer.alloc(14 * 1024 * 1024), filename: "Ofertas_de_Matao_13.pdf", resolvedPdfUrl: "https://x/big.pdf" },
    ]);
    mockRenderPdfPagesAsImages.mockResolvedValue(makePages(13));

    const files = await discoverAndPreparePdfFiles("https://x");

    expect(files).toHaveLength(13);
    expect(files.every((f) => f.asImage)).toBe(true);
    expect(files[0].filename).toBe("Ofertas_de_Matao_13_p1.png");
    expect(files[12].filename).toBe("Ofertas_de_Matao_13_p13.png");
    expect(files[0].buffer.equals(Buffer.from("page-1"))).toBe(true);
  });

  it("handles a mix of small and chunked PDFs from the same source", async () => {
    mockDiscoverAndDownloadAllPdfs.mockResolvedValue([
      { pdfBuffer: Buffer.alloc(1024), filename: "small.pdf", resolvedPdfUrl: "https://x/small.pdf" },
      { pdfBuffer: Buffer.alloc(20 * 1024 * 1024), filename: "huge.pdf", resolvedPdfUrl: "https://x/huge.pdf" },
    ]);
    mockRenderPdfPagesAsImages.mockResolvedValue(makePages(10));

    const files = await discoverAndPreparePdfFiles("https://x");

    expect(files).toHaveLength(1 + 10);
    expect(files[0]).toMatchObject({ filename: "small.pdf", asImage: false });
    expect(files.slice(1).every((f) => f.asImage)).toBe(true);
  });
});
