// Pure decision logic for notify-tracked-price — no I/O, unit-tested in
// decide.test.ts. index.ts does the reads, the Expo Push call and the writes.

// One row of get_product_prices' jsonb (migration 072) — only the fields used.
export interface PriceRow {
  store_name: string;
  price: number;
  last_price_date: string; // timestamptz
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

function utcDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// "Preço de hoje" = updated in the last scraper round, i.e. the same UTC
// calendar day — the rule mobile/lib/resposta.ts (daysAgo === 0) and
// use-market-freshness.ts already use. 2–3-day-old prices still show in the
// Resposta's ONDE with "há N dias", but are not pushed as today's price.
export function lowestFreshPrice(rows: PriceRow[], now: Date): TodayPrice | null {
  const today = utcDay(now);
  let best: PriceRow | null = null;
  for (const r of rows) {
    const price = Number(r.price);
    if (!Number.isFinite(price) || price <= 0) continue;
    if (utcDay(new Date(r.last_price_date)) !== today) continue;
    if (!best || price < Number(best.price)) best = r;
  }
  return best ? { price: Number(best.price), chainLabel: chainLabel(best.store_name) } : null;
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
// - once it goes back above target, re-arm so the next drop pushes again.
// No-token / muted never mark the item as notified, so the push goes out on
// the first run after the user grants permission or turns the switch back on.
export function decide(item: TrackedItem, today: TodayPrice | null, recipient: Recipient): Decision {
  if (item.target_price == null) return { action: 'skip', reason: 'no-target' };
  if (item.product_id == null) return { action: 'skip', reason: 'generic-item' };
  if (!today) return { action: 'skip', reason: 'no-fresh-price' };

  const target = Number(item.target_price);
  const notified = item.notified_price == null ? null : Number(item.notified_price);

  if (today.price > target) {
    return notified == null ? { action: 'skip', reason: 'above-target' } : { action: 'rearm' };
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
