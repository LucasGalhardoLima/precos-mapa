import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

interface WebhookPayload {
  type: 'INSERT';
  table: string;
  record: {
    id: string;
    product_id: string;
    store_id: string;
    promo_price: number;
    original_price: number;
  };
}

Deno.serve(async (req) => {
  const payload: WebhookPayload = await req.json();

  if (payload.type !== 'INSERT' || payload.table !== 'promotions') {
    return new Response('Ignored', { status: 200 });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const promotion = payload.record;

  // Get product name
  const { data: product } = await supabase
    .from('products')
    .select('name')
    .eq('id', promotion.product_id)
    .single();

  // Get store name
  const { data: store } = await supabase
    .from('stores')
    .select('name')
    .eq('id', promotion.store_id)
    .single();

  if (!product || !store) {
    return new Response('Product/store not found', { status: 200 });
  }

  // Find users who favorited this product and have push tokens
  const { data: matchingUsers } = await supabase
    .from('user_favorites')
    .select('user_id, profiles!inner(push_token)')
    .eq('product_id', promotion.product_id)
    .not('profiles.push_token', 'is', null);

  if (!matchingUsers || matchingUsers.length === 0) {
    return new Response('No matching users', { status: 200 });
  }

  // Also check alerts with target price
  const { data: matchingAlerts } = await supabase
    .from('user_alerts')
    .select('user_id, target_price, profiles!inner(push_token)')
    .eq('product_id', promotion.product_id)
    .eq('is_active', true)
    .not('profiles.push_token', 'is', null);

  // Collect all push tokens (dedup by user)
  const tokenMap = new Map<string, string>();

  for (const fav of matchingUsers) {
    const token = (fav as unknown as { profiles?: { push_token?: string } }).profiles?.push_token;
    if (token) tokenMap.set(fav.user_id, token);
  }

  if (matchingAlerts) {
    for (const alert of matchingAlerts) {
      // Only notify if price meets target (or no target set)
      if (!alert.target_price || promotion.promo_price <= alert.target_price) {
        const token = (alert as unknown as { profiles?: { push_token?: string } }).profiles?.push_token;
        if (token) tokenMap.set(alert.user_id, token);
      }
    }
  }

  const discount = Math.round(
    (1 - promotion.promo_price / promotion.original_price) * 100
  );

  // Send push notifications
  const messages = Array.from(tokenMap.values()).map((token) => ({
    to: token,
    sound: 'default',
    title: `${product.name} em promocao!`,
    body: `R$ ${promotion.promo_price.toFixed(2)} (-${discount}%) no ${store.name}`,
    data: { promotionId: promotion.id },
  }));

  if (messages.length > 0) {
    await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(messages),
    });
  }

  return new Response(
    JSON.stringify({ sent: messages.length }),
    { headers: { 'Content-Type': 'application/json' } }
  );
});
