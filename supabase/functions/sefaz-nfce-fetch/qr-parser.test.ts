import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { normalizeCnpj, parseNfceQrUrl } from './qr-parser.ts';

const VALID_URL =
  'https://www.nfce.fazenda.sp.gov.br/NFCeConsultaPublica/Paginas/ConsultaSummary.aspx' +
  '?chNFe=35260712345678000190650010000012345678901234' +
  '&nVersao=100&tpAmb=1&dhEmi=2026-07-20T18:32:00' +
  '&vNF=87.40&vICMS=12.30&digVal=abc123&cIdToken=000001&cHashQRCode=deadbeef';

Deno.test('parseNfceQrUrl - parses a well-formed SP consulta URL', () => {
  const result = parseNfceQrUrl(VALID_URL);
  if (!result.ok) throw new Error('expected ok result');
  assertEquals(result.uf, 'SP');
  assertEquals(result.params.chNFe, '35260712345678000190650010000012345678901234');
  assertEquals(result.params.nVersao, '100');
  assertEquals(result.params.tpAmb, '1');
  assertEquals(result.params.vNF, 87.4);
  assertEquals(result.params.vICMS, 12.3);
  assertEquals(result.params.digVal, 'abc123');
  assertEquals(result.params.cIdToken, '000001');
  assertEquals(result.params.cHashQRCode, 'deadbeef');
});

Deno.test('parseNfceQrUrl - accepts the bare (non-www) SP host too', () => {
  const url = VALID_URL.replace('www.nfce.fazenda.sp.gov.br', 'nfce.fazenda.sp.gov.br');
  const result = parseNfceQrUrl(url);
  if (!result.ok) throw new Error('expected ok result');
  assertEquals(result.uf, 'SP');
});

Deno.test('parseNfceQrUrl - rejects garbage input as invalid_url', () => {
  const result = parseNfceQrUrl('not a url at all');
  assertEquals(result, { ok: false, reason: 'invalid_url' });
});

Deno.test('parseNfceQrUrl - flags a non-SP state host as unsupported_state, not a failure', () => {
  const result = parseNfceQrUrl(
    'https://www.fazenda.rj.gov.br/nfce?chNFe=35260712345678000190650010000012345678901234',
  );
  assertEquals(result, { ok: false, reason: 'unsupported_state', host: 'www.fazenda.rj.gov.br' });
});

Deno.test('parseNfceQrUrl - rejects a missing chNFe', () => {
  const result = parseNfceQrUrl('https://www.nfce.fazenda.sp.gov.br/NFCeConsultaPublica/Paginas/ConsultaSummary.aspx?nVersao=100');
  assertEquals(result, { ok: false, reason: 'missing_chave' });
});

Deno.test('parseNfceQrUrl - rejects a chNFe that is not exactly 44 digits', () => {
  const result = parseNfceQrUrl('https://www.nfce.fazenda.sp.gov.br/x?chNFe=12345');
  assertEquals(result, { ok: false, reason: 'missing_chave' });
});

Deno.test('parseNfceQrUrl - tolerates missing optional params, defaulting sensibly', () => {
  const result = parseNfceQrUrl(
    'https://www.nfce.fazenda.sp.gov.br/x?chNFe=35260712345678000190650010000012345678901234',
  );
  if (!result.ok) throw new Error('expected ok result');
  assertEquals(result.params.nVersao, '');
  assertEquals(result.params.vNF, null);
  assertEquals(result.params.dhEmi, null);
});

Deno.test('normalizeCnpj - strips punctuation from a formatted CNPJ', () => {
  assertEquals(normalizeCnpj('12.345.678/0001-90'), '12345678000190');
});

Deno.test('normalizeCnpj - passes through an already-digits-only CNPJ', () => {
  assertEquals(normalizeCnpj('12345678000190'), '12345678000190');
});

Deno.test('normalizeCnpj - rejects a value with the wrong digit count', () => {
  assertEquals(normalizeCnpj('123.456'), null);
});

Deno.test('normalizeCnpj - returns null for null/empty input', () => {
  assertEquals(normalizeCnpj(null), null);
  assertEquals(normalizeCnpj(''), null);
});
