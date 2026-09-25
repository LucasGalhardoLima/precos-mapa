import { useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useLocation, getAnonymousId } from '@poup/shared';
import { clearInheritedLoginOnce } from '../lib/inherited-session';
import type { AnalyticsEventType } from '@poup/shared';

interface TrackOptions {
  storeId?: string;
  productId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Never persist use-location's hardcoded fallback city as if it were a real,
 * permission-granted location — hasResolvedLocation is false until a manual
 * city choice or an actual successful geocode happens. Exported as a pure
 * function so this guard is unit-testable without rendering the hook.
 */
export function resolveTrackedRegion(hasResolvedLocation: boolean, locationLabel: string): string | null {
  return hasResolvedLocation ? locationLabel : null;
}

/**
 * Who an event belongs to, decided from the Supabase client's own session at
 * the moment of the insert. The RLS policies key off the JWT the request
 * carries, not off what the app believes: a client with a session (a login the
 * Keychain kept across reinstalls, or the anonymous sign-in "Acompanhar" makes)
 * runs as `authenticated`, and analytics_events_insert only accepts
 * user_id = auth.uid(). An "anonymous" row from such a client was refused, and
 * since the insert's error is not read, every event silently vanished.
 * Exported as a pure function so it is unit-testable without rendering the hook.
 */
export function resolveEventIdentity(
  sessionUserId: string | null | undefined,
  anonymousId: string | null,
): { user_id: string | null; anonymous_id: string | null } | null {
  if (sessionUserId) return { user_id: sessionUserId, anonymous_id: null };
  if (anonymousId) return { user_id: null, anonymous_id: anonymousId };
  return null;
}

/**
 * Lightweight analytics hook for tracking user engagement events.
 * Events are fire-and-forget — failures are silently ignored to avoid
 * impacting user experience.
 */
export function useAnalytics() {
  // autoRequest: false — this hook is mounted on every screen, including the
  // ones that must ask for location with context first (onboarding, decisão
  // 10). It still picks up a location the user already granted or chose.
  const { locationLabel, hasResolvedLocation } = useLocation({ autoRequest: false });

  // Deduplicate rapid-fire events (e.g., search results appearing)
  const recentEvents = useRef<Set<string>>(new Set());

  const track = useCallback(
    (eventType: AnalyticsEventType, options: TrackOptions = {}) => {
      const region = resolveTrackedRegion(hasResolvedLocation, locationLabel);

      (async () => {
        // Identity is read now, not from render-time state: callers such as
        // scan.tsx fire from effects that captured an earlier `track`, and the
        // auth store is never filled in this app (only the legacy screens did).
        await clearInheritedLoginOnce();
        const { data } = await supabase.auth.getSession();
        const anonymousId = data.session ? null : await getAnonymousId().catch(() => null);
        const identity = resolveEventIdentity(data.session?.user.id, anonymousId);
        if (!identity) {
          if (__DEV__) console.warn('[analytics] dropped, no identity:', eventType);
          return;
        }

        // Build a dedup key from event type + store + product
        const dedupKey = `${eventType}:${options.storeId ?? ''}:${options.productId ?? ''}`;

        // Skip if we already logged this exact event in the last 2 seconds
        if (recentEvents.current.has(dedupKey)) return;
        recentEvents.current.add(dedupKey);
        setTimeout(() => recentEvents.current.delete(dedupKey), 2000);

        const { error } = await supabase.from('analytics_events').insert({
          event_type: eventType,
          ...identity,
          store_id: options.storeId ?? null,
          product_id: options.productId ?? null,
          metadata: options.metadata ?? {},
          region,
        });
        // Never surfaced to the user, but not invisible in dev: a refused
        // insert (RLS) used to be swallowed and hid this for the whole rebuild.
        if (__DEV__ && error) console.warn('[analytics] insert refused:', eventType, error.message);
      })().catch((e) => {
        // fire-and-forget; visible in dev only
        if (__DEV__) console.warn('[analytics] track failed:', eventType, e);
      });
    },
    [locationLabel, hasResolvedLocation],
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
