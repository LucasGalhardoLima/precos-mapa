import { TOKENS, type PaletteTokens } from './palettes';

export function useTheme(): {
  tokens: PaletteTokens;
} {
  return {
    tokens: TOKENS,
  };
}
