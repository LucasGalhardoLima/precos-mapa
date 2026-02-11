import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { SortMode } from "@/types";

interface AppState {
  hasSeenOnboarding: boolean;
  isAuthenticated: boolean;
  selectedCategoryId: string | null;
  sortMode: SortMode;
  searchQuery: string;
  setHasSeenOnboarding: (value: boolean) => void;
  setIsAuthenticated: (value: boolean) => void;
  setSelectedCategoryId: (id: string | null) => void;
  setSortMode: (mode: SortMode) => void;
  setSearchQuery: (query: string) => void;
}

export const useAppStore = create<AppState>((set) => ({
  hasSeenOnboarding: false,
  isAuthenticated: false,
  selectedCategoryId: null,
  sortMode: "cheapest",
  searchQuery: "",
  setHasSeenOnboarding: (value) => {
    AsyncStorage.setItem("hasSeenOnboarding", JSON.stringify(value));
    set({ hasSeenOnboarding: value });
  },
  setIsAuthenticated: (value) => set({ isAuthenticated: value }),
  setSelectedCategoryId: (id) => set({ selectedCategoryId: id }),
  setSortMode: (mode) => set({ sortMode: mode }),
  setSearchQuery: (query) => set({ searchQuery: query }),
}));

// Hydrate persisted state on app start
AsyncStorage.getItem("hasSeenOnboarding").then((value) => {
  if (value !== null) {
    useAppStore.setState({ hasSeenOnboarding: JSON.parse(value) });
  }
});
