/**
 * Semantic palette tokens for dual-theme support.
 *
 * Components reference semantic keys (e.g. `tokens.bg`, `tokens.primary`)
 * instead of palette-specific color names so they work identically under
 * both the "encarte" (supermarket-flyer) and "fintech" (clean financial)
 * visual styles.
 */

// ---------------------------------------------------------------------------
// Type
// ---------------------------------------------------------------------------

export type PaletteTokens = {
  name: 'encarte' | 'fintech';

  /** Screen background */
  bg: string;
  /** Card / elevated surface background */
  surface: string;

  /** Primary body text */
  textPrimary: string;
  /** Secondary / supporting text */
  textSecondary: string;
  /** Hint / metadata text */
  textHint: string;

  /** Brand primary action color */
  primary: string;
  /** Lighter tint of primary (badges, soft backgrounds) */
  primaryLight: string;

  /** Header / app-bar background */
  header: string;
  /** Header text color */
  headerText: string;

  /** Default border / divider */
  border: string;

  /** Discount badge / price text */
  discountRed: string;
  /** Active / pressed discount state */
  discountRedActive: string;
  /** Soft red tint background */
  discountRedSoft: string;

  /** Gold accent (achievements, plus tier) */
  gold: string;
  /** Brighter gold for icons / highlights */
  goldBright: string;
  /** Light gold background */
  goldLight: string;

  /** Dark surface for overlays / headers */
  dark: string;
  /** Slightly lighter dark surface */
  darkSurface: string;
  /** Subtle mist / wash background */
  mist: string;
};

// ---------------------------------------------------------------------------
// Encarte palette — warm paper & chalk tones inspired by supermarket flyers
// ---------------------------------------------------------------------------

export const ENCARTE_TOKENS = {
  name: 'encarte',

  bg: '#FAF7F0',
  surface: '#FFFFFF',

  textPrimary: '#1E2820',
  textSecondary: '#4A5568',
  textHint: '#8A97A8',

  primary: '#2A6041',
  primaryLight: '#E2F5EC',

  header: '#1E2820',
  headerText: '#FFFFFF',

  border: '#E2E8F0',

  discountRed: '#C8392B',
  discountRedActive: '#E41E32',
  discountRedSoft: '#FDEAEC',

  gold: '#9A6108',
  goldBright: '#CF8B12',
  goldLight: '#F9EFD8',

  dark: '#1E2820',
  darkSurface: '#2A3530',
  mist: '#F1F5F9',
} as const satisfies PaletteTokens;

// ---------------------------------------------------------------------------
// Fintech palette — cool graphite & deep green for a clean financial feel
// ---------------------------------------------------------------------------

export const FINTECH_TOKENS = {
  name: 'fintech',

  bg: '#FAFBFC',
  surface: '#F2F4F7',

  textPrimary: '#0D1520',
  textSecondary: '#4A5568',
  textHint: '#8A97A8',

  primary: '#0B5E3A',
  primaryLight: '#E2F5EC',

  header: '#0B5E3A',
  headerText: '#FFFFFF',

  border: '#DDE2EA',

  discountRed: '#C8192B',
  discountRedActive: '#E41E32',
  discountRedSoft: '#FDEAEC',

  gold: '#9A6108',
  goldBright: '#CF8B12',
  goldLight: '#F9EFD8',

  dark: '#0C1829',
  darkSurface: '#162438',
  mist: '#E8EDF5',
} as const satisfies PaletteTokens;
