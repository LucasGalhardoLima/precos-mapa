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
