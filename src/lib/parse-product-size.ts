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
 *  2. The last mass/volume/length match. Names often trail a real content
 *     size with a secondary bundling count ("Pacote 284g 2 Unidades" — two
 *     284g packs) — the mass/volume is the actual per-item content size,
 *     the count is packaging, so it must win even though it appears first.
 *  3. Only if no mass/volume/length token exists at all, the last count
 *     match ("30 Un") — here the count genuinely is the size.
 */
export function parseProductSize(name: string): ParsedSize | null {
  const multiplierMatches = [...name.matchAll(MULTIPLIER_RE)];
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

  const simpleMatches = [...name.matchAll(SIZE_RE)];
  if (simpleMatches.length === 0) return null;

  const physical = simpleMatches.filter(([, , unitRaw]) => !COUNT_UNITS.includes(unitRaw.toLowerCase()));
  const physicalResult = pickSaneMatch(physical, ([, qtyRaw, unitRaw]) => toBaseIfSane(parseNum(qtyRaw), unitRaw));
  if (physicalResult) return physicalResult;

  return pickSaneMatch(simpleMatches, ([, qtyRaw, unitRaw]) => toBaseIfSane(parseNum(qtyRaw), unitRaw));
}
