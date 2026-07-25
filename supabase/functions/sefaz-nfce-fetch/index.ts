// 015 Price Scanner Mode B — NFC-e receipt scan. Single-action flow, no
// separate preview/confirm round trip: the mobile client scans the receipt
// QR and calls this function, which fetches, parses (best-effort — see the
// warning header in html-parser.ts), and persists in one request, then
// returns a summary for the client to display. This mirrors Mode A's
// existing pattern in mobile/app/scan.tsx, where "Confirmar preço" is
// itself the single save action, not a second step after a preview.
//
// Anonymous, RLS-gated exactly like Mode A's price_reports inserts
// (migration 053) — no user auth required, verify_jwt stays at its default
// (the mobile client's anon-key JWT satisfies it).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { parseNfceQrUrl } from './qr-parser.ts';
import { parseConsultaHtml } from './html-parser.ts';
import { persistReceipt } from './persist.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS });
  }

  let body: { qrUrl?: string; anonymousId?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const { qrUrl, anonymousId } = body;
  if (!qrUrl || !anonymousId) {
    return json({ error: 'qrUrl and anonymousId are required' }, 400);
  }

  const qr = parseNfceQrUrl(qrUrl);
  if (!qr.ok) {
    if (qr.reason === 'unsupported_state') {
      // Not an error — a real, expected outcome for v1's SP-only scope
      // (plan.md "Open decisions" #1). The client shows this as a distinct
      // message, not a generic failure.
      return json({ error: 'unsupported_state', host: qr.host }, 200);
    }
    return json({ error: qr.reason }, 400);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  let html: string | null = null;
  try {
    const res = await fetch(qrUrl, {
      headers: {
        // SEFAZ portals are built for browser access — plan.md flags bot
        // detection as a real-world friction point at volume, so a
        // realistic UA is the minimum viable politeness, not a spoof.
        'User-Agent':
          'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
      },
    });
    if (res.ok) html = await res.text();
  } catch {
    html = null; // network failure -> falls through to the QR-param-only path below, same as a parse failure
  }

  // parseConsultaHtml is a best-effort, UNVERIFIED guess at the real portal's
  // markup (see html-parser.ts) — a null here is expected and handled, not
  // an exceptional case.
  const parsed = html ? parseConsultaHtml(html) : null;

  const result = await persistReceipt(supabase, {
    chNFe: qr.params.chNFe,
    anonymousId,
    rawHtml: html ?? '',
    totalValueFromQr: qr.params.vNF,
    parsed,
  });

  return json({
    status: result.status,
    storeName: result.storeName,
    totalValue: result.totalValue,
    itemCount: result.itemCount,
    savedItemCount: result.savedItemCount,
  });
});
