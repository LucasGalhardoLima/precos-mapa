import { formatBRL } from '@/hooks/use-search';
import type { TrackedState } from '@/hooks/use-tracked-items';

// "Depois de acompanhar, a linha vira 'acompanhando · avisar abaixo de R$ X'
// em cinza ... sem aviso, 'acompanhando'" (Lucas, folha Acompanhar spec,
// 2026-09-23) — pulled out as a pure function so the two branches (with/
// without a target price) are unit-testable without mounting the screen.
export function trackedRowLabel(state: TrackedState): string {
  if (state.targetPrice != null) return `acompanhando · avisar abaixo de ${formatBRL(state.targetPrice)}`;
  return 'acompanhando';
}

export interface TrackedReadDeps {
  getUserId(): Promise<string | null>;
  selectTarget(userId: string, productId: string): Promise<{ data: { target_price: number | null } | null; error: unknown }>;
}

export type TrackedReadResult = { status: 'ok'; state: TrackedState } | { status: 'error' };

export async function readTrackedState(deps: TrackedReadDeps, productId: string): Promise<TrackedReadResult> {
  const userId = await deps.getUserId();
  if (!userId) return { status: 'ok', state: { isTracked: false, targetPrice: null } };
  const { data } = await deps.selectTarget(userId, productId);
  return { status: 'ok', state: { isTracked: !!data, targetPrice: data?.target_price ?? null } };
}

export interface TrackedSaveDeps {
  getUserId(): Promise<string | null>;
  signInAnonymously(): Promise<string | null>;
  selectExisting(userId: string, productId: string): Promise<{ data: { id: string } | null; error: unknown }>;
  update(id: string, targetPrice: number | null): Promise<{ error: unknown }>;
  insert(userId: string, productId: string, targetPrice: number | null): Promise<{ error: unknown }>;
}

export async function saveTrackedItem(deps: TrackedSaveDeps, productId: string, targetPrice: number | null): Promise<boolean> {
  let userId = await deps.getUserId();
  if (!userId) userId = await deps.signInAnonymously();
  if (!userId) return false;
  const { data: existing } = await deps.selectExisting(userId, productId);
  const { error } = existing ? await deps.update(existing.id, targetPrice) : await deps.insert(userId, productId, targetPrice);
  return !error;
}
