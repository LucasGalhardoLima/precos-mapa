// Most fixtures below use clean per-field values and mainly cover parsing
// edge cases (missing total column, non-EAN codes, missing table, malformed
// rows). The "handles real SP markup" test further down is the one grounded
// in an actual nfce.fazenda.sp.gov.br page fetched from a real device scan —
// see html-parser.ts's header for what that page's markup actually looks
// like and why the label-in-value shape matters.

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

Deno.test('parseConsultaHtml - handles real SP markup: labels embedded in the value spans, CNPJ in a generic .text div', () => {
  // Structurally matches an actual nfce.fazenda.sp.gov.br consulta page
  // (captured via a real device scan): quantity/unit/price are wrapped as
  // "<strong>label</strong>value" inside one span (not a clean cell per
  // field, unlike the top fixture), and the CNPJ has no dedicated class —
  // it's a plain ".text" div alongside the address inside ".txtCenter".
  const html = `
    <html><body>
      <div class="txtCenter">
        <div id="u20" class="txtTopo">MERCADO EXEMPLO LTDA</div>
        <div class="text">CNPJ:
        12.345.678/0001-90</div>
        <div class="text">RUA EXEMPLO, 100, CENTRO, SAO PAULO, SP</div>
      </div>
      <table id="tabResult">
        <tr id="Item + 1">
          <td valign="top">
            <span class="txtTit">PRODUTO EXEMPLO 1KG</span>
            <span class="RCod">(Código:
            12345
            )</span>
            <br>
            <span class="Rqtd"><strong>Qtde.:</strong>2</span>
            <span class="RUN"><strong>UN: </strong>KG</span>
            <span class="RvlUnit"><strong>Vl. Unit.:</strong>
            10,50</span>
          </td>
          <td align="right" valign="top" class="txtTit noWrap">
            Vl. Total
            <br><span class="valor">21,00</span></td>
        </tr>
      </table>
    </body></html>
  `;
  const result = parseConsultaHtml(html);
  if (!result) throw new Error('expected a parsed receipt');
  assertEquals(result.storeName, 'MERCADO EXEMPLO LTDA');
  assertEquals(result.storeCnpj, '12.345.678/0001-90');
  assertEquals(result.items[0], {
    ean: null, // "12345" is only 5 digits, not a real EAN — correctly rejected
    description: 'PRODUTO EXEMPLO 1KG',
    quantity: 2,
    unit: 'KG',
    unitPrice: 10.5,
    totalPrice: 21,
  });
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
