// notify-tracked-price — "Acompanhar e avisar" push for the MLP.
// Called once after each daily scrape round (.github/workflows/scrape-prices.yml,
// job `notify`). For every tracked_items row with a target_price and a pinned
// product, compares the lowest price from today's round (get_product_prices,
// the same RPC the Resposta screen uses) with the target and pushes via Expo.
// Decision + dedupe rules live in decide.ts.
//
// POST body (optional): { "dry_run": true } → returns the decisions without
// sending any push or writing anything.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { buildMessage, decide, lowestFreshPrice, type Decision, type PriceRow, type TodayPrice, type TrackedItem } from './decide.ts';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const EXPO_BATCH = 100; // Expo Push API limit per request

interface PendingSend {
  item: TrackedItem;
  token: string;
  price: number;
  message: ReturnType<typeof buildMessage>;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

Deno.serve(async (req) => {
  if (req.headers.get('authorization') !== `Bearer ${Deno.env.get('EDGE_FUNCTION_SECRET')}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const dryRun = body?.dry_run === true;
    const now = new Date();

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const { data: items, error: itemsErr } = await supabase
      .from('tracked_items')
      .select('id, user_id, product_id, target_price, notified_price')
      .not('target_price', 'is', null)
      .not('product_id', 'is', null);
    if (itemsErr) throw itemsErr;
    if (!items || items.length === 0) return json({ dry_run: dryRun, items: 0, sent: 0 });

    const userIds = [...new Set(items.map((i) => i.user_id as string))];
    const productIds = [...new Set(items.map((i) => i.product_id as string))];

    // shortcut: one get_product_prices call per distinct tracked product, all in
    // parallel — fine for the MLP's handful of tracked products. Upgrade: a
    // set-based RPC (min fresh price per product_id) if this grows to thousands.
    const [profilesRes, prefsRes, productsRes, priceResults] = await Promise.all([
      supabase.from('profiles').select('id, push_token').in('id', userIds),
      supabase.from('notification_preferences').select('user_id, push_alerts').in('user_id', userIds),
      supabase.from('products').select('id, name').in('id', productIds),
      Promise.all(productIds.map((id) => supabase.rpc('get_product_prices', { product_id: id }).then((r) => [id, r] as const))),
    ]);
    if (profilesRes.error) throw profilesRes.error;
    if (prefsRes.error) throw prefsRes.error;
    if (productsRes.error) throw productsRes.error;

    const tokenByUser = new Map((profilesRes.data ?? []).map((p) => [p.id as string, (p.push_token as string | null) ?? null]));
    const enabledByUser = new Map((prefsRes.data ?? []).map((p) => [p.user_id as string, p.push_alerts !== false]));
    const nameByProduct = new Map((productsRes.data ?? []).map((p) => [p.id as string, p.name as string]));
    const todayByProduct = new Map<string, TodayPrice | null>();
    for (const [id, res] of priceResults) {
      if (res.error) console.error('get_product_prices failed', id, res.error);
      todayByProduct.set(id, res.error ? null : lowestFreshPrice((res.data ?? []) as PriceRow[], now));
    }

    const decisions: { id: string; decision: Decision }[] = [];
    const sends: PendingSend[] = [];
    const rearmIds: string[] = [];

    for (const raw of items) {
      const item = raw as TrackedItem;
      const token = tokenByUser.get(item.user_id) ?? null;
      const decision = decide(item, todayByProduct.get(item.product_id!) ?? null, {
        pushToken: token,
        pushEnabled: enabledByUser.get(item.user_id) ?? true,
      });
      decisions.push({ id: item.id, decision });

      if (decision.action === 'rearm') rearmIds.push(item.id);
      if (decision.action === 'send') {
        const name = nameByProduct.get(item.product_id!);
        if (!name) continue;
        sends.push({
          item,
          token: token!,
          price: decision.price,
          message: buildMessage(name, item.product_id!, decision.price, decision.chainLabel, Number(item.target_price)),
        });
      }
    }

    if (dryRun) {
      return json({ dry_run: true, items: items.length, would_send: sends.length, would_rearm: rearmIds.length, decisions });
    }

    if (rearmIds.length > 0) {
      const { error } = await supabase.from('tracked_items').update({ notified_price: null }).in('id', rearmIds);
      if (error) console.error('rearm failed', error);
    }

    // Only items whose Expo ticket came back ok are marked notified — a failed
    // send is retried on the next run instead of being silently swallowed.
    let sent = 0;
    for (let i = 0; i < sends.length; i += EXPO_BATCH) {
      const batch = sends.slice(i, i + EXPO_BATCH);
      const res = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(batch.map((s) => ({ to: s.token, sound: 'default', ...s.message }))),
      });
      if (!res.ok) {
        console.error('Expo Push API error', res.status, await res.text());
        continue;
      }
      const tickets = ((await res.json())?.data ?? []) as { status: string; details?: unknown }[];
      const marks = batch
        .map((s, idx) => ({ s, ticket: tickets[idx] }))
        .filter(({ s, ticket }) => {
          if (ticket?.status === 'ok') return true;
          console.error('Expo ticket not ok', s.item.id, ticket);
          return false;
        })
        .map(({ s }) => supabase.from('tracked_items').update({ notified_price: s.price }).eq('id', s.item.id));
      const results = await Promise.all(marks);
      for (const r of results) if (r.error) console.error('mark notified failed', r.error);
      sent += marks.length;
    }

    return json({ dry_run: false, items: items.length, sent, rearmed: rearmIds.length });
  } catch (err) {
    console.error('notify-tracked-price error', err);
    return json({ error: 'Internal error' }, 500);
  }
});
