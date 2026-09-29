/**
 * Extracts a pack size from a free-text product name and normalizes it to
 * one of three base units (g, ml, un) so different pack sizes/units are
 * directly comparable (e.g. for price-per-unit). "m" is a fourth base unit
 * for length-sold items (toilet paper, foil) that don't fit mass/volume/count.
 *
 * Regex-only, no LLM: this is the fast/cheap pass over the catalog. Names
 * it can't confidently parse (~40% of the catalog, measured 2026-09-15 —
 * multi-buy phrasing, missing units, ambiguous abbreviations) are left null
 * for a future LLM pass rather than guessed at here.
 */

export type SizeUnit = "g" | "ml" | "un" | "m";

export interface ParsedSize {
  value: number;
  unit: SizeUnit;
}

// Same abbreviation vocabulary as SIZE_UNIT_RE in schemas.ts (extractBrand's
// size-token skip list), extended with length units (m/cm) and "unidade(s)"
// for the space-separated form ("50 unidades"), which that token-only regex
// doesn't need to handle.
const MASS_UNITS: Record<string, number> = { kg: 1000, g: 1, gr: 1, mg: 0.001 };
const VOLUME_UNITS: Record<string, number> = { l: 1000, lt: 1000, ml: 1, cl: 10 };
const LENGTH_UNITS: Record<string, number> = { m: 1, cm: 0.01 };
const COUNT_UNITS = ["unidades", "unidade", "unid", "und", "un", "pct", "cx", "pack"];

const ALL_UNIT_KEYS = [
  ...Object.keys(MASS_UNITS),
  ...Object.keys(VOLUME_UNITS),
  ...Object.keys(LENGTH_UNITS),
  ...COUNT_UNITS,
].sort((a, b) => b.length - a.length); // longest-first so "unidades" wins over "un"

const NUM = String.raw`\d+(?:[.,]\d+)?`;
const UNIT_ALT = ALL_UNIT_KEYS.join("|");
// Negative lookahead blocks matching inside a longer word (e.g. "l" in "Litoral").
const SIZE_RE = new RegExp(`(${NUM})\\s*(${UNIT_ALT})(?![a-zà-úçã])`, "gi");
// Multiplier ("6x350ml") only for mass/volume units. This is a general-merchandise
// catalog (hardware, cosmetics, not just groceries) where "AxBcm"/"AxBmm" is
// overwhelmingly a two-dimensional physical size ("Pistola 12x10cm"), not a pack
// count — unlike "6x350ml"/"2x1kg", which is unambiguous grocery pack notation.
const MULTIPLIER_UNIT_ALT = [...Object.keys(MASS_UNITS), ...Object.keys(VOLUME_UNITS)]
  .sort((a, b) => b.length - a.length)
  .join("|");
const MULTIPLIER_RE = new RegExp(`(\\d+)\\s*[xX]\\s*(${NUM})\\s*(${MULTIPLIER_UNIT_ALT})(?![a-zà-úçã])`, "gi");

// Physical dimensions ("280x260cm", "1,88m x 0,88m x 30cm", "300x200x150mm")
// are not a pack size: the simple-size matcher below would read the last
// factor ("260cm" -> 2.6 m). Blank them out before matching. A chain counts as
// dimensions when it carries a cm/mm unit, or a length unit on two or more
// factors. "12x30m" (12 rolls x 30 m) has one bare-number "m" chain, so it is
// left alone: there the 30 m per roll is the size this parser has always returned.
const DIM_FACTOR = String.raw`${NUM}\s*(?:cm|mm|m(?![a-zà-úçã]))?`;
const DIMENSIONS_RE = new RegExp(`${DIM_FACTOR}(?:\\s*[xX×]\\s*${DIM_FACTOR})+`, "gi");
const LENGTH_UNIT_TOKEN_RE = /(cm|mm|m)(?![a-zà-úçã])/gi;

function stripDimensions(name: string): string {
  // For goods sold by length ("Filme PVC 28cm x 15m", "Fita 10m x 19mm") a chain with a
  // metre factor is width x length and the length is the size: leave it to the matcher.
  const lengthSold = LENGTH_SOLD_RE.test(name);
  return name.replace(DIMENSIONS_RE, (chain) => {
    const units = [...chain.matchAll(LENGTH_UNIT_TOKEN_RE)].map((m) => m[1].toLowerCase());
    if (lengthSold && units.includes("m")) return chain;
    const isDimensions = units.length >= 2 || units.some((u) => u === "cm" || u === "mm");
    return isDimensions ? " " : chain;
  });
}

// Text that carries a number and a unit but is not the pack size, blanked
// before matching: a capacity ("Suporta até 0,5kg" on a hook) and a per-unit
// content next to an explicit total ("510g 6 Unidades 85g Cada" — 510 g is the
// tray, 85 g is one pot).
const CAPACITY_RE = new RegExp(`(?:suporta|aguenta|resiste)(?:\\s+at[ée])?\\s*${NUM}\\s*(?:kg|g)(?![a-zà-úçã])`, "gi");
const PER_UNIT_RE = new RegExp(`${NUM}\\s*(?:kg|gr|g|ml|lt|l|cl)\\s*cada(?![a-zà-úçã])`, "gi");

function stripNoise(name: string): string {
  return name.replace(CAPACITY_RE, " ").replace(PER_UNIT_RE, " ");
}

/** The last "X g cada" in the name, as a base-unit size (mass/volume only). */
function perUnitSize(name: string): ParsedSize | null {
  const m = [...name.matchAll(PER_UNIT_RE)].pop();
  if (!m) return null;
  const parsed = m[0].match(new RegExp(`(${NUM})\\s*(kg|gr|g|ml|lt|l|cl)`, "i"));
  return parsed ? toBaseIfSane(parseNum(parsed[1]), parsed[2]) : null;
}

// A bare length ("Tampa 24cm", "Rodo 60cm", "Prato 15cm") is a physical
// dimension, not a pack size — except for goods actually sold by length.
const LENGTH_SOLD_RE = /\b(?:filme|papel|fio|fios|saco|sacos|sacola|sacolas|rolo|rolos|fita|fitas|barbante|corda|mangueira|el[aá]stico|folha\s+de\s+alum[ií]nio)\b/i;

// "3 Unidades de 25g", "144 sachês de 7g": N packs of X, so the total is N x X.
const COUNT_OF_UNITS = "unidades|unidade|unid|und|un|pacotes|pacote|pct|sachês|sachê|saches|sache";
const COUNT_OF_RE = new RegExp(
  `(\\d+)\\s*(?:${COUNT_OF_UNITS})\\s*de\\s*(${NUM})\\s*(${MULTIPLIER_UNIT_ALT})(?![a-zà-úçã])`,
  "gi",
);
// "Sachê 7g 144 Unidades": after a single-serve noun the trailing count is how
// many single-serve packs there are, so the size is X x N. Without such a noun (or
// "cada", "N x", "N unidades de") "X g N unidades" gets no size, see parseStripped.
const SINGLE_SERVE_RE = new RegExp(
  `(?:sach[êe]s?|sticks?|pouch(?:es)?|monodoses?|ampolas?)\\s+(?:[^\\s\\d]+\\s+){0,3}(${NUM})\\s*(${MULTIPLIER_UNIT_ALT})\\s+(?:com\\s+|c/\\s*)?(\\d+)\\s*(?:unidades|unidade|unid|und|un)(?![a-zà-úçã])`,
  "i",
);

function toBase(value: number, rawUnit: string): ParsedSize {
  const unit = rawUnit.toLowerCase();
  if (unit in MASS_UNITS) return { value: value * MASS_UNITS[unit], unit: "g" };
  if (unit in VOLUME_UNITS) return { value: value * VOLUME_UNITS[unit], unit: "ml" };
  if (unit in LENGTH_UNITS) return { value: value * LENGTH_UNITS[unit], unit: "m" };
  return { value, unit: "un" };
}

function parseNum(raw: string): number {
  // Brazilian formatting: "," is always a decimal separator. "." followed by
  // exactly 3 digits ("1.050") is a THOUSANDS separator, not a decimal point
  // — a pack size is never expressed to 3 decimal places, so this can't
  // collide with a genuine "1.5" (one dot-digit) or "2.750" being read wrong
  // the other way.
  const thousands = raw.match(/^(\d+)\.(\d{3})$/);
  if (thousands) return parseInt(thousands[1] + thousands[2], 10);
  return parseFloat(raw.replace(",", "."));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// Sanity ceilings. Without these, two real catalog bugs slip through
// silently instead of erroring: a 13-digit EAN sitting next to "Un" in the
// name ("...7891027314972 Un/1") reads as ~7.9 trillion units, and bulk
// "granel" produce ("Manga Palmer 600kg") reads as literal tons — both
// numerically valid, both nonsense for a single retail SKU. Bounds are
// generous on purpose (50kg/50L covers large atacado bags and water jugs)
// so only genuinely implausible reads get rejected; rejected values fall
// back to the next candidate match, or null if none are sane.
const RAW_VALUE_CEILING = 99_999; // no real pack quantity is a 5+ digit number
const MULTIPLIER_COUNT_CEILING = 1_000; // no SKU is "1,000x" anything
const BASE_CEILINGS: Record<SizeUnit, number> = { g: 50_000, ml: 50_000, un: 5_000, m: 500 };

/** Exported so other size extractors (e.g. an LLM pass) can validate against the same bounds instead of duplicating them. */
export function isSaneSize(value: number, unit: SizeUnit): boolean {
  return Number.isFinite(value) && value > 0 && value <= BASE_CEILINGS[unit];
}

function toBaseIfSane(rawValue: number, rawUnit: string): ParsedSize | null {
  if (rawValue > RAW_VALUE_CEILING) return null;
  const base = toBase(rawValue, rawUnit);
  if (base.value > BASE_CEILINGS[base.unit]) return null;
  return { value: round2(base.value), unit: base.unit };
}

/** Scans matches from the end (pack size conventionally trails the name), returning the first sane one. */
function pickSaneMatch<T extends RegExpMatchArray>(matches: T[], toSize: (m: T) => ParsedSize | null): ParsedSize | null {
  for (let i = matches.length - 1; i >= 0; i--) {
    const result = toSize(matches[i]);
    if (result) return result;
  }
  return null;
}

/**
 * Returns the parsed pack size, or null if no confident/sane match.
 *
 * Priority when a name has more than one size-like token:
 *  1. A multiplier pattern ("6x350ml") — most explicit, always wins.
 *  2. The last mass/volume/length match — unless the name also has a pack
 *     count of 2 or more with no marker ("Pacote 284g 2 Unidades": 284 g may
 *     be the whole pack or each of two), which gets no size.
 *  3. Only if no mass/volume/length token exists at all, the last count
 *     match ("30 Un") — here the count genuinely is the size.
 */
export function parseProductSize(rawName: string): ParsedSize | null {
  const withoutDimensions = stripDimensions(rawName);
  const perUnit = perUnitSize(withoutDimensions);
  const result = parseStripped(stripNoise(withoutDimensions), perUnit !== null);
  // "12 Unidades 350ml Cada": no explicit total, so the size is N x X. With an explicit
  // total ("510g 6 Unidades 85g Cada") the mass/volume above already won.
  if (perUnit && (!result || result.unit === "un")) {
    const total = round2(perUnit.value * (result?.value ?? 1));
    if (total <= BASE_CEILINGS[perUnit.unit]) return { value: total, unit: perUnit.unit };
  }
  return result;
}

function parseStripped(name: string, hasPerUnitMarker: boolean): ParsedSize | null {
  const multiplierMatches = [...name.matchAll(MULTIPLIER_RE), ...name.matchAll(COUNT_OF_RE)];
  const multiplierResult = pickSaneMatch(multiplierMatches, ([, countRaw, qtyRaw, unitRaw]) => {
    const count = parseInt(countRaw, 10);
    if (count > MULTIPLIER_COUNT_CEILING) return null;
    const qty = parseNum(qtyRaw);
    if (qty > RAW_VALUE_CEILING) return null;
    const base = toBase(qty, unitRaw);
    const total = round2(base.value * count);
    if (total > BASE_CEILINGS[base.unit]) return null;
    return { value: total, unit: base.unit };
  });
  if (multiplierResult) return multiplierResult;

  const singleServe = name.match(SINGLE_SERVE_RE);
  if (singleServe) {
    const qty = parseNum(singleServe[1]);
    const count = parseInt(singleServe[3], 10);
    if (qty <= RAW_VALUE_CEILING && count <= MULTIPLIER_COUNT_CEILING) {
      const base = toBase(qty, singleServe[2]);
      const total = round2(base.value * count);
      if (total <= BASE_CEILINGS[base.unit]) return { value: total, unit: base.unit };
    }
  }

  const lengthSold = LENGTH_SOLD_RE.test(name);
  const simpleMatches = [...name.matchAll(SIZE_RE)].filter(
    ([, , unitRaw]) => lengthSold || !(unitRaw.toLowerCase() in LENGTH_UNITS),
  );
  if (simpleMatches.length === 0) return null;

  const physical = simpleMatches.filter(([, , unitRaw]) => !COUNT_UNITS.includes(unitRaw.toLowerCase()));
  const physicalResult = pickSaneMatch(physical, ([, qtyRaw, unitRaw]) => toBaseIfSane(parseNum(qtyRaw), unitRaw));
  if (physicalResult && physicalResult.unit !== "m" && !hasPerUnitMarker) {
    // "X g N unidades" with no marker (cada, sachê/stick, "N x", "N unidades de"): X can be the
    // whole pack or one item and the name alone doesn't say which, so no size rather than a guess.
    const packCount = simpleMatches.some(
      ([, qtyRaw, unitRaw]) => COUNT_UNITS.includes(unitRaw.toLowerCase()) && parseNum(qtyRaw) >= 2,
    );
    if (packCount) return null;
  }
  if (physicalResult) return physicalResult;

  return pickSaneMatch(simpleMatches, ([, qtyRaw, unitRaw]) => toBaseIfSane(parseNum(qtyRaw), unitRaw));
}
