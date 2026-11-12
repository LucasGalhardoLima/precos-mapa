// Pure decision logic for notify-tracked-price — no I/O, unit-tested in
// decide.test.ts. index.ts does the reads, the Expo Push call and the writes.

// One row of get_product_prices' jsonb (migration 072) — only the fields used.
export interface PriceRow {
  store_name: string;
  price: number;
  price_type: string; // 'crawler' | 'crowdsourced'
  last_price_date: string; // timestamptz
}

const DAY_MS = 86_400_000;

function daysAgo(lastPriceDate: string, now: Date): number {
  const day = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  return Math.round((day(now) - day(new Date(lastPriceDate))) / DAY_MS);
}

// Only scraper rows: get_product_prices also returns crowdsourced prices, which
// are not part of the daily round and must not trigger a push on their own.
function crawlerPrices(rows: PriceRow[], maxDays: number, now: Date): PriceRow[] {
  return rows.filter((r) => {
    const price = Number(r.price);
    return r.price_type === 'crawler' && Number.isFinite(price) && price > 0 && daysAgo(r.last_price_date, now) <= maxDays;
  });
}

export interface TodayPrice {
  price: number;
  chainLabel: string;
}

// Same 4 labels as mobile/lib/chains.ts (MATAO_CHAINS) — the function can't
// import from mobile/, and store_name is a branch name ("Amarelinha Loja 21
// Flamboyant"), not the market the app shows.
const CHAIN_LABELS = ['Savegnago', 'Jaú Serve', 'Tenda', 'Amarelinha'];

export function chainLabel(storeName: string): string {
  return CHAIN_LABELS.find((l) => storeName.startsWith(l)) ?? storeName;
}

function cheapest(rows: PriceRow[]): PriceRow | null {
  let best: PriceRow | null = null;
  for (const r of rows) if (!best || Number(r.price) < Number(best.price)) best = r;
  return best;
}

// "Preço de hoje" = updated in the last scraper round, i.e. the same UTC
// calendar day — the rule mobile/lib/resposta.ts (daysAgo === 0) and
// use-market-freshness.ts already use. 2–3-day-old prices still show in the
// Resposta's ONDE with "há N dias", but are not pushed as today's price.
export function lowestFreshPrice(rows: PriceRow[], now: Date): TodayPrice | null {
  const best = cheapest(crawlerPrices(rows, 0, now));
  return best ? { price: Number(best.price), chainLabel: chainLabel(best.store_name) } : null;
}

// Lowest crawler price still inside the ONDE window (≤ 3 days, decisão 2).
// Used only to decide re-arming: when one chain's job fails, today's lowest
// comes from the other chains and can sit above target while the cheap
// chain's price hasn't actually changed — re-arming then would push the same
// price again the next day.
export function lowestRecentPrice(rows: PriceRow[], now: Date): number | null {
  const best = cheapest(crawlerPrices(rows, 3, now));
  return best ? Number(best.price) : null;
}

export interface TrackedItem {
  id: string;
  user_id: string;
  product_id: string | null;
  target_price: number | null;
  notified_price: number | null;
}

export interface Recipient {
  pushToken: string | null;
  pushEnabled: boolean; // notification_preferences.push_alerts (missing row = true, the column default)
}

export type Decision =
  | { action: 'send'; price: number; chainLabel: string }
  | { action: 'rearm' }
  | { action: 'skip'; reason: 'no-target' | 'generic-item' | 'no-fresh-price' | 'above-target' | 'already-notified' | 'no-token' | 'muted' };

// Dedupe rule (stored in tracked_items.notified_price, migration 090):
// - push once when today's lowest price reaches target or below;
// - don't push again while it stays at/below target at the same or a higher
//   price than what we last pushed;
// - push again if it drops further below the last pushed price;
// - once it goes back above target, re-arm so the next drop pushes again —
//   but only when no chain still has a recent (≤ 3 days) price at/below
//   target (see lowestRecentPrice).
// No-token / muted never mark the item as notified, so the push goes out on
// the first run after the user grants permission or turns the switch back on.
export function decide(item: TrackedItem, today: TodayPrice | null, recipient: Recipient, recentLowest: number | null = null): Decision {
  if (item.target_price == null) return { action: 'skip', reason: 'no-target' };
  if (item.product_id == null) return { action: 'skip', reason: 'generic-item' };
  if (!today) return { action: 'skip', reason: 'no-fresh-price' };

  const target = Number(item.target_price);
  const notified = item.notified_price == null ? null : Number(item.notified_price);

  if (today.price > target) {
    if (notified == null || (recentLowest != null && recentLowest <= target)) return { action: 'skip', reason: 'above-target' };
    return { action: 'rearm' };
  }
  if (notified != null && today.price >= notified) return { action: 'skip', reason: 'already-notified' };
  if (!recipient.pushToken) return { action: 'skip', reason: 'no-token' };
  if (!recipient.pushEnabled) return { action: 'skip', reason: 'muted' };
  return { action: 'send', price: today.price, chainLabel: today.chainLabel };
}

export function formatBRL(value: number): string {
  return `R$ ${value.toFixed(2).replace('.', ',')}`;
}

// Vocabulary: "acompanhando" — never favorito/alerta/oferta (mobile/CLAUDE.md).
// Wording is a proposal pending Lucas's sign-off (see PR).
export function buildMessage(productName: string, productId: string, price: number, chain: string, target: number) {
  return {
    title: productName,
    body: `${formatBRL(price)} hoje no ${chain}. Você está acompanhando abaixo de ${formatBRL(target)}.`,
    data: { productId },
  };
}
