import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { Category } from '@/types';

export function useCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      const { data } = await supabase
        .from('categories')
        .select('*')
        .order('sort_order');

      if (data) setCategories(data);
      setIsLoading(false);
    }

    fetch();
  }, []);

  return { categories, isLoading };
}
