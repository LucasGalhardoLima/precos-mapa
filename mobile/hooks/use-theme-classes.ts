import { useMemo } from 'react';

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
  goldText: 'text-fintech-gold',
  goldBg: 'bg-fintech-lightGold',

  tabBarBg: 'bg-white',
  tabBarActive: 'text-fintech-deepGreen',
  tabBarInactive: 'text-fintech-silver',
};

const CLASS_MAP: Record<'encarte' | 'fintech', ThemeClasses> = {
  encarte: ENCARTE_CLASSES,
  fintech: FINTECH_CLASSES,
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
