import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const APP_URL = Deno.env.get('NEXT_PUBLIC_APP_URL') ?? 'https://precomapa.com.br';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const REMINDERS: Record<number, { subject: string; body: string }> = {
  3: {
    subject: 'Voce ja usou metade do seu periodo de teste',
    body: 'Voce ainda tem 4 dias para explorar todos os recursos Premium do PrecoMapa. Nao perca a chance de importar ofertas com IA e ver dados competitivos.',
  },
  5: {
    subject: 'Faltam 2 dias para o fim do seu teste',
    body: 'Seu periodo de teste Premium termina em 2 dias. Assine agora para manter acesso ao importador IA, inteligencia competitiva e ofertas ilimitadas.',
  },
  7: {
    subject: 'Ultimo dia! Assine para nao perder acesso',
    body: 'Seu periodo de teste Premium termina hoje. Assine agora para continuar usando todos os recursos avancados. Sem assinatura, voce volta para o plano Gratuito com limite de 5 ofertas/mes.',
  },
};

serve(async () => {
  try {
    const { data: trialStores } = await supabase
      .from('stores')
      .select('id, name, trial_ends_at')
      .not('trial_ends_at', 'is', null)
      .gt('trial_ends_at', new Date().toISOString());

    if (!trialStores?.length) {
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    let sentCount = 0;
    const now = new Date();

    for (const store of trialStores) {
      const trialEnd = new Date(store.trial_ends_at);
      const daysUsed = Math.floor(
        (now.getTime() - (trialEnd.getTime() - 7 * 86400000)) / 86400000,
      );

      const reminder = REMINDERS[daysUsed];
      if (!reminder) continue;

      // Get owner email
      const { data: member } = await supabase
        .from('store_members')
        .select('user_id')
        .eq('store_id', store.id)
        .eq('role', 'owner')
        .single();

      if (!member) continue;

      const { data: authUser } = await supabase.auth.admin.getUserById(
        member.user_id,
      );
      const email = authUser?.user?.email;
      if (!email) continue;

      const checkoutUrl = `${APP_URL}/painel/plano`;

      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'PrecoMapa <noreply@precomapa.com.br>',
          to: email,
          subject: `${reminder.subject} — ${store.name}`,
          html: `
            <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px">
              <h1 style="color:#1a1a1a;font-size:24px">${reminder.subject}</h1>
              <p style="color:#666;font-size:14px;line-height:1.6">${reminder.body}</p>
              <a href="${checkoutUrl}" style="display:inline-block;margin-top:20px;padding:12px 24px;background:#16a34a;color:white;text-decoration:none;border-radius:8px;font-weight:bold;font-size:14px">
                Assinar Premium agora
              </a>
              <hr style="margin-top:32px;border:none;border-top:1px solid #eee" />
              <p style="color:#999;font-size:11px;margin-top:16px">
                Enviado por PrecoMapa. Para cancelar, acesse as configuracoes do seu painel.
              </p>
            </div>
          `,
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
