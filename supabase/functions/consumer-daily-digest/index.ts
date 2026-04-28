import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const APP_URL = Deno.env.get('APP_URL') ?? 'https://poup.com.br';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface FavoriteDeal {
  productName: string;
  storeName: string;
  promoPrice: number;
  originalPrice: number;
  discountPct: number;
}

interface TrendingDeal {
  productName: string;
  minPrice: number;
  storeCount: number;
  discountPct: number;
}

function buildConsumerEmailHtml(
  displayName: string,
  favDeals: FavoriteDeal[],
  trending: TrendingDeal[],
  unsubscribeUrl: string,
): string {
  const favRows = favDeals
    .slice(0, 5)
    .map(
      (d) =>
        `<tr>
          <td style="padding:8px;border-bottom:1px solid #eee">${d.productName}</td>
          <td style="padding:8px;border-bottom:1px solid #eee;color:#16a34a;font-weight:bold">R$ ${d.promoPrice.toFixed(2)}</td>
          <td style="padding:8px;border-bottom:1px solid #eee;text-decoration:line-through;color:#999">R$ ${d.originalPrice.toFixed(2)}</td>
          <td style="padding:8px;border-bottom:1px solid #eee">${d.storeName}</td>
          <td style="padding:8px;border-bottom:1px solid #eee;color:#16a34a">-${d.discountPct}%</td>
        </tr>`,
    )
    .join('');

  const trendingRows = trending
    .slice(0, 5)
    .map(
      (d) =>
        `<tr>
          <td style="padding:8px;border-bottom:1px solid #eee">${d.productName}</td>
          <td style="padding:8px;border-bottom:1px solid #eee;color:#16a34a;font-weight:bold">R$ ${d.minPrice.toFixed(2)}</td>
          <td style="padding:8px;border-bottom:1px solid #eee">${d.storeCount} loja${d.storeCount > 1 ? 's' : ''}</td>
          <td style="padding:8px;border-bottom:1px solid #eee;color:#16a34a">-${d.discountPct}%</td>
        </tr>`,
    )
    .join('');

  return `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px">
      <h1 style="color:#1a1a1a;font-size:24px">Bom dia${displayName ? `, ${displayName}` : ''}! ☀️</h1>
      <p style="color:#666;font-size:14px">Aqui estão as melhores ofertas de hoje para você.</p>

      ${
        favDeals.length > 0
          ? `
        <h2 style="color:#7c3aed;font-size:18px;margin-top:24px">Seus favoritos em promoção</h2>
        <table style="width:100%;border-collapse:collapse;font-size:13px">
          <tr style="background:#f9fafb">
            <th style="padding:8px;text-align:left">Produto</th>
            <th style="padding:8px;text-align:left">Preço</th>
            <th style="padding:8px;text-align:left">De</th>
            <th style="padding:8px;text-align:left">Loja</th>
            <th style="padding:8px;text-align:left">Desconto</th>
          </tr>
          ${favRows}
        </table>`
          : ''
      }

      ${
        trending.length > 0
          ? `
        <h2 style="color:#ea580c;font-size:18px;margin-top:24px">Em alta na sua região</h2>
        <table style="width:100%;border-collapse:collapse;font-size:13px">
          <tr style="background:#f9fafb">
            <th style="padding:8px;text-align:left">Produto</th>
            <th style="padding:8px;text-align:left">A partir de</th>
            <th style="padding:8px;text-align:left">Disponível em</th>
            <th style="padding:8px;text-align:left">Desconto</th>
          </tr>
          ${trendingRows}
        </table>`
          : ''
      }

      ${
        favDeals.length === 0 && trending.length === 0
          ? '<p style="color:#666;font-size:14px">Nenhuma oferta nova hoje — fique de olho amanhã!</p>'
          : ''
      }

      <hr style="margin-top:32px;border:none;border-top:1px solid #eee" />
      <p style="color:#999;font-size:11px;margin-top:16px">
        Enviado por Poup.
        <a href="${unsubscribeUrl}" style="color:#999;text-decoration:underline">Cancelar inscrição</a>
      </p>
    </div>
  `;
}

Deno.serve(async (req) => {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${Deno.env.get('EDGE_FUNCTION_SECRET')}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    // Get consumers who opted in for email digest
    const { data: optedInUsers, error: prefErr } = await supabase
      .from('notification_preferences')
      .select('user_id, unsubscribe_token')
      .eq('email_digest', true);

    if (prefErr) {
      console.error('Failed to fetch notification preferences', prefErr);
      return new Response(JSON.stringify({ error: 'prefs query failed' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!optedInUsers?.length) {
      return new Response(JSON.stringify({ sent: 0, reason: 'no opted-in users' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get trending products (shared across all users)
    const { data: trendingRaw } = await supabase.rpc('get_trending_products', {
      result_limit: 5,
    });

    const trending: TrendingDeal[] = (trendingRaw ?? []).map((t: Record<string, unknown>) => ({
      productName: t.name as string,
      minPrice: Number(t.min_price),
      storeCount: Number(t.store_count),
      discountPct: Number(t.discount_pct),
    }));

    let sentCount = 0;

    for (const pref of optedInUsers) {
      // Get profile for email and display name
      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name, role')
        .eq('id', pref.user_id)
        .single();

      if (!profile || profile.role !== 'consumer') continue;

      // Get auth email
      const { data: authUser } = await supabase.auth.admin.getUserById(pref.user_id);
      const email = authUser?.user?.email;
      if (!email) continue;

      // Get favorite products with active promotions
      const { data: favPromos } = await supabase
        .from('user_favorites')
        .select(`
          product_id,
          products!inner (
            name,
            promotions!inner (
              promo_price,
              original_price,
              store_id,
              stores!inner ( name )
            )
          )
        `)
        .eq('user_id', pref.user_id)
        .eq('products.promotions.status', 'active')
        .gt('products.promotions.end_date', new Date().toISOString());

      const favDeals: FavoriteDeal[] = [];

      if (favPromos) {
        for (const fav of favPromos) {
          const product = fav.products as unknown as {
            name: string;
            promotions: Array<{
              promo_price: number;
              original_price: number;
              stores: { name: string };
            }>;
          };
          if (!product?.promotions) continue;

          // Pick the best deal for each favorite product
          const bestPromo = product.promotions.reduce((best, curr) =>
            curr.promo_price < best.promo_price ? curr : best,
          );

          const discountPct = Math.round(
            (1 - bestPromo.promo_price / bestPromo.original_price) * 100,
          );

          favDeals.push({
            productName: product.name,
            storeName: bestPromo.stores.name,
            promoPrice: bestPromo.promo_price,
            originalPrice: bestPromo.original_price,
            discountPct,
          });
        }
      }

      // Sort favorites by discount desc
      favDeals.sort((a, b) => b.discountPct - a.discountPct);

      // Skip if nothing to show
      if (favDeals.length === 0 && trending.length === 0) continue;

      const unsubscribeUrl = `${APP_URL}/api/unsubscribe?token=${pref.unsubscribe_token}`;
      const html = buildConsumerEmailHtml(
        profile.display_name ?? '',
        favDeals,
        trending,
        unsubscribeUrl,
      );

      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'Poup <ofertas@poup.com.br>',
          to: email,
          subject: favDeals.length > 0
            ? `${favDeals[0].productName} com ${favDeals[0].discountPct}% off e mais ofertas`
            : 'As melhores ofertas de hoje para voce',
          html,
        }),
      });

      if (!res.ok) {
        console.error(`Resend error for ${pref.user_id}:`, res.status, await res.text());
        continue;
      }

      // Update last_digest_at
      await supabase
        .from('notification_preferences')
        .update({ last_digest_at: new Date().toISOString() })
        .eq('user_id', pref.user_id);

      sentCount++;
    }

    return new Response(JSON.stringify({ sent: sentCount }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('consumer-daily-digest error', error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
