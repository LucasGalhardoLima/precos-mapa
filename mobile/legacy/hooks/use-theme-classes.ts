export interface ThemeClasses {
  bg: string;
  surface: string;
  headerBg: string;
  headerText: string;
  discountBg: string;
  textPrimary: string;
  textSecondary: string;
  textHint: string;
  border: string;
  separator: string;
  primaryButton: string;
  primaryButtonText: string;
  discountText: string;
  savingsText: string;
  goldText: string;
  goldBg: string;
  tabBarBg: string;
  tabBarActive: string;
  tabBarInactive: string;
}

const THEME_CLASSES: ThemeClasses = {
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

export function useThemeClasses(): ThemeClasses {
  return THEME_CLASSES;
}
