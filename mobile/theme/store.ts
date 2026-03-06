import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PaletteName } from './palettes';

interface ThemeState {
  palette: PaletteName;
  setPalette: (palette: PaletteName) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      palette: 'economia_verde',
      setPalette: (palette) => set({ palette }),
    }),
    {
      name: 'poup-theme',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
