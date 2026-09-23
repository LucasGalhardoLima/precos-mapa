// Pure logic for the Resposta screen (app/product/[id].tsx) — no I/O, so it
// stays unit-testable the way pickGenericWinner/computeTitlePhrase are in
// raiz.ts. Everything here implements docs/poup-mlp-decisoes.md's "Resposta
// (4a–4d)" spec (refined 17/09) and the artifact's 3a–3d annotations
// (https://claude.ai/artifact/2iTFp1CFYKN3kVAtMr6p8C#t3) — see file header
// comments below for the exact source of each rule.
//
// ONDE groups by chain (rede), not physical branch (Lucas, 2026-09-23,
// after live testing surfaced a bug — see the comparison-tie note below).
// mobile/CLAUDE.md's own framing is "onde este produto está mais barato
// hoje, nos 4 mercados de Matão" — the "4 mercados" are the 4 chains, not
// the ~9 physical locations (Amarelinha alone has 5). A branch-level ONDE
// showed 4 different Amarelinha addresses as if they were 4 different
// markets, which they aren't — same chain, same price, same market.

import { chainLabelForStore } from './chains';

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

// One line of the default ONDE view — one per CHAIN, never a physical
// branch. `distanceKm` is the nearest branch of this chain AMONG the ones
// carrying `price` (its cheapest today), not necessarily the single
// nearest branch overall — see aggregateChainPrice below.
export interface WhereRow {
  chainLabel: string;
  price: number;
  distanceKm: number | null;
  daysAgo: number;
  isWinner: boolean;
  isHere: boolean;
  isStale: boolean; // only true in 3d's flat list — elsewhere a fully-stale chain routes to staleStores instead
}

// One physical location — only shown when "ver todos os mercados" expands
// (doc/Lucas: "Filiais só em 'ver todos os mercados'"). Unfiltered: every
// branch that returned a row at all, fresh or stale.
export interface BranchRow {
  storeId: string;
  storeName: string;
  chainLabel: string;
  price: number;
  distanceKm: number | null;
  daysAgo: number;
  isStale: boolean;
}

export interface StaleStore {
  storeName: string; // chain label, despite the field name — kept to avoid touching every call site over a rename
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
  // pra comparar (fact/no-price, ou só 1 rede fresca).
  comparison: { amount: number; storeName: string; isHere: boolean } | null;
  // Uma linha por rede (até 4, sempre — só existem 4). A tela decide se
  // mostra "ver todos os mercados" com base em whereHasMore.
  whereRows: WhereRow[];
  whereHasMore: boolean; // alguma rede defasada (fora do ONDE) — "ver todos os mercados"
  branchRows: BranchRow[]; // todas as filiais, sem filtro — só a expansão de "ver todos os mercados" usa isto
  staleStores: StaleStore[]; // uma AmberBanner por rede totalmente defasada, só quando mode !== 'no-price'
  freshCount: number; // pro rodapé "N de 4 mercados" (comparison/fact) — irrelevante em no-price
  footerNote: string; // texto fixo do rodapé, já pronto pra renderizar
}

const UNIT_LABEL: Record<NonNullable<ProductInfo['sizeUnit']>, string> = {
  g: 'kg', // preço por unidade é sempre expresso na unidade "grande" (kg/L), não g/ml
  ml: 'L',
  un: 'un',
  m: 'm',
};

// price÷size_value, converted to the "big" unit (kg/L) when the stored unit
// is the "small" one (g/ml) — shared by the header subphrase and QUAL
// TAMANHO's own per-unit comparison, which must use the identical formula
// to be comparable at all.
function pricePerUnitValue(price: number, sizeValue: number, sizeUnit: NonNullable<ProductInfo['sizeUnit']>): number {
  const factor = sizeUnit === 'g' || sizeUnit === 'ml' ? 1000 : 1;
  return Math.round(((price / sizeValue) * factor) * 100) / 100;
}

function pricePerUnit(price: number, product: ProductInfo): RespostaView['pricePerUnit'] {
  if (product.sizeValue == null || product.sizeUnit == null) return null;
  return { value: pricePerUnitValue(price, product.sizeValue, product.sizeUnit), unit: UNIT_LABEL[product.sizeUnit] };
}

// "5 kg é o melhor por kg" / "1 L é o melhor por litro" (QUAL TAMANHO's
// fallback line, and the header subphrase's own size mention) — g/ml over
// 1000 display as kg/L, matching pricePerUnitValue's own unit conversion so
// the size shown next to a price always agrees with the unit that price is
// per. Trailing ".0" dropped (5000g → "5 kg", not "5.0 kg"); 1500g → "1.5 kg".
export function formatSize(value: number, unit: ProductInfo['sizeUnit']): string {
  const trim = (n: number) => (n % 1 === 0 ? String(n) : n.toFixed(1).replace('.', ','));
  if (unit === 'g' && value >= 1000) return `${trim(value / 1000)} kg`;
  if (unit === 'ml' && value >= 1000) return `${trim(value / 1000)} L`;
  return `${trim(value)} ${unit ?? ''}`.trim();
}

const UNIT_PHRASE: Record<NonNullable<ProductInfo['sizeUnit']>, string> = {
  g: 'por kg',
  ml: 'por litro',
  un: 'por unidade',
  m: 'por m',
};

// Strips accents, casing, and size tokens ("5 kg", "1l", "900ml", "2kg") so
// two names that differ only by pack size compare equal — QUAL TAMANHO's
// "mesmo nome-base" match. Deliberately simple (no stemming, no synonym
// table): the family is already narrowed to the same brand + size_unit
// before this ever runs, so a same-brand exact-base-name-minus-size match is
// enough — the same "don't invent a fuzzy matcher, use what the live data
// actually needs" lesson as pickGenericWinner (mobile/lib/raiz.ts).
export function normalizeBaseName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\d+(?:[.,]\d+)?\s*(?:kg|g|ml|l|un(?:idades?)?)\b/gi, '')
    .replace(/[·\-–,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// One candidate from the same brand+size_unit family (already queried and
// name-matched by the caller — see hooks/use-size-alternatives.ts) with its
// own cheapest fresh price already resolved (same "até 3 dias" rule as
// ONDE). Null price = nothing fresh for that candidate today.
export interface SizeCandidate {
  id: string;
  name: string;
  sizeValue: number;
  cheapestPriceToday: number | null;
  cheapestStoreName: string | null; // physical branch name — converted to chain label at display time, same rule as ONDE
}

export interface SizeAlternative {
  productId: string;
  name: string; // full name + size, e.g. "Arroz Tio João tipo 1 · 2 kg"
  pricePerUnitLabel: string; // "R$ 4,75/kg"
  storeName: string; // chain label
}

export type QualTamanhoResult =
  | { kind: 'none' } // no size info on the current product, no candidates at all, or no candidate priced today — bloco some
  | { kind: 'current-best'; label: string } // candidates exist and priced, none beats the current size
  | { kind: 'alternatives'; items: SizeAlternative[] }; // teto 3, ascending by price/unit

export function resolveSizeAlternatives(current: ProductInfo, currentPricePerUnit: number, candidates: SizeCandidate[]): QualTamanhoResult {
  if (current.sizeValue == null || current.sizeUnit == null) return { kind: 'none' };
  const unit = current.sizeUnit;

  const priced = candidates
    .filter((c): c is SizeCandidate & { cheapestPriceToday: number; cheapestStoreName: string } => c.cheapestPriceToday != null)
    .map((c) => ({ ...c, perUnit: pricePerUnitValue(c.cheapestPriceToday, c.sizeValue, unit) }));

  if (priced.length === 0) return { kind: 'none' };

  const better = priced
    .filter((c) => c.perUnit < currentPricePerUnit)
    .sort((a, b) => a.perUnit - b.perUnit)
    .slice(0, 3);

  if (better.length === 0) return { kind: 'current-best', label: `${formatSize(current.sizeValue, unit)} é o melhor ${UNIT_PHRASE[unit]}` };

  return {
    kind: 'alternatives',
    items: better.map((c) => ({
      productId: c.id,
      name: `${c.name} · ${formatSize(c.sizeValue, unit)}`,
      pricePerUnitLabel: `${formatBRL(c.perUnit)}/${UNIT_LABEL[unit]}`,
      storeName: chainLabelForStore(c.cheapestStoreName) ?? c.cheapestStoreName,
    })),
  };
}

function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

interface DatedRow extends RawStorePrice {
  days: number;
}

interface ChainPrice {
  chainLabel: string;
  price: number;
  distanceKm: number | null;
  daysAgo: number;
}

// One row per chain, price = that chain's cheapest among `rows`, distance =
// the nearest branch AMONG the ones tied at that cheapest price (Lucas:
// "menor preço da rede, distância da filial mais próxima com esse preço").
// Rows whose store_name doesn't match any of the 4 known chains are dropped
// rather than crashing — defensive only, every real store_name seen live
// has matched so far (see lib/chains.ts).
function aggregateChainPrices(rows: DatedRow[]): ChainPrice[] {
  const byChain = new Map<string, DatedRow[]>();
  for (const r of rows) {
    const chain = chainLabelForStore(r.store_name);
    if (!chain) continue;
    const arr = byChain.get(chain) ?? [];
    arr.push(r);
    byChain.set(chain, arr);
  }

  const result: ChainPrice[] = [];
  for (const [chainLabel, branches] of byChain) {
    const minPrice = Math.min(...branches.map((b) => b.price));
    let representative: DatedRow | null = null;
    for (const b of branches) {
      if (b.price !== minPrice) continue;
      if (!representative || (b.distance_km != null && (representative.distance_km == null || b.distance_km < representative.distance_km))) {
        representative = b;
      }
    }
    result.push({ chainLabel, price: minPrice, distanceKm: representative!.distance_km, daysAgo: representative!.days });
  }
  return result;
}

// Same grouping, different representative pick: the MOST RECENT branch
// (smallest days-stale, price as a tiebreak) rather than the cheapest —
// used where the point is "last known data", not "who's winning": 3d's flat
// list ("últimos preços vistos") and the amber band's one-line-per-chain
// summary for a fully-stale chain.
function aggregateChainMostRecent(rows: DatedRow[]): ChainPrice[] {
  const byChain = new Map<string, DatedRow[]>();
  for (const r of rows) {
    const chain = chainLabelForStore(r.store_name);
    if (!chain) continue;
    const arr = byChain.get(chain) ?? [];
    arr.push(r);
    byChain.set(chain, arr);
  }

  const result: ChainPrice[] = [];
  for (const [chainLabel, branches] of byChain) {
    let representative = branches[0]!;
    for (const b of branches.slice(1)) {
      if (b.days < representative.days || (b.days === representative.days && b.price < representative.price)) representative = b;
    }
    result.push({ chainLabel, price: representative.price, distanceKm: representative.distance_km, daysAgo: representative.days });
  }
  return result;
}

// "'Você está aqui'. Mercado mais próximo pelo GPS, com um toque para
// trocar" (doc decisão 5) — now resolved to a CHAIN, from the single
// nearest physical branch overall (any chain, fresh or not: this is a
// geography fact, independent of today's pricing data). `preferredChain`
// (folha "trocar") overrides it outright when that chain has any row at
// all among `rows`; otherwise falls back to GPS-nearest. Null when location
// is unavailable and no preferred chain applies either.
function findHereChain(rows: DatedRow[], preferredChain: string | null): string | null {
  if (preferredChain && rows.some((r) => chainLabelForStore(r.store_name) === preferredChain)) {
    return preferredChain;
  }

  let best: DatedRow | null = null;
  for (const r of rows) {
    if (r.distance_km == null) continue;
    if (!best || r.distance_km < best.distance_km!) best = r;
  }
  return best ? chainLabelForStore(best.store_name) : null;
}

// The one function the Resposta screen actually calls. Everything above is
// a building block kept separate for direct unit testing.
export function buildRespostaView(
  product: ProductInfo,
  rawRows: RawStorePrice[],
  now: Date = new Date(),
  preferredChain: string | null = null,
): RespostaView {
  const withDays: DatedRow[] = rawRows.map((r) => ({ ...r, days: daysAgo(r.last_price_date, now) }));
  const fresh = withDays.filter((r) => !isStale(r.days));
  const stale = withDays.filter((r) => isStale(r.days));
  const hereChain = findHereChain(withDays, preferredChain);

  const branchRows: BranchRow[] = withDays.map((r) => ({
    storeId: r.store_id,
    storeName: r.store_name,
    chainLabel: chainLabelForStore(r.store_name) ?? r.store_name,
    price: r.price,
    distanceKm: r.distance_km,
    daysAgo: r.days,
    isStale: isStale(r.days),
  }));

  // Nothing fresh anywhere: 3d. Everything available (even stale) renders
  // as a flat, muted fact list, one row per chain — doc/artifact never rank
  // or exclude here, there's nothing to rank ("últimos preços vistos", not
  // "menor preço").
  if (fresh.length === 0) {
    const chains = aggregateChainMostRecent(withDays);
    const whereRows: WhereRow[] = chains.map((c) => ({
      chainLabel: c.chainLabel,
      price: c.price,
      distanceKm: c.distanceKm,
      daysAgo: c.daysAgo,
      isWinner: false,
      isHere: c.chainLabel === hereChain,
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
      branchRows,
      staleStores: [],
      freshCount: 0,
      footerNote: `últimos preços vistos · ${whereRows.length} de 4 mercados`,
    };
  }

  const freshChains = aggregateChainPrices(fresh).sort((a, b) => a.price - b.price);
  const winner = freshChains[0]!;
  const hasEan = product.ean != null;

  // "sem EAN: um mercado só, nunca casado por nome entre lojas" (doc decisão
  // 3) — a fact, not a comparison, regardless of how many rows exist.
  const mode: RespostaMode = hasEan ? 'comparison' : 'fact';

  let comparison: RespostaView['comparison'] = null;
  if (mode === 'comparison') {
    const hereRow = hereChain ? freshChains.find((c) => c.chainLabel === hereChain) : undefined;
    // "sem 'aqui' ou se 'aqui' vence, compara com o 2º" (doc linha 34). A
    // tie in price between two DIFFERENT chains (rarer now that ONDE groups
    // by chain, but still structurally possible) reads as a fake "R$ 0,00 a
    // menos" if compared anyway — treated the same as "aqui already won":
    // fall through to the first chain with a genuinely different (higher)
    // price, not just position [1].
    if (hereRow && hereRow.chainLabel !== winner.chainLabel && hereRow.price !== winner.price) {
      comparison = { amount: Math.round((hereRow.price - winner.price) * 100) / 100, storeName: hereRow.chainLabel, isHere: true };
    } else {
      const nextDifferent = freshChains.find((c) => c.chainLabel !== winner.chainLabel && c.price !== winner.price);
      if (nextDifferent) {
        comparison = { amount: Math.round((nextDifferent.price - winner.price) * 100) / 100, storeName: nextDifferent.chainLabel, isHere: false };
      }
    }
  }

  const listedChains = mode === 'fact' ? freshChains.slice(0, 1) : freshChains; // fact mode is always exactly 1 chain anyway
  const whereRows: WhereRow[] = listedChains.map((c) => ({
    chainLabel: c.chainLabel,
    price: c.price,
    distanceKm: c.distanceKm,
    daysAgo: c.daysAgo,
    isWinner: mode === 'comparison' && c.chainLabel === winner.chainLabel,
    isHere: c.chainLabel === hereChain,
    isStale: false,
  }));

  // A chain routes to the amber band only when NONE of its branches made it
  // into freshChains — a chain with at least one fresh branch already has
  // its own ONDE row above, even if some of its other branches are stale.
  const freshChainLabels = new Set(freshChains.map((c) => c.chainLabel));
  const staleChains = aggregateChainMostRecent(stale).filter((c) => !freshChainLabels.has(c.chainLabel));

  return {
    mode,
    title: mode === 'comparison' ? `Menor preço no ${winner.chainLabel}` : `Preço de hoje no ${winner.chainLabel}`,
    price: winner.price,
    pricePerUnit: mode === 'comparison' ? pricePerUnit(winner.price, product) : null,
    comparison,
    whereRows,
    // Only 4 chains ever exist, so freshChains.length > 4 can't happen in
    // practice — kept as a defensive OR rather than assumed dead.
    whereHasMore: mode === 'comparison' && (staleChains.length > 0 || freshChains.length > 4),
    branchRows,
    staleStores: mode === 'comparison' ? staleChains.map((c) => ({ storeName: c.chainLabel, daysAgo: c.daysAgo })) : [],
    freshCount: freshChains.length,
    footerNote:
      mode === 'comparison'
        ? `preços de hoje, 03:00 · ${freshChains.length} de 4 mercados`
        : `preço de hoje, 03:00 · ${winner.chainLabel}`,
  };
}
