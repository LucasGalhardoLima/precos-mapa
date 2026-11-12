import { loadOnboarding, areItemsMigrated, markItemsMigrated, type OnboardingItem } from '@/lib/onboarding';

// Copies the items chosen in onboarding (AsyncStorage `poup:onboarding`) into
// `tracked_items`, the single source of the user's items. Used both at the end
// of onboarding and as the one-shot migration for devices that finished
// onboarding before tracked_items existed: the same idempotent function, so a
// write that failed at the end of onboarding is simply retried on the next
// opening.
//
// target_price is always null: these are "acompanhar sem avisos" rows.

export interface NewTrackedRow {
  user_id: string;
  product_id?: string;
  category_label?: string;
  category_size?: string;
  target_price: null;
  created_at: string;
}

// What identifies a row for the partial unique indexes of migration 084.
export interface TrackedKey {
  product_id?: string | null;
  category_label?: string | null;
  category_size?: string | null;
}

export function keyOf(row: TrackedKey): string {
  return row.product_id ? `p:${row.product_id}` : `c:${row.category_label}|${row.category_size}`;
}

// A pinned item becomes an item-product; an unpinned one stays generic
// (category + size). created_at is spread 1 ms apart: a single INSERT shares
// one now(), and both Raiz and Ajustes order by created_at, so without this
// the onboarding order would be lost.
export function buildRows(items: readonly OnboardingItem[], userId: string, now: number): NewTrackedRow[] {
  const seen = new Set<string>();
  const rows: NewTrackedRow[] = [];
  for (const item of items) {
    const identity = item.product ? { product_id: item.product.id } : { category_label: item.label, category_size: item.size };
    const key = keyOf(identity);
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({ user_id: userId, ...identity, target_price: null, created_at: new Date(now + rows.length).toISOString() });
  }
  return rows;
}

// Only what the user does not already have: a unique violation would reject
// the whole batch, and the unique indexes are partial so upsert can't be used.
export function rowsToInsert(rows: readonly NewTrackedRow[], existing: readonly TrackedKey[]): NewTrackedRow[] {
  const have = new Set(existing.map(keyOf));
  return rows.filter((r) => !have.has(keyOf(r)));
}

export interface SyncDeps {
  getUserId(): Promise<string | null>;
  signInAnonymously(): Promise<string | null>;
  // Both throw on failure.
  listExisting(userId: string): Promise<TrackedKey[]>;
  insert(rows: NewTrackedRow[]): Promise<void>;
  now(): number;
}

export type SyncOutcome = 'nothing-to-do' | 'synced' | 'failed';

async function run(deps: SyncDeps): Promise<SyncOutcome> {
  if (await areItemsMigrated()) return 'nothing-to-do';
  const onboarding = await loadOnboarding();
  if (!onboarding) return 'nothing-to-do';
  if (onboarding.items.length === 0) {
    // Nothing was chosen: no row to write, and nothing to retry later.
    await markItemsMigrated();
    return 'nothing-to-do';
  }
  try {
    const userId = (await deps.getUserId()) ?? (await deps.signInAnonymously());
    if (!userId) return 'failed';
    const wanted = buildRows(onboarding.items, userId, deps.now());
    const missing = rowsToInsert(wanted, await deps.listExisting(userId));
    if (missing.length > 0) await deps.insert(missing);
    // Only after the rows are confirmed — a failure above leaves the flag unset.
    await markItemsMigrated();
    return 'synced';
  } catch {
    return 'failed';
  }
}

// One run at a time: onboarding and Raiz can both ask while a slow request is
// in flight, and two overlapping runs would race on the unique indexes.
let inFlight: Promise<SyncOutcome> | null = null;

export function syncOnboardingItems(deps: SyncDeps): Promise<SyncOutcome> {
  if (!inFlight) {
    inFlight = run(deps).finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}
