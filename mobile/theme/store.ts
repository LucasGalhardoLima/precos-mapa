import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PaletteName } from './palettes';

export type TabStyle = 'glass-pill' | 'native';

interface ThemeState {
  palette: PaletteName;
  setPalette: (palette: PaletteName) => void;
  tabStyle: TabStyle;
  setTabStyle: (tabStyle: TabStyle) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      palette: 'economia_verde',
      setPalette: (palette) => set({ palette }),
      tabStyle: 'glass-pill',
      setTabStyle: (tabStyle) => set({ tabStyle }),
    }),
    {
      name: 'poup-theme',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
