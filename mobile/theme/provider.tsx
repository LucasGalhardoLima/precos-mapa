import React, { createContext, useContext } from 'react';
import type { PaletteTokens } from './palettes';
import { useTheme } from './use-theme';

interface ThemeContextValue {
  tokens: PaletteTokens;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { tokens } = useTheme();
  return (
    <ThemeContext.Provider value={{ tokens }}>{children}</ThemeContext.Provider>
  );
}

export function useThemeContext(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (ctx === null) {
    throw new Error(
      'useThemeContext must be used within a <ThemeProvider>. ' +
        'Wrap your app root with <ThemeProvider> to fix this.',
    );
  }
  return ctx;
}
