import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface CompetitorInsight {
  productName: string;
  myPrice: number;
  competitorPrice: number;
  competitorStore: string;
  diffPercent: number;
}

function buildEmailHtml(
  storeName: string,
  moreExpensive: CompetitorInsight[],
  bestPrices: CompetitorInsight[],
): string {
  const moreExpensiveRows = moreExpensive
    .slice(0, 5)
    .map(
      (i) =>
        `<tr>
          <td style="padding:8px;border-bottom:1px solid #eee">${i.productName}</td>
          <td style="padding:8px;border-bottom:1px solid #eee;color:#dc2626">R$ ${i.myPrice.toFixed(2)}</td>
          <td style="padding:8px;border-bottom:1px solid #eee;color:#16a34a">R$ ${i.competitorPrice.toFixed(2)}</td>
          <td style="padding:8px;border-bottom:1px solid #eee">${i.competitorStore}</td>
        </tr>`,
    )
    .join('');

  const bestPriceRows = bestPrices
    .slice(0, 5)
    .map(
      (i) =>
        `<tr>
          <td style="padding:8px;border-bottom:1px solid #eee">${i.productName}</td>
          <td style="padding:8px;border-bottom:1px solid #eee;color:#16a34a;font-weight:bold">R$ ${i.myPrice.toFixed(2)}</td>
        </tr>`,
    )
    .join('');

  return `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px">
      <h1 style="color:#1a1a1a;font-size:24px">Digest Competitivo — ${storeName}</h1>
      <p style="color:#666;font-size:14px">Analise diaria de precos na sua regiao.</p>

      ${
        moreExpensive.length > 0
          ? `
        <h2 style="color:#dc2626;font-size:18px;margin-top:24px">Voce esta mais caro</h2>
        <p style="color:#666;font-size:13px">Produtos onde seu preco esta 15%+ acima da concorrencia.</p>
        <table style="width:100%;border-collapse:collapse;font-size:13px">
          <tr style="background:#f9fafb">
            <th style="padding:8px;text-align:left">Produto</th>
            <th style="padding:8px;text-align:left">Seu preco</th>
            <th style="padding:8px;text-align:left">Concorrente</th>
            <th style="padding:8px;text-align:left">Loja</th>
          </tr>
          ${moreExpensiveRows}
        </table>`
          : ''
      }

      ${
        bestPrices.length > 0
          ? `
        <h2 style="color:#16a34a;font-size:18px;margin-top:24px">Voce tem o melhor preco</h2>
        <table style="width:100%;border-collapse:collapse;font-size:13px">
          <tr style="background:#f9fafb">
            <th style="padding:8px;text-align:left">Produto</th>
            <th style="padding:8px;text-align:left">Seu preco</th>
          </tr>
          ${bestPriceRows}
        </table>`
          : ''
      }

      <hr style="margin-top:32px;border:none;border-top:1px solid #eee" />
      <p style="color:#999;font-size:11px;margin-top:16px">
        Enviado por PrecoMapa. Para cancelar, acesse as configuracoes do seu painel.
      </p>
    </div>
  `;
}

serve(async () => {
  try {
    // Get all Premium+ stores with owner emails
    const { data: premiumStores } = await supabase
      .from('stores')
      .select('id, name, b2b_plan')
      .in('b2b_plan', ['premium', 'premium_plus', 'enterprise']);

    if (!premiumStores?.length) {
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    let sentCount = 0;

    for (const store of premiumStores) {
      // Get store owner email
      const { data: member } = await supabase
        .from('store_members')
        .select('user_id')
        .eq('store_id', store.id)
        .eq('role', 'owner')
        .single();

      if (!member) continue;

      // Get owner's auth email
      const { data: authUser } = await supabase.auth.admin.getUserById(
        member.user_id,
      );
      const email = authUser?.user?.email;
      if (!email) continue;

      // Get competitor prices via RPC
      const { data: prices } = await supabase.rpc('get_competitor_prices', {
        p_store_id: store.id,
        p_radius_km: 5,
      });

      if (!prices?.length) continue;

      const moreExpensive: CompetitorInsight[] = [];
      const bestPrices: CompetitorInsight[] = [];

      // Group by product and find where I'm more expensive vs best price
      const productMap = new Map<
        string,
        { myPrice: number; productName: string; competitors: { price: number; store: string }[] }
      >();

      for (const p of prices) {
        const entry = productMap.get(p.product_id) ?? {
          myPrice: p.my_price,
          productName: p.product_name,
          competitors: [],
        };
        entry.competitors.push({
          price: p.competitor_price,
          store: p.competitor_store_name,
        });
        productMap.set(p.product_id, entry);
      }

      for (const [, data] of productMap) {
        const cheapest = data.competitors.reduce((a, b) =>
          a.price < b.price ? a : b,
        );

        if (data.myPrice > cheapest.price * 1.15) {
          moreExpensive.push({
            productName: data.productName,
            myPrice: data.myPrice,
            competitorPrice: cheapest.price,
            competitorStore: cheapest.store,
            diffPercent: Math.round(
              ((data.myPrice - cheapest.price) / cheapest.price) * 100,
            ),
          });
        } else if (
          data.myPrice <=
          Math.min(...data.competitors.map((c) => c.price))
        ) {
          bestPrices.push({
            productName: data.productName,
            myPrice: data.myPrice,
            competitorPrice: cheapest.price,
            competitorStore: cheapest.store,
            diffPercent: 0,
          });
        }
      }

      if (moreExpensive.length === 0 && bestPrices.length === 0) continue;

      // Sort by largest diff
      moreExpensive.sort((a, b) => b.diffPercent - a.diffPercent);

      const html = buildEmailHtml(store.name, moreExpensive, bestPrices);

      // Send via Resend
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'PrecoMapa <digest@precomapa.com.br>',
          to: email,
          subject: `Digest Competitivo — ${store.name}`,
          html,
        }),
      });

      sentCount++;
    }

    return new Response(JSON.stringify({ sent: sentCount }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
