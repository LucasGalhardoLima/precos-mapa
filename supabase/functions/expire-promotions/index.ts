import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const { data, error } = await supabase
    .from('promotions')
    .update({ status: 'expired', updated_at: new Date().toISOString() })
    .eq('status', 'active')
    .lt('end_date', new Date().toISOString())
    .select('id');

  const count = data?.length ?? 0;

  console.log(`Expired ${count} promotions at ${new Date().toISOString()}`);

  if (error) {
    console.error('Error expiring promotions:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(
    JSON.stringify({ expired: count }),
    { headers: { 'Content-Type': 'application/json' } }
  );
});
