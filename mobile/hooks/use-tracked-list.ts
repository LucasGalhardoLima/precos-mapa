import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { displayProductName, formatSize } from '@/lib/onboarding';
import { trackedItemName, insertAt, removeAt, trackedListStatus, type TrackedListStatus } from '@/lib/ajustes';

// Raw row as stored; kept whole so "desfazer" can put back exactly what was
// removed (same id, target price and created_at), not a lookalike.
interface TrackedRecord {
  id: string;
  user_id: string;
  product_id: string | null;
  category_label: string | null;
  category_size: string | null;
  target_price: number | null;
  created_at: string;
}

export interface TrackedListItem {
  id: string;
  productId: string | null; // null = generic item with no product pinned: nowhere to navigate
  name: string;
  record: TrackedRecord;
}

interface JoinedRow extends TrackedRecord {
  products: { name: string; size_value: number | null; size_unit: string | null } | null;
}

function toItem({ products, ...record }: JoinedRow): TrackedListItem {
  if (products) {
    const size = products.size_value != null && products.size_unit ? formatSize(products.size_value, products.size_unit) : null;
    return { id: record.id, productId: record.product_id, name: trackedItemName(displayProductName(products.name, size), size), record };
  }
  return { id: record.id, productId: null, name: trackedItemName(record.category_label ?? '', record.category_size), record };
}

// Ajustes' "itens acompanhados". Reads tracked_items for the CURRENT session
// only — it never calls signInAnonymously: opening Ajustes must not create a
// user. No session = nobody has tracked anything = a real empty list, whereas
// a failed read is reported as `error`, never as empty.
export function useTrackedList() {
  const [items, setItems] = useState<TrackedListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    setHasError(false);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        setItems([]);
        return;
      }
      const { data, error } = await supabase
        .from('tracked_items')
        .select('id, user_id, product_id, category_label, category_size, target_price, created_at, products(name, size_value, size_unit)')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: true });
      if (error) throw error;
      setItems(((data as unknown as JoinedRow[]) ?? []).map(toItem));
    } catch {
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Optimistic like the artifact ("remove na hora"); rolls back if the delete
  // fails. Returns the removed item and its slot for the undo bar.
  const remove = useCallback(
    async (id: string): Promise<{ item: TrackedListItem; index: number } | null> => {
      const index = items.findIndex((i) => i.id === id);
      if (index < 0) return null;
      const item = items[index]!;
      setItems((cur) => removeAt(cur, index));
      const { error } = await supabase.from('tracked_items').delete().eq('id', id);
      if (error) {
        setItems((cur) => insertAt(cur, item, index));
        return null;
      }
      return { item, index };
    },
    [items],
  );

  const restore = useCallback(async (item: TrackedListItem, index: number): Promise<boolean> => {
    const { error } = await supabase.from('tracked_items').insert(item.record);
    if (error) return false;
    setItems((cur) => insertAt(cur, item, index));
    return true;
  }, []);

  const status: TrackedListStatus = trackedListStatus(isLoading, hasError, items.length);
  return { items, status, remove, restore, retry: load };
}
