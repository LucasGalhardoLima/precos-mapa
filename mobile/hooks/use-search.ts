import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';

interface SearchResult {
  id: string;
  name: string;
  similarity_score: number;
}

export function useSearch(query: string) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    if (!query || query.length < 2) {
      setSuggestions([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);

    const timer = setTimeout(async () => {
      try {
        if (query.length >= 3) {
          // Fuzzy search via pg_trgm + synonyms
          const { data } = await supabase.rpc('search_products', {
            query,
          });

          if (data) {
            const names = (data as SearchResult[]).map((r) => r.name);
            setSuggestions([...new Set(names)].slice(0, 5));
          }
        } else {
          // Short query: simple ilike search
          const { data } = await supabase
            .from('products')
            .select('name')
            .ilike('name', `%${query}%`)
            .limit(5);

          if (data) {
            setSuggestions(data.map((p) => p.name));
          }
        }
      } catch {
        setSuggestions([]);
      } finally {
        setIsSearching(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [query]);

  return {
    suggestions,
    isSearching,
  };
}
