// ============================================================================
// Verified against a real nfce.fazenda.sp.gov.br consulta page (fetched from
// an actual device-scanned São Paulo receipt). The selectors themselves
// (`table#tabResult`, `.txtTit`/`.RCod`/`.Rqtd`/`.RUN`/`.RvlUnit`/`.valor`)
// were right on the first guess; the bug was assuming each field's element
// held a bare value. Real markup embeds a label in the same element
// ("<strong>Qtde.:</strong>1", "<strong>Vl. Unit.:</strong> 2,29",
// "<strong>UN: </strong>KG"), and the CNPJ has no dedicated class at all —
// it's a plain ".text" div next to the address inside ".txtCenter". See
// parseBrNumber and the unit/CNPJ extraction below for how those are pulled
// out from the surrounding label text.
//
// Still only tested against one real receipt/store — other stores' NFC-e
// templates could vary (missing address line, different row shape, etc.).
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

// Real SP markup embeds a label inside the same element as the value
// ("<strong>Qtde.:</strong>1", "<strong>Vl. Unit.:</strong> 2,29"), so the
// element's textContent is "Qtde.:1"/"Vl. Unit.: 2,29", not a bare number —
// confirmed against a real consulta page fetch. Only the trailing numeric
// token (Brazilian formatting: "1.234,56" -> 1234.56) is the actual value.
function parseBrNumber(text: string): number | null {
  const match = text.trim().match(/(-?\d{1,3}(?:\.\d{3})*(?:,\d+)?)\s*$/);
  if (!match) return null;
  const cleaned = match[1].replace(/\./g, '').replace(',', '.');
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
    // Real markup wraps the code as "(Código:\n11476\n)" — strip everything
    // but digits rather than testing the raw label text.
    const rawEan = (codeEl?.textContent ?? '').replace(/\D/g, '');

    // Same label-in-value shape as quantity/price ("<strong>UN: </strong>UN")
    // in real markup — take whatever follows the last colon, falling back to
    // the raw text when there's no label (the fixture's plain "UN").
    const unitRaw = unitEl?.textContent ?? '';
    const unitMatch = unitRaw.match(/:\s*(\S.*)$/);
    const unit = (unitMatch ? unitMatch[1] : unitRaw).trim();

    items.push({
      ean: /^\d{8,14}$/.test(rawEan) ? rawEan : null,
      description: (descriptionEl.textContent ?? '').trim(),
      quantity,
      unit,
      unitPrice,
      totalPrice: totalPrice ?? Number((quantity * unitPrice).toFixed(2)),
    });
  }

  if (items.length === 0) return null;

  const storeNameEl = doc.querySelector('.txtTopo, .fixo-emitente-nome, #u20');
  // Real SP markup has no dedicated CNPJ element — it's a generic `.text` div
  // alongside the address, inside the `.txtCenter` store-info block. Try a
  // specific selector first (other portal templates / the fixture), then
  // fall back to searching that whole block's text for a CNPJ-shaped run.
  const storeCnpjEl = doc.querySelector('.text-muted, .fixo-emitente-cnpj, #u21');
  const cnpjSearchScope = storeCnpjEl ?? doc.querySelector('.txtCenter') ?? doc;
  const storeCnpjMatch = (cnpjSearchScope.textContent ?? '').match(/\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/);

  return {
    storeName: storeNameEl?.textContent?.trim() || null,
    storeCnpj: storeCnpjMatch ? storeCnpjMatch[0] : null,
    items,
  };
}
