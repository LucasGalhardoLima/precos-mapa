import { describe, it, expect } from "vitest";
import {
  collectObjects,
  parseCutoff,
  assertSafeCutoff,
  isOlderThan,
  selectForDeletion,
  summarize,
  chunk,
  formatMB,
  IMPORT_BUCKETS,
  type ListEntry,
  type StoredObject,
} from "../storage-retention";

const obj = (over: Partial<StoredObject> = {}): StoredObject => ({
  bucket: "pdf-imports",
  path: "store-1/abc.pdf",
  size: 1_048_576,
  createdAt: "2026-06-10T12:00:00Z",
  updatedAt: "2026-06-10T12:00:00Z",
  ...over,
});

describe("parseCutoff / assertSafeCutoff", () => {
  it("accepts YYYY-MM-DD as midnight UTC", () => {
    expect(parseCutoff("2026-08-01").toISOString()).toBe("2026-08-01T00:00:00.000Z");
  });

  it.each(["2026-8-1", "08/01/2026", "2026-13-01", "", "2026-02-30x"])("rejects %j", (bad) => {
    expect(() => parseCutoff(bad)).toThrow();
  });

  it("refuses a cutoff inside the last 14 days", () => {
    const now = new Date("2026-09-22T00:00:00Z");
    expect(() => assertSafeCutoff("2026-09-10", now)).toThrow(/less than 14 days/);
    expect(() => assertSafeCutoff("2026-09-30", now)).toThrow();
  });

  it("allows an older cutoff", () => {
    expect(() => assertSafeCutoff("2026-08-01", new Date("2026-09-22T00:00:00Z"))).not.toThrow();
  });
});

describe("isOlderThan", () => {
  it("is true only when created AND updated are before the cutoff", () => {
    expect(isOlderThan(obj(), "2026-08-01")).toBe(true);
  });

  it("keeps a file created before the cutoff but re-uploaded after it", () => {
    expect(isOlderThan(obj({ updatedAt: "2026-08-15T00:00:00Z" }), "2026-08-01")).toBe(false);
  });

  it("keeps a file created after the cutoff", () => {
    expect(isOlderThan(obj({ createdAt: "2026-08-02T00:00:00Z", updatedAt: "2026-08-02T00:00:00Z" }), "2026-08-01")).toBe(false);
  });

  it("the cutoff instant itself is kept (strictly before)", () => {
    expect(isOlderThan(obj({ createdAt: "2026-08-01T00:00:00Z", updatedAt: "2026-08-01T00:00:00Z" }), "2026-08-01")).toBe(false);
  });

  it("a missing or unparseable timestamp counts as recent, never deletable", () => {
    expect(isOlderThan(obj({ createdAt: "" }), "2026-08-01")).toBe(false);
    expect(isOlderThan(obj({ updatedAt: "not a date" }), "2026-08-01")).toBe(false);
  });
});

describe("selectForDeletion / summarize", () => {
  const objects = [
    obj({ path: "s/old1.pdf", size: 100 }),
    obj({ path: "s/old2.pdf", size: 200, bucket: "image-imports" }),
    obj({ path: "s/new.pdf", size: 400, createdAt: "2026-09-01T00:00:00Z", updatedAt: "2026-09-01T00:00:00Z" }),
  ];

  it("selects only the old files", () => {
    expect(selectForDeletion(objects, "2026-08-01").map((o) => o.path)).toEqual(["s/old1.pdf", "s/old2.pdf"]);
  });

  it("totals per bucket and overall", () => {
    const { perBucket, total } = summarize(selectForDeletion(objects, "2026-08-01"));
    expect(perBucket).toEqual({ "pdf-imports": { count: 1, bytes: 100 }, "image-imports": { count: 1, bytes: 200 } });
    expect(total).toEqual({ count: 2, bytes: 300 });
  });
});

describe("collectObjects", () => {
  const file = (name: string, size: number): ListEntry => ({
    name,
    id: `id-${name}`,
    created_at: "2026-06-01T00:00:00Z",
    updated_at: "2026-06-01T00:00:00Z",
    metadata: { size },
  });
  const folder = (name: string): ListEntry => ({ name, id: null, created_at: null, updated_at: null, metadata: null });

  it("walks folders and joins their paths", async () => {
    const tree: Record<string, ListEntry[]> = {
      "": [folder("store-a"), folder("store-b")],
      "store-a": [file("1.pdf", 10)],
      "store-b": [file("2.pdf", 20), file("3.pdf", 30)],
    };
    const out = await collectObjects("pdf-imports", async (prefix) => tree[prefix] ?? []);
    expect(out.map((o) => o.path)).toEqual(["store-a/1.pdf", "store-b/2.pdf", "store-b/3.pdf"]);
    expect(out.map((o) => o.size)).toEqual([10, 20, 30]);
    expect(out.every((o) => o.bucket === "pdf-imports")).toBe(true);
  });

  it("pages past 100 entries in a folder", async () => {
    const all = Array.from({ length: 230 }, (_, i) => file(`f${i}.pdf`, 1));
    const offsets: number[] = [];
    const out = await collectObjects("b", async (prefix, offset, limit) => {
      offsets.push(offset);
      return prefix === "" ? all.slice(offset, offset + limit) : [];
    });
    expect(out).toHaveLength(230);
    expect(offsets).toEqual([0, 100, 200]);
  });

  it("stops on an exactly-full page followed by an empty one", async () => {
    const all = Array.from({ length: 100 }, (_, i) => file(`f${i}.pdf`, 1));
    const out = await collectObjects("b", async (_p, offset, limit) => all.slice(offset, offset + limit));
    expect(out).toHaveLength(100);
  });
});

describe("helpers", () => {
  it("chunk splits without losing items", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([], 3)).toEqual([]);
  });

  it("formatMB", () => {
    expect(formatMB(1_048_576)).toBe("1 MB");
    expect(formatMB(0)).toBe("0 MB");
  });

  it("only the two import buckets are listed as prunable", () => {
    expect([...IMPORT_BUCKETS]).toEqual(["pdf-imports", "image-imports"]);
  });
});
