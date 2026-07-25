// These tests run against a FIXTURE HTML STRING AUTHORED BY THE SAME PERSON
// WHO WROTE html-parser.ts's selectors — they prove the parser is internally
// consistent (correct BR-number parsing, fails safe on malformed rows,
// returns null when the expected table is absent) but prove NOTHING about
// whether table#tabResult / .RCod / .Rqtd / etc. match a real
// nfce.fazenda.sp.gov.br page. Do not read a green run here as "the scraper
// works" — see the warning header in html-parser.ts.

import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { parseConsultaHtml } from './html-parser.ts';

const FIXTURE_HTML = `
<html><body>
  <div class="fixo-emitente-nome">SAVEGNAGO SUPERMERCADOS LTDA</div>
  <div class="fixo-emitente-cnpj">CNPJ: 12.345.678/0001-90</div>
  <table id="tabResult">
    <tr>
      <td class="txtTit">ARROZ TIPO 1 5KG</td>
      <td class="RCod">7891234567890</td>
      <td class="Rqtd">2,000</td>
      <td class="RUN">UN</td>
      <td class="RvlUnit">24,90</td>
      <td class="valor">49,80</td>
    </tr>
    <tr>
      <td class="txtTit">FEIJAO CARIOCA 1KG</td>
      <td class="RCod">7899876543210</td>
      <td class="Rqtd">1,000</td>
      <td class="RUN">UN</td>
      <td class="RvlUnit">8,50</td>
      <td class="valor">8,50</td>
    </tr>
  </table>
</body></html>
`;

Deno.test('parseConsultaHtml - extracts store info and line items from the fixture', () => {
  const result = parseConsultaHtml(FIXTURE_HTML);
  if (!result) throw new Error('expected a parsed receipt');

  assertEquals(result.storeName, 'SAVEGNAGO SUPERMERCADOS LTDA');
  assertEquals(result.storeCnpj, '12.345.678/0001-90');
  assertEquals(result.items.length, 2);

  assertEquals(result.items[0], {
    ean: '7891234567890',
    description: 'ARROZ TIPO 1 5KG',
    quantity: 2,
    unit: 'UN',
    unitPrice: 24.9,
    totalPrice: 49.8,
  });
});

Deno.test('parseConsultaHtml - computes totalPrice from qty*unitPrice when the total column is missing', () => {
  const html = `
    <html><body><table id="tabResult">
      <tr>
        <td class="txtTit">PRODUTO SEM TOTAL</td>
        <td class="RCod">7890000000001</td>
        <td class="Rqtd">3,000</td>
        <td class="RUN">UN</td>
        <td class="RvlUnit">10,00</td>
      </tr>
    </table></body></html>
  `;
  const result = parseConsultaHtml(html);
  if (!result) throw new Error('expected a parsed receipt');
  assertEquals(result.items[0].totalPrice, 30);
});

Deno.test('parseConsultaHtml - treats a non-EAN-shaped code as null rather than guessing', () => {
  const html = `
    <html><body><table id="tabResult">
      <tr>
        <td class="txtTit">ITEM SEM EAN VALIDO</td>
        <td class="RCod">ABC123</td>
        <td class="Rqtd">1,000</td>
        <td class="RUN">UN</td>
        <td class="RvlUnit">5,00</td>
        <td class="valor">5,00</td>
      </tr>
    </table></body></html>
  `;
  const result = parseConsultaHtml(html);
  if (!result) throw new Error('expected a parsed receipt');
  assertEquals(result.items[0].ean, null);
});

Deno.test('parseConsultaHtml - fails safe (null) when the expected item table is absent', () => {
  const result = parseConsultaHtml('<html><body><p>Chave inválida ou não encontrada.</p></body></html>');
  assertEquals(result, null);
});

Deno.test('parseConsultaHtml - fails safe (null) on malformed/empty HTML', () => {
  assertEquals(parseConsultaHtml(''), null);
});

Deno.test('parseConsultaHtml - skips a row missing required fields instead of throwing', () => {
  const html = `
    <html><body><table id="tabResult">
      <tr><td class="txtTit">Header row, not an item</td></tr>
      <tr>
        <td class="txtTit">PRODUTO VALIDO</td>
        <td class="RCod">7890000000002</td>
        <td class="Rqtd">1,000</td>
        <td class="RUN">UN</td>
        <td class="RvlUnit">15,00</td>
        <td class="valor">15,00</td>
      </tr>
    </table></body></html>
  `;
  const result = parseConsultaHtml(html);
  if (!result) throw new Error('expected a parsed receipt');
  assertEquals(result.items.length, 1);
  assertEquals(result.items[0].description, 'PRODUTO VALIDO');
});
