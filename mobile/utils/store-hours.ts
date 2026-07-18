export type DayHours = { open: string; close: string } | null;
export type OpeningHours = Record<string, DayHours>;

const WEEKDAY_TO_INDEX: Record<string, number> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
};

/**
 * Returns true/false if the store is open/closed right now in Brazil time,
 * or null if opening_hours data isn't set yet.
 */
export function computeIsOpen(openingHours: OpeningHours | null | undefined): boolean | null {
  if (!openingHours) return null;

  // Brazil (Matão/SP) is UTC-3 — no DST since 2019.
  // Uses Intl.DateTimeFormat#formatToParts, not `new Date(toLocaleString())` —
  // that round-trip depends on the Date constructor's non-standardized string
  // parser, which behaves differently on Hermes (React Native) than on
  // V8/Node: it silently produced an Invalid Date on-device, so every store
  // showed "Fechado" regardless of the actual time, even though the same
  // logic worked correctly under Node.
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);

  const weekday = parts.find((p) => p.type === 'weekday')?.value ?? '';
  const hour = Number(parts.find((p) => p.type === 'hour')?.value);
  const minute = Number(parts.find((p) => p.type === 'minute')?.value);

  if (!(weekday in WEEKDAY_TO_INDEX) || Number.isNaN(hour) || Number.isNaN(minute)) return null;

  const day = String(WEEKDAY_TO_INDEX[weekday]); // "0"=Sun … "6"=Sat
  const hours = openingHours[day];

  if (!hours) return false; // explicitly closed this day

  const [openH, openM] = hours.open.split(':').map(Number);
  const [closeH, closeM] = hours.close.split(':').map(Number);
  const current = hour * 60 + minute;

  return current >= openH * 60 + openM && current < closeH * 60 + closeM;
}
