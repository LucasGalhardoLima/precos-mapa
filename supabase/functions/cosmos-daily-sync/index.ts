import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

function toTitleCase(str: string): string {
  return str.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

Deno.serve(async (req) => {
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${Deno.env.get('EDGE_FUNCTION_SECRET')}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const dateStr = yesterday.toISOString().slice(0, 10); // YYYY-MM-DD

  const res = await fetch(
    `https://api.cosmos.bluesoft.com.br/products/by_date?date=${encodeURIComponent(dateStr)}`,
    {
      headers: {
        'X-Cosmos-Token': Deno.env.get('COSMOS_API_TOKEN')!,
        'User-Agent':     'Cosmos-API-Request',
        'Content-Type':   'application/json',
      },
    }
  );

  if (!res.ok) {
    return new Response(
      JSON.stringify({ error: `Cosmos error ${res.status}` }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid Cosmos response body' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const products: Array<{
    gtin: string | number;
    description: string;
    brand?: { name: string };
    thumbnail?: string;
    avg_price?: number;
  }> = Array.isArray(data) ? data : ((data as { products?: unknown[] }).products ?? []);

  let updated = 0;

  for (const cp of products) {
    if (!cp.gtin || cp.gtin === 0) continue;
    if (!cp.avg_price || cp.avg_price <= 0) continue;
    if (!cp.description) continue;

    const { error } = await supabase
      .from('products')
      .upsert(
        {
          ean:             String(cp.gtin),
          name:            toTitleCase(cp.description),
          brand:           cp.brand?.name ?? null,
          image_url:       cp.thumbnail ?? null,
          reference_price: cp.avg_price,
          cosmos_synced_at: new Date().toISOString(),
        },
        { onConflict: 'ean', ignoreDuplicates: false }
      );

    if (!error) updated++;
    else console.error(`Failed to upsert product ean=${cp.gtin}:`, error.message);
  }

  console.log(`cosmos-daily-sync: ${products.length} from Cosmos, ${updated} updated in DB`);

  return new Response(
    JSON.stringify({ total: products.length, updated }),
    { headers: { 'Content-Type': 'application/json' } }
  );
});
