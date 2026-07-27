// QR-code URL parsing for NFC-e receipts. São Paulo's real QR-Code v2 packs
// everything into a single pipe-delimited `p` param — chave|nVersao|tpAmb|
// cIdToken|cHashQRCode — confirmed against a real scanned receipt. There is
// no separate vNF/vICMS/dhEmi/digVal anywhere in the QR itself; those would
// only ever come from the HTML scrape (html-parser.ts), which is why they
// stay null here.

export interface NfceQrParams {
  chNFe: string;
  nVersao: string;
  tpAmb: string;
  dhEmi: string | null;
  vNF: number | null;
  vICMS: number | null;
  digVal: string | null;
  cIdToken: string | null;
  cHashQRCode: string | null;
}

// v1 scope is São Paulo only (plan.md "Open decisions" #1 — matches the
// app's current Matão-only store footprint). Other UFs are recognized but
// explicitly unsupported so the caller can show a clear message instead of
// treating them as a parse failure.
const SUPPORTED_HOSTS: Record<string, string> = {
  'www.nfce.fazenda.sp.gov.br': 'SP',
  'nfce.fazenda.sp.gov.br': 'SP',
};

export type QrParseResult =
  | { ok: true; uf: string; params: NfceQrParams }
  | { ok: false; reason: 'invalid_url' | 'missing_chave'; host?: undefined }
  | { ok: false; reason: 'unsupported_state'; host: string };

export function parseNfceQrUrl(rawUrl: string): QrParseResult {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { ok: false, reason: 'invalid_url' };
  }

  const uf = SUPPORTED_HOSTS[url.hostname];
  if (!uf) {
    return { ok: false, reason: 'unsupported_state', host: url.hostname };
  }

  const parts = (url.searchParams.get('p') ?? '').split('|');
  const chNFe = parts[0] ?? '';
  if (!/^\d{44}$/.test(chNFe)) {
    return { ok: false, reason: 'missing_chave' };
  }

  return {
    ok: true,
    uf,
    params: {
      chNFe,
      nVersao: parts[1] ?? '',
      tpAmb: parts[2] ?? '',
      dhEmi: null,
      vNF: null,
      vICMS: null,
      digVal: null,
      cIdToken: parts[3] ?? null,
      cHashQRCode: parts[4] ?? null,
    },
  };
}

// CNPJ as scraped/displayed always carries punctuation ("12.345.678/0001-90");
// stores.cnpj (migration 060) and receipt_imports.store_cnpj are both stored
// digits-only so comparisons never need to normalize on read.
export function normalizeCnpj(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '');
  return digits.length === 14 ? digits : null;
}
