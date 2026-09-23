// Pure logic for the Resposta screen (app/product/[id].tsx) — no I/O, so it
// stays unit-testable the way pickGenericWinner/computeTitlePhrase are in
// raiz.ts. Everything here implements docs/poup-mlp-decisoes.md's "Resposta
// (4a–4d)" spec (refined 17/09) and the artifact's 3a–3d annotations
// (https://claude.ai/artifact/2iTFp1CFYKN3kVAtMr6p8C#t3) — see file header
// comments below for the exact source of each rule.

// Raw shape of one row inside get_product_prices' jsonb array
// (supabase/migrations/072_hide_promotions_from_consumer_app.sql). Already
// sorted search_priority DESC, price ASC by the RPC — no staleness filter
// applied there, that's this file's job.
export interface RawStorePrice {
  store_id: string;
  store_name: string;
  price: number;
  distance_km: number | null;
  last_price_date: string; // timestamptz
  store_logo_initial: string | null;
  store_logo_color: string | null;
}

export interface ProductInfo {
  id: string;
  name: string;
  brand: string | null;
  ean: string | null;
  imageUrl: string | null;
  sizeValue: number | null;
  sizeUnit: 'g' | 'ml' | 'un' | 'm' | null;
}

// mobile/CLAUDE.md "Frescor" + doc decisão 2: "Atualizado na última rodada:
// sem rótulo. 2–3 dias: entra no ONDE com 'há N dias' em cinza. Mais de 3
// dias: fora do ranking, só em 'ver todos os mercados'." "Última rodada" is
// interpreted as the same calendar day (UTC), matching the one other place
// this app already defines freshness (use-market-freshness.ts's `today`
// check) — not a new convention invented here.
export function daysAgo(lastPriceDate: string, now: Date = new Date()): number {
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const priceDay = new Date(lastPriceDate);
  const priceDayUtc = new Date(Date.UTC(priceDay.getUTCFullYear(), priceDay.getUTCMonth(), priceDay.getUTCDate()));
  const diffMs = today.getTime() - priceDayUtc.getTime();
  return Math.max(0, Math.round(diffMs / 86_400_000));
}

export function isStale(days: number): boolean {
  return days > 3;
}

// null = last round, no label. 1–3 = "há N dias". Caller decides what to do
// with a stale (>3) day count — this just formats it for when it's still
// shown (3d's "últimos preços vistos" list keeps stale rows visible).
export function freshnessLabel(days: number): string | null {
  if (days === 0) return null;
  return `há ${days} dia${days === 1 ? '' : 's'}`;
}

export interface WhereRow {
  storeId: string;
  storeName: string;
  price: number;
  distanceKm: number | null;
  daysAgo: number;
  isWinner: boolean;
  isHere: boolean;
  isStale: boolean;
}

export interface StaleStore {
  storeName: string;
  daysAgo: number;
}

export type RespostaMode = 'comparison' | 'fact' | 'no-price';

export interface RespostaView {
  mode: RespostaMode;
  title: string; // e.g. "Menor preço no Tenda" / "Preço de hoje no Jaú Serve" / "Sem preço hoje"
  price: number | null; // paired with title; null only for 'no-price'
  // R$/unidade do vencedor, se o produto tiver tamanho parseado. Null quando
  // não há size_value/size_unit (bloco QUAL TAMANHO também some nesse caso,
  // mas a subfrase de preço/unidade é uma linha própria — doc linha 34).
  pricePerUnit: { value: number; unit: string } | null;
  // "R$ Z a menos que no [aqui]" ou "...no [2º]" — null quando não há nada
  // pra comparar (fact/no-price, ou só 1 loja fresca).
  comparison: { amount: number; storeName: string; isHere: boolean } | null;
  // Lista completa (não cortada) — a tela decide quanto mostrar (teto 4,
  // "ver todos os mercados" expande em lugar, mesmo padrão do "ver mais N"
  // do Resultado) em vez do lib cortar de antemão.
  whereRows: WhereRow[];
  whereHasMore: boolean; // > 4 linhas frescas — "ver todos os mercados"
  staleStores: StaleStore[]; // uma AmberBanner por item, só quando mode !== 'no-price'
  freshCount: number; // pro rodapé "N de 4 mercados" (comparison/fact) — irrelevante em no-price
  footerNote: string; // texto fixo do rodapé, já pronto pra renderizar
}

const UNIT_LABEL: Record<NonNullable<ProductInfo['sizeUnit']>, string> = {
  g: 'kg', // preço por unidade é sempre expresso na unidade "grande" (kg/L), não g/ml
  ml: 'L',
  un: 'un',
  m: 'm',
};

function pricePerUnit(price: number, product: ProductInfo): RespostaView['pricePerUnit'] {
  if (product.sizeValue == null || product.sizeUnit == null) return null;
  const factor = product.sizeUnit === 'g' || product.sizeUnit === 'ml' ? 1000 : 1;
  const perUnit = (price / product.sizeValue) * factor;
  return { value: Math.round(perUnit * 100) / 100, unit: UNIT_LABEL[product.sizeUnit] };
}

// Nearest store by distance_km — "'Você está aqui'. Mercado mais próximo
// pelo GPS" (doc decisão 5). Null when location is unavailable or no row
// carries a distance at all.
function findHereStoreId(rows: RawStorePrice[]): string | null {
  let best: RawStorePrice | null = null;
  for (const r of rows) {
    if (r.distance_km == null) continue;
    if (!best || r.distance_km < best.distance_km!) best = r;
  }
  return best?.store_id ?? null;
}

// The one function the Resposta screen actually calls. Everything above is
// a building block kept separate for direct unit testing.
export function buildRespostaView(product: ProductInfo, rawRows: RawStorePrice[], now: Date = new Date()): RespostaView {
  const withDays = rawRows.map((r) => ({ ...r, days: daysAgo(r.last_price_date, now) }));
  const fresh = withDays.filter((r) => !isStale(r.days));
  const stale = withDays.filter((r) => isStale(r.days));

  // Nothing fresh anywhere: 3d. Everything available (even stale) renders
  // as a flat, muted fact list — doc/artifact never rank or exclude here,
  // there's nothing to rank ("últimos preços vistos", not "menor preço").
  if (fresh.length === 0) {
    const hereId = findHereStoreId(withDays);
    const whereRows: WhereRow[] = withDays.map((r) => ({
      storeId: r.store_id,
      storeName: r.store_name,
      price: r.price,
      distanceKm: r.distance_km,
      daysAgo: r.days,
      isWinner: false,
      isHere: r.store_id === hereId,
      isStale: true,
    }));
    return {
      mode: 'no-price',
      title: 'Sem preço hoje',
      price: null,
      pricePerUnit: null,
      comparison: null,
      whereRows,
      whereHasMore: false,
      staleStores: [],
      freshCount: 0,
      footerNote: `últimos preços vistos · ${whereRows.length} de 4 mercados`,
    };
  }

  const hereId = findHereStoreId(fresh);
  const winner = fresh[0]; // RPC already sorts price ASC among search_priority-tied rows
  const hasEan = product.ean != null;

  // "sem EAN: um mercado só, nunca casado por nome entre lojas" (doc decisão
  // 3) — a fact, not a comparison, regardless of how many rows exist.
  const mode: RespostaMode = hasEan ? 'comparison' : 'fact';

  let comparison: RespostaView['comparison'] = null;
  if (mode === 'comparison') {
    const hereRow = hereId ? fresh.find((r) => r.store_id === hereId) : undefined;
    // "sem 'aqui' ou se 'aqui' vence, compara com o 2º" (doc linha 34).
    if (hereRow && hereRow.store_id !== winner.store_id) {
      comparison = { amount: Math.round((hereRow.price - winner.price) * 100) / 100, storeName: hereRow.store_name, isHere: true };
    } else if (fresh[1]) {
      comparison = { amount: Math.round((fresh[1].price - winner.price) * 100) / 100, storeName: fresh[1].store_name, isHere: false };
    }
  }

  const listedFresh = mode === 'fact' ? fresh.slice(0, 1) : fresh; // fact mode is always exactly 1 row anyway
  const whereRows: WhereRow[] = listedFresh.map((r) => ({
    storeId: r.store_id,
    storeName: r.store_name,
    price: r.price,
    distanceKm: r.distance_km,
    daysAgo: r.days,
    isWinner: mode === 'comparison' && r.store_id === winner.store_id,
    isHere: r.store_id === hereId,
    isStale: false,
  }));

  return {
    mode,
    title: mode === 'comparison' ? `Menor preço no ${winner.store_name}` : `Preço de hoje no ${winner.store_name}`,
    price: winner.price,
    pricePerUnit: mode === 'comparison' ? pricePerUnit(winner.price, product) : null,
    comparison,
    whereRows,
    whereHasMore: mode === 'comparison' && fresh.length > 4,
    staleStores: mode === 'comparison' ? stale.map((r) => ({ storeName: r.store_name, daysAgo: r.days })) : [],
    freshCount: fresh.length,
    footerNote:
      mode === 'comparison'
        ? `preços de hoje, 03:00 · ${fresh.length} de 4 mercados`
        : `preço de hoje, 03:00 · ${winner.store_name}`,
  };
}
