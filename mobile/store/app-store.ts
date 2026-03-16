import { create } from 'zustand';
import type { SortMode } from '@poup/shared/types';

// Re-export auth store for convenience
export { useAuthStore } from '@poup/shared/store/auth-store';

interface FilterState {
  selectedCategoryId: string | null;
  sortMode: SortMode;
  searchQuery: string;

  setSelectedCategoryId: (id: string | null) => void;
  setSortMode: (mode: SortMode) => void;
  setSearchQuery: (query: string) => void;
}

export const useFilterStore = create<FilterState>((set) => ({
  selectedCategoryId: null,
  sortMode: 'cheapest',
  searchQuery: '',

  setSelectedCategoryId: (id) => set({ selectedCategoryId: id }),
  setSortMode: (mode) => set({ sortMode: mode }),
  setSearchQuery: (query) => set({ searchQuery: query }),
}));
