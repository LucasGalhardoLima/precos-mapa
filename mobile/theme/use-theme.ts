import { useThemeStore } from './store';
import {
  ENCARTE_TOKENS,
  FINTECH_TOKENS,
  type PaletteTokens,
} from './palettes';

const TOKEN_MAP: Record<'encarte' | 'fintech', PaletteTokens> = {
  encarte: ENCARTE_TOKENS,
  fintech: FINTECH_TOKENS,
};

/**
 * Provides the active palette name, full token set, and a toggle function.
 *
 * All consumers re-render immediately on toggle thanks to the underlying
 * Zustand subscription.
 */
export function useTheme(): {
  palette: 'encarte' | 'fintech';
  tokens: PaletteTokens;
  togglePalette: () => void;
} {
  const palette = useThemeStore((s) => s.palette);
  const togglePalette = useThemeStore((s) => s.togglePalette);

  return {
    palette,
    tokens: TOKEN_MAP[palette],
    togglePalette,
  };
}
