/**
 * Semantic palette tokens — Economia Verde theme.
 */

export type PaletteTokens = {
  fontDisplay: string;
  fontBody: string;
  fontBodyMedium: string;
  bg: string;
  surface: string;
  textPrimary: string;
  textSecondary: string;
  textHint: string;
  primary: string;
  primaryHover: string;
  primaryMuted: string;
  accent: string;
  accentSoft: string;
  header: string;
  headerText: string;
  border: string;
  success: string;
  danger: string;
  warning: string;
  muted: string;
  dark: string;
  darkSurface: string;
  mist: string;
};

const SHARED = {
  success: '#16A34A',
  danger: '#EF4444',
  warning: '#F59E0B',
  muted: '#64748B',
} as const;

export const TOKENS: PaletteTokens = {
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
