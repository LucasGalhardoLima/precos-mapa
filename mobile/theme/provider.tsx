import React, { createContext, useContext } from 'react';

import type { PaletteTokens } from './palettes';
import { useTheme } from './use-theme';

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface ThemeContextValue {
  palette: 'encarte' | 'fintech';
  tokens: PaletteTokens;
  togglePalette: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

/**
 * Wraps the app root so any descendant can read palette tokens via
 * `useThemeContext()` instead of importing `useTheme()` directly.
 *
 * Under the hood it delegates to the Zustand-backed `useTheme()` hook,
 * so all consumers still benefit from fine-grained subscription updates.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const value = useTheme();

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Consumer hook
// ---------------------------------------------------------------------------

/**
 * Returns the current palette name, full token set, and toggle function.
 *
 * Must be called inside a `<ThemeProvider>` — throws otherwise.
 */
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
