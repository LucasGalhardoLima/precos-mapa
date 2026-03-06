import { useThemeStore } from './store';
import type { TabStyle } from './store';
import {
  ENCARTE_TOKENS,
  FINTECH_TOKENS,
  ECONOMIA_VERDE_TOKENS,
  ENCARTE_DIGITAL_TOKENS,
  FINTECH_MODERNA_TOKENS,
  type PaletteName,
  type PaletteTokens,
} from './palettes';

const TOKEN_MAP: Record<PaletteName, PaletteTokens> = {
  encarte: ENCARTE_TOKENS,
  fintech: FINTECH_TOKENS,
  economia_verde: ECONOMIA_VERDE_TOKENS,
  encarte_digital: ENCARTE_DIGITAL_TOKENS,
  fintech_moderna: FINTECH_MODERNA_TOKENS,
};

export function useTheme(): {
  palette: PaletteName;
  tokens: PaletteTokens;
  setPalette: (palette: PaletteName) => void;
  tabStyle: TabStyle;
  setTabStyle: (tabStyle: TabStyle) => void;
} {
  const palette = useThemeStore((s) => s.palette);
  const setPalette = useThemeStore((s) => s.setPalette);
  const tabStyle = useThemeStore((s) => s.tabStyle);
  const setTabStyle = useThemeStore((s) => s.setTabStyle);

  return {
    palette,
    tokens: TOKEN_MAP[palette],
    setPalette,
    tabStyle,
    setTabStyle,
  };
}
