import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${Deno.env.get('EDGE_FUNCTION_SECRET')}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const now = new Date().toISOString();

  // Find all active promotions that have expired
  const { data: expiring, error: fetchError } = await supabase
    .from('promotions')
    .select('id, product_id, store_id, promo_price, end_date')
    .eq('status', 'active')
    .lt('end_date', now);

  if (fetchError) {
    console.error('Error fetching expired promotions:', fetchError.message);
    return new Response(JSON.stringify({ error: fetchError.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!expiring || expiring.length === 0) {
    console.log(`No promotions to expire at ${now}`);
    return new Response(
      JSON.stringify({ expired: 0, last_price: 0 }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  }

  let lastPriceCount = 0;
  let expiredCount = 0;

  for (const promo of expiring) {
    // Check if there's already a last_price row for this product+store
    const { data: existing } = await supabase
      .from('promotions')
      .select('id')
      .eq('product_id', promo.product_id)
      .eq('store_id', promo.store_id)
      .eq('status', 'last_price')
      .limit(1);

    if (existing && existing.length > 0) {
      // Another last_price already exists — expire the old last_price, then
      // promote this one to last_price (it has the more recent data)
      await supabase
        .from('promotions')
        .update({ status: 'expired', updated_at: now })
        .eq('id', existing[0].id);

      await supabase
        .from('promotions')
        .update({
          status: 'last_price',
          last_known_price: promo.promo_price,
          last_price_date: promo.end_date,
          updated_at: now,
        })
        .eq('id', promo.id);

      expiredCount++;
      lastPriceCount++;
    } else {
      // No existing last_price — this one becomes last_price
      await supabase
        .from('promotions')
        .update({
          status: 'last_price',
          last_known_price: promo.promo_price,
          last_price_date: promo.end_date,
          updated_at: now,
        })
        .eq('id', promo.id);

      lastPriceCount++;
    }
  }

  console.log(
    `Processed ${expiring.length} promotions at ${now}: ${lastPriceCount} → last_price, ${expiredCount} old last_price → expired`
  );

  return new Response(
    JSON.stringify({
      processed: expiring.length,
      last_price: lastPriceCount,
      expired: expiredCount,
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );
});
