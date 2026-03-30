import { useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@poup/shared';
import type { AnalyticsEventType } from '@poup/shared';

interface TrackOptions {
  storeId?: string;
  productId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Lightweight analytics hook for tracking user engagement events.
 * Events are fire-and-forget — failures are silently ignored to avoid
 * impacting user experience.
 */
export function useAnalytics() {
  const session = useAuthStore((s) => s.session);
  const userId = session?.user?.id;

  // Deduplicate rapid-fire events (e.g., search results appearing)
  const recentEvents = useRef<Set<string>>(new Set());

  const track = useCallback(
    (eventType: AnalyticsEventType, options: TrackOptions = {}) => {
      if (!userId) return;

      // Build a dedup key from event type + store + product
      const dedupKey = `${eventType}:${options.storeId ?? ''}:${options.productId ?? ''}`;

      // Skip if we already logged this exact event in the last 2 seconds
      if (recentEvents.current.has(dedupKey)) return;
      recentEvents.current.add(dedupKey);
      setTimeout(() => recentEvents.current.delete(dedupKey), 2000);

      supabase
        .from('analytics_events')
        .insert({
          event_type: eventType,
          user_id: userId,
          store_id: options.storeId ?? null,
          product_id: options.productId ?? null,
          metadata: options.metadata ?? {},
        })
        .then(() => {
          // fire-and-forget
        });
    },
    [userId],
  );

  const trackSearch = useCallback(
    (query: string, resultCount: number, storeIds: string[]) => {
      track('search_performed', {
        metadata: { query, result_count: resultCount, store_ids: storeIds },
      });
      // Track individual store impressions for B2B pitch
      for (const storeId of storeIds) {
        track('search_result_viewed', { storeId, metadata: { query } });
      }
    },
    [track],
  );

  const trackProductView = useCallback(
    (productId: string, storeIds: string[]) => {
      for (const storeId of storeIds) {
        track('product_detail_viewed', { storeId, productId });
      }
    },
    [track],
  );

  const trackListAdd = useCallback(
    (productId: string, storeId?: string) => {
      track('list_item_added', { productId, storeId });
    },
    [track],
  );

  const trackAlertCreated = useCallback(
    (productId: string, storeId?: string) => {
      track('alert_created', { productId, storeId });
    },
    [track],
  );

  const trackMapPinTap = useCallback(
    (storeId: string) => {
      track('map_pin_tapped', { storeId });
    },
    [track],
  );

  const trackScreen = useCallback(
    (screenName: string) => {
      track('screen_viewed', { metadata: { screen: screenName } });
    },
    [track],
  );

  return {
    track,
    trackSearch,
    trackProductView,
    trackListAdd,
    trackAlertCreated,
    trackMapPinTap,
    trackScreen,
  };
}
