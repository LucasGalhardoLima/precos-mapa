import { useMemo } from 'react';

import type { PaletteName } from '../theme/palettes';
import { useTheme } from '../theme/use-theme';

// ---------------------------------------------------------------------------
// Type
// ---------------------------------------------------------------------------

export interface ThemeClasses {
  // Backgrounds
  /** Screen background */
  bg: string;
  /** Card/surface background */
  surface: string;
  /** Header/economy card background */
  headerBg: string;
  /** Header text color */
  headerText: string;
  /** Discount card background tint */
  discountBg: string;

  // Text
  /** Primary text color class */
  textPrimary: string;
  /** Secondary text color class */
  textSecondary: string;
  /** Hint/metadata text color class */
  textHint: string;

  // Borders
  /** Default border class */
  border: string;
  /** List separator class (dotted for encarte, solid for fintech) */
  separator: string;

  // Interactive
  /** Primary button bg + text classes */
  primaryButton: string;
  /** Primary button text color */
  primaryButtonText: string;

  // Semantic
  /** Discount price/badge text */
  discountText: string;
  /** Positive savings text (green) */
  savingsText: string;
  /** Achievement/Plus text */
  goldText: string;
  /** Plus section background */
  goldBg: string;

  // Tab bar
  tabBarBg: string;
  tabBarActive: string;
  tabBarInactive: string;
}

// ---------------------------------------------------------------------------
// Static class maps — defined once, never re-created
// ---------------------------------------------------------------------------

const ENCARTE_CLASSES: ThemeClasses = {
  bg: 'bg-encarte-paper',
  surface: 'bg-white',
  headerBg: 'bg-encarte-chalk',
  headerText: 'text-white',
  discountBg: 'bg-[#FDEAEC]',

  textPrimary: 'text-encarte-chalk',
  textSecondary: 'text-[#4A5568]',
  textHint: 'text-[#8A97A8]',

  border: 'border-border',
  separator: 'border-dashed border-border',

  primaryButton: 'bg-encarte-green',
  primaryButtonText: 'text-white',

  discountText: 'text-encarte-red',
  savingsText: 'text-encarte-green',
  goldText: 'text-[#9A6108]',
  goldBg: 'bg-[#F9EFD8]',

  tabBarBg: 'bg-white',
  tabBarActive: 'text-encarte-green',
  tabBarInactive: 'text-[#8A97A8]',
};

const FINTECH_CLASSES: ThemeClasses = {
  bg: 'bg-fintech-box',
  surface: 'bg-fintech-surface',
  headerBg: 'bg-fintech-deepGreen',
  headerText: 'text-white',
  discountBg: 'bg-fintech-softRed',

  textPrimary: 'text-fintech-graphite',
  textSecondary: 'text-fintech-lead',
  textHint: 'text-fintech-silver',

  border: 'border-fintech-line',
  separator: 'border-solid border-fintech-line',

  primaryButton: 'bg-fintech-mediumGreen',
  primaryButtonText: 'text-white',

  discountText: 'text-fintech-offerRed',
  savingsText: 'text-fintech-vividGreen',
  goldText: 'text-[#F59E0B]',
  goldBg: 'bg-[#FEF3C7]',

  tabBarBg: 'bg-white',
  tabBarActive: 'text-fintech-deepGreen',
  tabBarInactive: 'text-fintech-silver',
};

const ECONOMIA_VERDE_CLASSES: ThemeClasses = {
  bg: 'bg-[#F0FDFA]',
  surface: 'bg-white',
  headerBg: 'bg-[#0D9488]',
  headerText: 'text-white',
  discountBg: 'bg-[#FEF3C7]',

  textPrimary: 'text-[#1A1A2E]',
  textSecondary: 'text-[#475569]',
  textHint: 'text-[#94A3B8]',

  border: 'border-[#D1D5DB]',
  separator: 'border-solid border-[#D1D5DB]',

  primaryButton: 'bg-[#0D9488]',
  primaryButtonText: 'text-white',

  discountText: 'text-[#F59E0B]',
  savingsText: 'text-[#0D9488]',
  goldText: 'text-[#F59E0B]',
  goldBg: 'bg-[#FEF3C7]',

  tabBarBg: 'bg-white',
  tabBarActive: 'text-[#0D9488]',
  tabBarInactive: 'text-[#94A3B8]',
};

const ENCARTE_DIGITAL_CLASSES: ThemeClasses = {
  bg: 'bg-[#ECFDF5]',
  surface: 'bg-white',
  headerBg: 'bg-[#059669]',
  headerText: 'text-white',
  discountBg: 'bg-[#FEE2E2]',

  textPrimary: 'text-[#1E293B]',
  textSecondary: 'text-[#475569]',
  textHint: 'text-[#94A3B8]',

  border: 'border-[#D1D5DB]',
  separator: 'border-dashed border-[#D1D5DB]',

  primaryButton: 'bg-[#059669]',
  primaryButtonText: 'text-white',

  discountText: 'text-[#EF4444]',
  savingsText: 'text-[#059669]',
  goldText: 'text-[#9A6108]',
  goldBg: 'bg-[#F9EFD8]',

  tabBarBg: 'bg-white',
  tabBarActive: 'text-[#059669]',
  tabBarInactive: 'text-[#94A3B8]',
};

const FINTECH_MODERNA_CLASSES: ThemeClasses = {
  bg: 'bg-[#F0F9FF]',
  surface: 'bg-white',
  headerBg: 'bg-[#0891B2]',
  headerText: 'text-white',
  discountBg: 'bg-[#EDE9FE]',

  textPrimary: 'text-[#0F172A]',
  textSecondary: 'text-[#475569]',
  textHint: 'text-[#94A3B8]',

  border: 'border-[#D1D5DB]',
  separator: 'border-solid border-[#D1D5DB]',

  primaryButton: 'bg-[#0891B2]',
  primaryButtonText: 'text-white',

  discountText: 'text-[#8B5CF6]',
  savingsText: 'text-[#0891B2]',
  goldText: 'text-[#8B5CF6]',
  goldBg: 'bg-[#EDE9FE]',

  tabBarBg: 'bg-white',
  tabBarActive: 'text-[#0891B2]',
  tabBarInactive: 'text-[#94A3B8]',
};

const CLASS_MAP: Record<PaletteName, ThemeClasses> = {
  encarte: ENCARTE_CLASSES,
  fintech: FINTECH_CLASSES,
  economia_verde: ECONOMIA_VERDE_CLASSES,
  encarte_digital: ENCARTE_DIGITAL_CLASSES,
  fintech_moderna: FINTECH_MODERNA_CLASSES,
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Returns a `ThemeClasses` object that maps semantic UI keys to Tailwind class
 * strings for the currently active palette.
 *
 * Because NativeWind v4 cannot resolve CSS custom properties at runtime, this
 * hook bridges the gap by selecting the correct set of concrete Tailwind
 * classes for each palette so components can stay palette-agnostic:
 *
 * ```tsx
 * const tc = useThemeClasses();
 * <View className={tc.bg}>
 *   <Text className={tc.textPrimary}>Hello</Text>
 * </View>
 * ```
 */
export function useThemeClasses(): ThemeClasses {
  const { palette } = useTheme();

  return useMemo(() => CLASS_MAP[palette], [palette]);
}
