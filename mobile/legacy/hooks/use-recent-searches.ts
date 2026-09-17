import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@poup/recent-searches';
const MAX_SEARCHES = 10;

interface UseRecentSearches {
  recentSearches: string[];
  addSearch: (query: string) => void;
  clearSearches: () => void;
}

export function useRecentSearches(): UseRecentSearches {
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  // Load from AsyncStorage on mount
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored: string | null) => {
        if (stored) {
          const parsed = JSON.parse(stored) as string[];
          setRecentSearches(parsed);
        }
      })
      .catch(() => {
        // Silently ignore storage errors
      });
  }, []);

  const addSearch = useCallback((query: string) => {
    const trimmed = query.trim();
    if (!trimmed) return;

    setRecentSearches((prev) => {
      // Deduplicate: remove existing occurrence if present, then prepend
      const filtered = prev.filter(
        (s) => s.toLowerCase() !== trimmed.toLowerCase(),
      );
      const updated = [trimmed, ...filtered].slice(0, MAX_SEARCHES);

      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated)).catch(
        () => {},
      );

      return updated;
    });
  }, []);

  const clearSearches = useCallback(() => {
    setRecentSearches([]);
    AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
  }, []);

  return { recentSearches, addSearch, clearSearches };
}
