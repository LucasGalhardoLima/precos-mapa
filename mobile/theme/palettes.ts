/**
 * Semantic palette tokens for multi-theme support.
 *
 * Components reference semantic keys (e.g. `tokens.primary`, `tokens.accent`)
 * so they work identically under any visual palette.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PaletteName =
  | 'encarte'
  | 'fintech'
  | 'economia_verde'
  | 'encarte_digital'
  | 'fintech_moderna';

export type PaletteTokens = {
  name: PaletteName;

  /** Font family for display text (headings, titles) */
  fontDisplay: string;
  /** Font family for body text (regular weight) */
  fontBody: string;
  /** Font family for body text (medium weight) */
  fontBodyMedium: string;

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
  /** Lighter primary for press/hover states */
  primaryHover: string;
  /** Very light primary tint (badges, soft backgrounds) */
  primaryMuted: string;

  /** Discount/promo highlight color (badges, strikethrough prices) */
  accent: string;
  /** Light accent tint for badge backgrounds */
  accentSoft: string;

  /** Header / app-bar background */
  header: string;
  /** Header text color */
  headerText: string;

  /** Default border / divider */
  border: string;

  /** Success indicator (low price, savings) */
  success: string;
  /** Danger indicator (errors, alerts) */
  danger: string;
  /** Warning indicator (attention, promos) */
  warning: string;
  /** Neutral secondary text */
  muted: string;

  /** Dark surface for overlays / headers */
  dark: string;
  /** Slightly lighter dark surface */
  darkSurface: string;
  /** Subtle mist / wash background */
  mist: string;
};

// ---------------------------------------------------------------------------
// Shared functional colors (same across all palettes)
// ---------------------------------------------------------------------------

const SHARED = {
  success: '#16A34A',
  danger: '#EF4444',
  warning: '#F59E0B',
  muted: '#64748B',
} as const;

// ---------------------------------------------------------------------------
// Palette: Encarte — warm paper & chalk tones
// ---------------------------------------------------------------------------

export const ENCARTE_TOKENS: PaletteTokens = {
  name: 'encarte',
  fontDisplay: 'Nunito_800ExtraBold',
  fontBody: 'Inter_400Regular',
  fontBodyMedium: 'Inter_500Medium',

  bg: '#FAF7F0',
  surface: '#FFFFFF',
  textPrimary: '#1E2820',
  textSecondary: '#4A5568',
  textHint: '#8A97A8',
  primary: '#2A6041',
  primaryHover: '#3A7A55',
  primaryMuted: '#E2F5EC',
  accent: '#C8392B',
  accentSoft: '#FDEAEC',
  header: '#1E2820',
  headerText: '#FFFFFF',
  border: '#E2E8F0',
  ...SHARED,
  dark: '#1E2820',
  darkSurface: '#2A3530',
  mist: '#F1F5F9',
};

// ---------------------------------------------------------------------------
// Palette: Fintech — cool graphite & deep green
// ---------------------------------------------------------------------------

export const FINTECH_TOKENS: PaletteTokens = {
  name: 'fintech',
  fontDisplay: 'Inter_500Medium',
  fontBody: 'Inter_400Regular',
  fontBodyMedium: 'Inter_500Medium',

  bg: '#FAFBFC',
  surface: '#F2F4F7',
  textPrimary: '#0D1520',
  textSecondary: '#4A5568',
  textHint: '#8A97A8',
  primary: '#0B5E3A',
  primaryHover: '#167A4D',
  primaryMuted: '#E2F5EC',
  accent: '#C8192B',
  accentSoft: '#FDEAEC',
  header: '#0B5E3A',
  headerText: '#FFFFFF',
  border: '#DDE2EA',
  ...SHARED,
  dark: '#0C1829',
  darkSurface: '#162438',
  mist: '#E8EDF5',
};

// ---------------------------------------------------------------------------
// Palette: Economia Verde — teal + golden yellow
// ---------------------------------------------------------------------------

export const ECONOMIA_VERDE_TOKENS: PaletteTokens = {
  name: 'economia_verde',
  fontDisplay: 'Poppins_700Bold',
  fontBody: 'Inter_400Regular',
  fontBodyMedium: 'Inter_500Medium',

  bg: '#F0FDFA',
  surface: '#FFFFFF',
  textPrimary: '#1A1A2E',
  textSecondary: '#4A5568',
  textHint: '#8A97A8',
  primary: '#0D9488',
  primaryHover: '#14B8A6',
  primaryMuted: '#CCFBF1',
  accent: '#F59E0B',
  accentSoft: '#FEF3C7',
  header: '#0D9488',
  headerText: '#FFFFFF',
  border: '#E2E8F0',
  ...SHARED,
  dark: '#1A1A2E',
  darkSurface: '#2D2D44',
  mist: '#F0FDFA',
};

// ---------------------------------------------------------------------------
// Palette: Encarte Digital — green + red promos
// ---------------------------------------------------------------------------

export const ENCARTE_DIGITAL_TOKENS: PaletteTokens = {
  name: 'encarte_digital',
  fontDisplay: 'Nunito_800ExtraBold',
  fontBody: 'Inter_400Regular',
  fontBodyMedium: 'Inter_500Medium',

  bg: '#ECFDF5',
  surface: '#FFFFFF',
  textPrimary: '#1E293B',
  textSecondary: '#4A5568',
  textHint: '#8A97A8',
  primary: '#059669',
  primaryHover: '#10B981',
  primaryMuted: '#D1FAE5',
  accent: '#EF4444',
  accentSoft: '#FEE2E2',
  header: '#059669',
  headerText: '#FFFFFF',
  border: '#E2E8F0',
  ...SHARED,
  dark: '#1E293B',
  darkSurface: '#334155',
  mist: '#ECFDF5',
};

// ---------------------------------------------------------------------------
// Palette: Fintech Moderna — cyan + purple
// ---------------------------------------------------------------------------

export const FINTECH_MODERNA_TOKENS: PaletteTokens = {
  name: 'fintech_moderna',
  fontDisplay: 'Poppins_700Bold',
  fontBody: 'Inter_400Regular',
  fontBodyMedium: 'Inter_500Medium',

  bg: '#F0F9FF',
  surface: '#FFFFFF',
  textPrimary: '#0F172A',
  textSecondary: '#4A5568',
  textHint: '#8A97A8',
  primary: '#0891B2',
  primaryHover: '#22D3EE',
  primaryMuted: '#CFFAFE',
  accent: '#8B5CF6',
  accentSoft: '#EDE9FE',
  header: '#0891B2',
  headerText: '#FFFFFF',
  border: '#E2E8F0',
  ...SHARED,
  dark: '#0F172A',
  darkSurface: '#1E293B',
  mist: '#F0F9FF',
};
