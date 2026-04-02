import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

type CityOption = {
  city: string;
  state: string;
};

export function useCities() {
  const [cities, setCities] = useState<CityOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      const { data } = await supabase
        .from('stores')
        .select('city, state')
        .eq('is_active', true);

      if (data) {
        const seen = new Set<string>();
        const unique: CityOption[] = [];
        for (const row of data) {
          const key = `${row.city}|${row.state}`;
          if (!seen.has(key)) {
            seen.add(key);
            unique.push({ city: row.city, state: row.state });
          }
        }
        unique.sort((a, b) => a.city.localeCompare(b.city, 'pt-BR'));
        setCities(unique);
      }
      setIsLoading(false);
    }

    fetch();
  }, []);

  return { cities, isLoading };
}
