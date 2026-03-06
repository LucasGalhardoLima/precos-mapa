import { useThemeStore, type TabName } from './store';
import { TOKENS, type PaletteTokens } from './palettes';

export function useTheme(): {
  tokens: PaletteTokens;
  tabIcons: Record<TabName, string>;
  setTabIcon: (tab: TabName, icon: string) => void;
} {
  const tabIcons = useThemeStore((s) => s.tabIcons);
  const setTabIcon = useThemeStore((s) => s.setTabIcon);

  return {
    tokens: TOKENS,
    tabIcons,
    setTabIcon,
  };
}
