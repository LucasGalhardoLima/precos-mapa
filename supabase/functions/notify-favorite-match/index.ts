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
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${Deno.env.get('EDGE_FUNCTION_SECRET')}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
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
    const { data: product, error: productErr } = await supabase
      .from('products')
      .select('name')
      .eq('id', promotion.product_id)
      .single();

    // Get store name
    const { data: store, error: storeErr } = await supabase
      .from('stores')
      .select('name')
      .eq('id', promotion.store_id)
      .single();

    if (!product || !store) {
      console.error('Product/store lookup failed', { productErr, storeErr });
      return new Response('Product/store not found', { status: 200 });
    }

    // Find users who favorited this product and have push tokens
    const { data: matchingUsers, error: favErr } = await supabase
      .from('user_favorites')
      .select('user_id, profiles!inner(push_token)')
      .eq('product_id', promotion.product_id)
      .not('profiles.push_token', 'is', null);

    if (favErr) {
      console.error('Favorites query failed', favErr);
    }

    // Also check alerts with target price
    const { data: matchingAlerts, error: alertErr } = await supabase
      .from('user_alerts')
      .select('id, user_id, target_price, profiles!inner(push_token)')
      .eq('product_id', promotion.product_id)
      .eq('is_active', true)
      .not('profiles.push_token', 'is', null);

    if (alertErr) {
      console.error('Alerts query failed', alertErr);
    }

    // Collect all push tokens (dedup by user)
    const tokenMap = new Map<string, string>();

    if (matchingUsers) {
      for (const fav of matchingUsers) {
        const token = (fav as unknown as { profiles?: { push_token?: string } }).profiles?.push_token;
        if (token) tokenMap.set(fav.user_id, token);
      }
    }

    const triggeredAlertIds: string[] = [];

    if (matchingAlerts) {
      for (const alert of matchingAlerts) {
        if (!alert.target_price || promotion.promo_price <= alert.target_price) {
          const token = (alert as unknown as { profiles?: { push_token?: string } }).profiles?.push_token;
          if (token) tokenMap.set(alert.user_id, token);
          triggeredAlertIds.push(alert.id);
        }
      }
    }

    // Record trigger data on matched alerts
    if (triggeredAlertIds.length > 0) {
      const { error: updateErr } = await supabase
        .from('user_alerts')
        .update({
          triggered_at: new Date().toISOString(),
          triggered_price: promotion.promo_price,
          triggered_store_id: promotion.store_id,
        })
        .in('id', triggeredAlertIds);

      if (updateErr) {
        console.error('Failed to record alert triggers', updateErr);
      }
    }

    if (tokenMap.size === 0) {
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const discount = Math.round(
      (1 - promotion.promo_price / promotion.original_price) * 100
    );

    // Send push notifications — include productId for deep linking
    const messages = Array.from(tokenMap.values()).map((token) => ({
      to: token,
      sound: 'default' as const,
      title: `${product.name} em promoção!`,
      body: `R$ ${promotion.promo_price.toFixed(2)} (-${discount}%) no ${store.name}`,
      data: { promotionId: promotion.id, productId: promotion.product_id },
    }));

    const pushResponse = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(messages),
    });

    if (!pushResponse.ok) {
      console.error('Expo Push API error', pushResponse.status, await pushResponse.text());
    }

    return new Response(
      JSON.stringify({ sent: messages.length }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('notify-favorite-match error', err);
    return new Response(
      JSON.stringify({ error: 'Internal error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
