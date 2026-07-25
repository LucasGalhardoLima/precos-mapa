// ============================================================================
// UNVERIFIED — built without ever fetching a real nfce.fazenda.sp.gov.br
// consulta page. There was no real São Paulo NFC-e receipt/chNFe available to
// test against this session (see specs/015-price-scanner/plan.md "Research
// findings" #2 for why this has to be an HTML scrape, not an XML/REST call).
//
// The selectors below (`table#tabResult`, the `.txtTit`/`.RCod`/`.Rqtd`/
// `.RUN`/`.RvlUnit` classes) are a best-effort guess based on general
// knowledge of how Brazilian state NFC-e "consulta pública" portals are
// typically templated — NOT confirmed against SP's actual markup. The
// accompanying html-parser.test.ts fixture was authored BY THIS CODE'S
// AUTHOR to match this guess; it proves internal consistency only, and
// proves nothing about real-world correctness.
//
// This file is expected to be rewritten once a real chNFe/receipt is
// available — that's the whole reason its logic is isolated here rather
// than inlined into index.ts: everything else in this function (QR parsing,
// the QR-param-only fallback, and the receipt_imports/price_reports writes
// in persist.ts) is real, spec'd, and tested; only this file is a stand-in.
//
// Designed to fail safe: if the expected table/rows aren't found, this
// returns null rather than guessing at wrong data, which the caller (index.ts)
// treats as a scrape failure and falls back to the QR-param-only path
// (status: 'partial') — never silently persists garbage line items.
// ============================================================================

// NOTE: plan.md suggested "deno-dom via esm.sh", but deno-dom is a Deno-native
// module (WASM-backed HTML parser) published on deno.land/x, not as an npm
// package — esm.sh (which mirrors npm) doesn't actually carry it. This is
// the real, correct import for Deno/Supabase Edge Functions.
import { DOMParser } from 'https://deno.land/x/deno_dom@v0.1.45/deno-dom-wasm.ts';

export interface ParsedNfceItem {
  ean: string | null;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;
}

export interface ParsedNfceReceipt {
  storeCnpj: string | null;
  storeName: string | null;
  items: ParsedNfceItem[];
}

function parseBrNumber(text: string): number | null {
  // Brazilian numeric formatting: "1.234,56" -> 1234.56
  const cleaned = text.trim().replace(/\./g, '').replace(',', '.');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export function parseConsultaHtml(html: string): ParsedNfceReceipt | null {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  if (!doc) return null;

  const table = doc.querySelector('table#tabResult');
  if (!table) return null;

  const items: ParsedNfceItem[] = [];
  const rows = table.querySelectorAll('tr');

  for (const row of Array.from(rows)) {
    // deno-dom's own type exports don't compose cleanly with TS's
    // InstanceType<> here (its Element isn't a plain constructable class at
    // the type level) — `any` is the pragmatic escape hatch, not a sign of
    // an unchecked runtime value; querySelector itself still validates shape.
    // deno-lint-ignore no-explicit-any
    const el = row as any;
    const descriptionEl = el.querySelector('.txtTit, .fixo-prod-serv-descricao');
    const codeEl = el.querySelector('.RCod');
    const qtyEl = el.querySelector('.Rqtd');
    const unitEl = el.querySelector('.RUN');
    const unitPriceEl = el.querySelector('.RvlUnit');
    const totalPriceEl = el.querySelector('.valor, .RvlTotal');

    if (!descriptionEl || !qtyEl || !unitPriceEl) continue;

    const quantity = parseBrNumber(qtyEl.textContent ?? '');
    const unitPrice = parseBrNumber(unitPriceEl.textContent ?? '');
    if (quantity == null || unitPrice == null) continue;

    const totalPrice = totalPriceEl ? parseBrNumber(totalPriceEl.textContent ?? '') : null;
    const rawEan = codeEl?.textContent?.trim() ?? '';

    items.push({
      ean: /^\d{8,14}$/.test(rawEan) ? rawEan : null,
      description: (descriptionEl.textContent ?? '').trim(),
      quantity,
      unit: (unitEl?.textContent ?? '').trim(),
      unitPrice,
      totalPrice: totalPrice ?? Number((quantity * unitPrice).toFixed(2)),
    });
  }

  if (items.length === 0) return null;

  const storeNameEl = doc.querySelector('.txtTopo, .fixo-emitente-nome, #u20');
  const storeCnpjEl = doc.querySelector('.text-muted, .fixo-emitente-cnpj, #u21');
  const storeCnpjMatch = (storeCnpjEl?.textContent ?? '').match(/\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/);

  return {
    storeName: storeNameEl?.textContent?.trim() || null,
    storeCnpj: storeCnpjMatch ? storeCnpjMatch[0] : null,
    items,
  };
}
