import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type TabName = 'index' | 'search' | 'map' | 'list' | 'account';

export const DEFAULT_TAB_ICONS: Record<TabName, string> = {
  index: 'house.fill',
  search: 'magnifyingglass',
  map: 'mappin',
  list: 'checklist',
  account: 'person.fill',
};

interface ThemeState {
  tabIcons: Record<TabName, string>;
  setTabIcon: (tab: TabName, icon: string) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      tabIcons: { ...DEFAULT_TAB_ICONS },
      setTabIcon: (tab, icon) =>
        set((state) => ({
          tabIcons: { ...state.tabIcons, [tab]: icon },
        })),
    }),
    {
      name: 'poup-theme',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
