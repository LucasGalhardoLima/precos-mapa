import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { buildMessage, chainLabel, decide, lowestFreshPrice, lowestRecentPrice, type PriceRow, type TrackedItem } from './decide.ts';

const NOW = new Date('2026-11-12T09:30:00Z'); // after the 06:00 UTC scrape round

const row = (store_name: string, price: number, last_price_date: string, price_type = 'crawler'): PriceRow => ({ store_name, price, price_type, last_price_date });
const item = (over: Partial<TrackedItem> = {}): TrackedItem => ({
  id: 't1',
  user_id: 'u1',
  product_id: 'p1',
  target_price: 10,
  notified_price: null,
  ...over,
});
const withToken = { pushToken: 'ExponentPushToken[x]', pushEnabled: true };
const today = (price: number) => ({ price, chainLabel: 'Savegnago' });

Deno.test('lowestFreshPrice: picks the cheapest of today across chains', () => {
  const res = lowestFreshPrice(
    [row('Savegnago', 12.5, '2026-11-12T07:10:00Z'), row('Amarelinha Loja 21 Flamboyant', 9.99, '2026-11-12T08:00:00Z'), row('Jaú Serve', 11, '2026-11-12T06:30:00Z')],
    NOW,
  );
  assertEquals(res, { price: 9.99, chainLabel: 'Amarelinha' });
});

Deno.test('lowestFreshPrice: ignores prices not from the last round, even if cheaper', () => {
  const res = lowestFreshPrice([row('Tenda Atacado - Matão', 5, '2026-11-10T07:00:00Z'), row('Savegnago', 12, '2026-11-12T07:00:00Z')], NOW);
  assertEquals(res, { price: 12, chainLabel: 'Savegnago' });
});

Deno.test('lowestFreshPrice: null when nothing is fresh today', () => {
  assertEquals(lowestFreshPrice([row('Savegnago', 8, '2026-11-11T23:59:00Z')], NOW), null);
  assertEquals(lowestFreshPrice([], NOW), null);
});

Deno.test('lowestFreshPrice: crowdsourced prices never count, even from today', () => {
  const res = lowestFreshPrice([row('Savegnago', 3, '2026-11-12T08:00:00Z', 'crowdsourced'), row('Jaú Serve', 11, '2026-11-12T07:00:00Z')], NOW);
  assertEquals(res, { price: 11, chainLabel: 'Jaú Serve' });
});

Deno.test('lowestRecentPrice: keeps crawler prices up to 3 days old, drops older', () => {
  assertEquals(lowestRecentPrice([row('Tenda Atacado - Matão', 8, '2026-11-09T07:00:00Z'), row('Savegnago', 12, '2026-11-12T07:00:00Z')], NOW), 8);
  assertEquals(lowestRecentPrice([row('Tenda Atacado - Matão', 8, '2026-11-08T07:00:00Z'), row('Savegnago', 12, '2026-11-12T07:00:00Z')], NOW), 12);
});

Deno.test('chainLabel: falls back to the store name for an unknown store', () => {
  assertEquals(chainLabel('Mercado Novo'), 'Mercado Novo');
  assertEquals(chainLabel('Tenda Atacado - Matão'), 'Tenda');
});

Deno.test('decide: sends when today is at or below target and not notified yet', () => {
  assertEquals(decide(item(), today(10), withToken), { action: 'send', price: 10, chainLabel: 'Savegnago' });
  assertEquals(decide(item(), today(9), withToken).action, 'send');
});

Deno.test('decide: no push above target', () => {
  assertEquals(decide(item(), today(10.01), withToken), { action: 'skip', reason: 'above-target' });
});

Deno.test('decide: items without a target are ignored', () => {
  assertEquals(decide(item({ target_price: null }), today(1), withToken), { action: 'skip', reason: 'no-target' });
});

Deno.test('decide: generic (category) items are ignored', () => {
  assertEquals(decide(item({ product_id: null }), today(1), withToken), { action: 'skip', reason: 'generic-item' });
});

Deno.test('decide: no fresh price today → nothing, and dedupe state is kept', () => {
  assertEquals(decide(item({ notified_price: 9 }), null, withToken), { action: 'skip', reason: 'no-fresh-price' });
});

Deno.test('decide dedupe: no resend while price stays at/below target at the same or higher price', () => {
  assertEquals(decide(item({ notified_price: 9 }), today(9), withToken), { action: 'skip', reason: 'already-notified' });
  assertEquals(decide(item({ notified_price: 9 }), today(9.5), withToken), { action: 'skip', reason: 'already-notified' });
});

Deno.test('decide dedupe: resends when it drops further below the last pushed price', () => {
  assertEquals(decide(item({ notified_price: 9 }), today(8.5), withToken).action, 'send');
});

Deno.test('decide dedupe: going back above target re-arms; next drop sends again', () => {
  assertEquals(decide(item({ notified_price: 9 }), today(11), withToken), { action: 'rearm' });
  assertEquals(decide(item({ notified_price: null }), today(9.5), withToken).action, 'send');
});

Deno.test('decide dedupe: no re-arm when the cheap chain only missed today\'s round', () => {
  // Today's lowest (11, other chains) is above target, but the chain that was
  // at 9 two days ago didn't scrape today — re-arming would re-push 9 tomorrow.
  assertEquals(decide(item({ notified_price: 9 }), today(11), withToken, 9), { action: 'skip', reason: 'above-target' });
  assertEquals(decide(item({ notified_price: 9 }), today(11), withToken, 11), { action: 'rearm' });
});

Deno.test('decide: missing token skips without marking as notified', () => {
  assertEquals(decide(item(), today(9), { pushToken: null, pushEnabled: true }), { action: 'skip', reason: 'no-token' });
});

Deno.test('decide: Ajustes switch off (push_alerts=false) skips', () => {
  assertEquals(decide(item(), today(9), { pushToken: 'ExponentPushToken[x]', pushEnabled: false }), { action: 'skip', reason: 'muted' });
});

Deno.test('buildMessage: uses "acompanhando", never the out-of-vocabulary terms', () => {
  const m = buildMessage('Arroz Tio João 5 kg', 'p1', 24.9, 'Tenda', 25);
  assertEquals(m.body, 'R$ 24,90 hoje no Tenda. Você está acompanhando abaixo de R$ 25,00.');
  assertEquals(m.data, { productId: 'p1' });
  const text = `${m.title} ${m.body}`.toLowerCase();
  for (const banned of ['favorito', 'alerta', 'oferta', 'promoç', 'lista']) {
    assertEquals(text.includes(banned), false, banned);
  }
});
