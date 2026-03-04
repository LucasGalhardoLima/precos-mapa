import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface ThemeState {
  palette: 'encarte' | 'fintech';
  togglePalette: () => void;
  setPalette: (palette: 'encarte' | 'fintech') => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      palette: 'encarte',
      togglePalette: () =>
        set((s) => ({ palette: s.palette === 'encarte' ? 'fintech' : 'encarte' })),
      setPalette: (palette) => set({ palette }),
    }),
    {
      name: 'poup-theme',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
