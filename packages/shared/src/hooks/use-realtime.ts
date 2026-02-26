import { useEffect, useRef } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

type PostgresChangeEvent = 'INSERT' | 'UPDATE' | 'DELETE';

interface RealtimePayload<T = Record<string, unknown>> {
  eventType: PostgresChangeEvent;
  new: T;
  old: T;
}

interface UseRealtimeOptions {
  table: string;
  filter?: string;
  onInsert?: (record: Record<string, unknown>) => void;
  onUpdate?: (record: Record<string, unknown>, old: Record<string, unknown>) => void;
  onDelete?: (old: Record<string, unknown>) => void;
  enabled?: boolean;
}

export function useRealtime({
  table,
  filter,
  onInsert,
  onUpdate,
  onDelete,
  enabled = true,
}: UseRealtimeOptions) {
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const channelName = `realtime-${table}-${filter ?? 'all'}`;

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table,
          ...(filter ? { filter } : {}),
        },
        (payload: RealtimePayload) => {
          switch (payload.eventType) {
            case 'INSERT':
              onInsert?.(payload.new);
              break;
            case 'UPDATE':
              onUpdate?.(payload.new, payload.old);
              break;
            case 'DELETE':
              onDelete?.(payload.old);
              break;
          }
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [table, filter, enabled]);
}
