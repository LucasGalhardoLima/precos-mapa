// QR-code URL parsing for NFC-e receipts. This part is fully spec'd — the
// param schema is documented as national (specs/015-price-scanner/plan.md,
// "NFC-e QR format") — and needs no HTML scraping, so it's real, tested code,
// not a placeholder like html-parser.ts.

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

  const chNFe = url.searchParams.get('chNFe');
  if (!chNFe || !/^\d{44}$/.test(chNFe)) {
    return { ok: false, reason: 'missing_chave' };
  }

  const num = (key: string): number | null => {
    const v = url.searchParams.get(key);
    if (v == null) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  return {
    ok: true,
    uf,
    params: {
      chNFe,
      nVersao: url.searchParams.get('nVersao') ?? '',
      tpAmb: url.searchParams.get('tpAmb') ?? '',
      dhEmi: url.searchParams.get('dhEmi'),
      vNF: num('vNF'),
      vICMS: num('vICMS'),
      digVal: url.searchParams.get('digVal'),
      cIdToken: url.searchParams.get('cIdToken'),
      cHashQRCode: url.searchParams.get('cHashQRCode'),
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
