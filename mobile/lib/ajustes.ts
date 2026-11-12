import type { NearbyStore } from '@/hooks/use-stores';

// Pure logic of the Ajustes screen (artifact 6a/6b, docs/poup-mlp-decisoes.md
// "Ajustes (7a/7b)"). Kept free of I/O so each rule is unit-testable without
// mounting the screen — same convention as lib/raiz.ts and lib/resposta.ts.

// Same ceiling as Raiz (mobile/CLAUDE.md "Tetos"): 4 + "ver todos os N".
export const AJUSTES_TETO = 4;

// The artifact removes with an undo bar that lingers 5 s (its own script:
// setTimeout(..., 5000)).
export const UNDO_MS = 5000;

// Event names for this screen. AnalyticsEventType (packages/shared) is a
// closed union that this task may not edit, and analytics_events.event_type is
// plain text with no CHECK (migration 020), so the names live here and
// use-analytics' track() accepts them alongside the shared ones.
// shortcut: names declared locally — upgrade: move into AnalyticsEventType in
// packages/shared when that package is open for changes.
export type AjustesEventType =
  | 'settings_item_removed'
  | 'settings_item_restored'
  | 'settings_item_opened'
  | 'settings_see_all_items'
  | 'settings_location_swap_opened'
  | 'settings_location_changed'
  | 'settings_notifications_on'
  | 'settings_notifications_off'
  | 'settings_notifications_blocked_link';

export function trackedHeader(count: number): string {
  return `ITENS ACOMPANHADOS · ${count}`;
}

export function verTodosLabel(count: number): string {
  return `ver todos os ${count}`;
}

export function visibleItems<T>(items: readonly T[], expanded: boolean): T[] {
  return expanded ? [...items] : items.slice(0, AJUSTES_TETO);
}

export function hasMoreItems(count: number, expanded: boolean): boolean {
  return !expanded && count > AJUSTES_TETO;
}

export function undoText(name: string): string {
  return `${name} removido`;
}

// Ajustes never creates an anonymous session just to be looked at, so "no
// session" is a real, empty list — but a failed read is NOT empty (judgment
// question 1/2 in the Personal CLAUDE.md): it must not render "Nenhum ainda".
export type TrackedListStatus = 'loading' | 'error' | 'empty' | 'items';

export function trackedListStatus(isLoading: boolean, hasError: boolean, count: number): TrackedListStatus {
  if (isLoading) return 'loading';
  if (hasError) return 'error';
  return count === 0 ? 'empty' : 'items';
}

// Display name of one tracked row: "Arroz Tio João tipo 1 · 5 kg" in the
// artifact — name plus the size when the catalog has one.
export function trackedItemName(name: string, size: string | null): string {
  return size ? `${name} · ${size}` : name;
}

// Restores a removed row to the slot it left (the artifact splices it back at
// the same index), clamped in case the list shrank in the meantime.
export function insertAt<T>(items: readonly T[], item: T, index: number): T[] {
  const next = [...items];
  next.splice(Math.min(Math.max(index, 0), next.length), 0, item);
  return next;
}

export function removeAt<T>(items: readonly T[], index: number): T[] {
  return items.filter((_, i) => i !== index);
}

// --- Localização ---------------------------------------------------------

export interface HereStore {
  chainLabel: string;
  distanceKm: number | null;
  // 'chosen' = picked in "trocar"; 'nearest' = by GPS. The label must not call
  // a chosen market "mais perto".
  source: 'chosen' | 'nearest';
}

// "Localização mostra o 'aqui' atual, coerente com a Resposta" (artifact 6b
// note): the chain the user swapped to in the "trocar" sheet wins; otherwise
// the nearest chain by GPS. Null when neither applies (no preference and no
// distances), so the screen omits the line instead of inventing a market.
export function resolveHereStore(stores: readonly NearbyStore[], preferredChain: string | null): HereStore | null {
  if (preferredChain) {
    const preferred = stores.find((s) => s.chainLabel === preferredChain);
    if (preferred) return { chainLabel: preferred.chainLabel, distanceKm: preferred.distanceKm, source: 'chosen' };
  }
  let best: NearbyStore | null = null;
  for (const s of stores) {
    if (s.distanceKm == null) continue;
    if (!best || s.distanceKm < best.distanceKm!) best = s;
  }
  return best ? { chainLabel: best.chainLabel, distanceKm: best.distanceKm, source: 'nearest' } : null;
}

export function hereSubtitle(here: HereStore | null): string | null {
  if (!here) return null;
  const prefix = here.source === 'chosen' ? 'seu mercado' : 'mais perto';
  if (here.distanceKm == null) return `${prefix}: ${here.chainLabel}`;
  return `${prefix}: ${here.chainLabel} · ${here.distanceKm.toFixed(1).replace('.', ',')} km`;
}

// use-location falls back to a hardcoded city ("Matao", no tilde) that must
// never be shown as if it were the user's real one; the app only covers Matão,
// so the covered area is the honest label until a city is actually resolved.
export function cityLabel(hasResolvedLocation: boolean, city: string): string {
  return hasResolvedLocation ? city : 'Matão';
}

// --- Notificações --------------------------------------------------------

export type SystemPermission = 'granted' | 'denied' | 'undetermined';

export type NotificationUi =
  | { kind: 'on' }
  | { kind: 'off' }
  // Denied in the system: switch locked, "Ajustes do aparelho ›" link (6b).
  | { kind: 'blocked' };

// `enabled` is the user's own choice (default on). Undetermined reads as off:
// nothing has been granted, so claiming "on" would promise pushes that cannot
// arrive; tapping the switch is what asks.
export function resolveNotificationUi(permission: SystemPermission, enabled: boolean): NotificationUi {
  if (permission === 'denied') return { kind: 'blocked' };
  if (permission === 'granted' && enabled) return { kind: 'on' };
  return { kind: 'off' };
}

export function toPermission(status: string): SystemPermission {
  if (status === 'granted') return 'granted';
  if (status === 'denied') return 'denied';
  return 'undetermined';
}
