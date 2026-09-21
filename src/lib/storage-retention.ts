/**
 * Retention helpers for the import buckets (pdf-imports, image-imports).
 * Pure logic used by scripts/prune-import-storage.ts, so the parts that decide
 * WHAT gets deleted are unit-tested without touching Storage.
 */

/** Buckets the prune script may touch. Anything else is refused. */
export const IMPORT_BUCKETS = ["pdf-imports", "image-imports"] as const;

export interface StoredObject {
  bucket: string;
  /** Full path inside the bucket, e.g. "<store_id>/<hash>.pdf". */
  path: string;
  size: number;
  createdAt: string;
  updatedAt: string;
}

/** The subset of a Storage `list()` entry this code reads. Folders have id null. */
export interface ListEntry {
  name: string;
  id: string | null;
  created_at: string | null;
  updated_at: string | null;
  metadata: { size?: number } | null;
}

/** Lists one folder page. `prefix` is "" for the bucket root. */
export type ListPage = (prefix: string, offset: number, limit: number) => Promise<ListEntry[]>;

const PAGE_SIZE = 100;

/**
 * Walks a bucket (folders are entries with a null id) and returns every file.
 * Pages until a short page comes back.
 */
export async function collectObjects(bucket: string, list: ListPage, prefix = ""): Promise<StoredObject[]> {
  const found: StoredObject[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const page = await list(prefix, offset, PAGE_SIZE);
    for (const entry of page) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.id === null) {
        found.push(...(await collectObjects(bucket, list, path)));
      } else {
        found.push({
          bucket,
          path,
          size: Number(entry.metadata?.size ?? 0),
          createdAt: entry.created_at ?? "",
          updatedAt: entry.updated_at ?? entry.created_at ?? "",
        });
      }
    }
    if (page.length < PAGE_SIZE) break;
  }
  return found;
}

/** "YYYY-MM-DD" as midnight UTC, or throws. */
export function parseCutoff(cutoff: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cutoff)) throw new Error(`--before must be YYYY-MM-DD, got "${cutoff}"`);
  const date = new Date(`${cutoff}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) throw new Error(`--before is not a real date: "${cutoff}"`);
  return date;
}

/**
 * Refuses a cutoff that would reach into files the import pipeline may still
 * be working on (a typo like 2026-09-01 instead of 2026-08-01 must not delete
 * this month's files).
 */
export function assertSafeCutoff(cutoff: string, now: Date, minAgeDays = 14): void {
  const limit = new Date(now.getTime() - minAgeDays * 86_400_000);
  if (parseCutoff(cutoff) > limit) {
    throw new Error(`--before ${cutoff} is less than ${minAgeDays} days ago; refusing to delete files that recent`);
  }
}

/**
 * True when the file was both created AND last written before the cutoff. An
 * old file that was re-uploaded (the import uses upsert) after the cutoff is
 * kept: something touched it recently. A missing timestamp counts as recent.
 */
export function isOlderThan(obj: StoredObject, cutoff: string): boolean {
  const limit = parseCutoff(cutoff).getTime();
  const created = Date.parse(obj.createdAt);
  const updated = Date.parse(obj.updatedAt);
  if (Number.isNaN(created) || Number.isNaN(updated)) return false;
  return created < limit && updated < limit;
}

export function selectForDeletion(objects: StoredObject[], cutoff: string): StoredObject[] {
  return objects.filter((o) => isOlderThan(o, cutoff));
}

export interface BucketTotals {
  count: number;
  bytes: number;
}

export function summarize(objects: StoredObject[]): { perBucket: Record<string, BucketTotals>; total: BucketTotals } {
  const perBucket: Record<string, BucketTotals> = {};
  const total: BucketTotals = { count: 0, bytes: 0 };
  for (const o of objects) {
    const b = (perBucket[o.bucket] ??= { count: 0, bytes: 0 });
    b.count += 1;
    b.bytes += o.size;
    total.count += 1;
    total.bytes += o.size;
  }
  return { perBucket, total };
}

export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export function formatMB(bytes: number): string {
  return `${(bytes / 1_048_576).toLocaleString("en-US", { maximumFractionDigits: 1 })} MB`;
}
