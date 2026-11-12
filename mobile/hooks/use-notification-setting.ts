import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import { usePushNotifications } from './use-push-notifications';
import { resolveNotificationUi, toPermission, type NotificationUi, type SystemPermission } from '../lib/ajustes';

const STORAGE_KEY = 'poup:notifications-enabled';

// "Avisar quando um item baixar" (default on). The local key is what the
// switch renders; the server copy is notification_preferences.push_alerts
// (migration 029 — one row per profile, created by trigger, so anonymous
// users have it too), which notify-tracked-price reads before pushing.
// Mirrored instead of clearing profiles.push_token so turning it back on
// needs no new token and no permission round-trip.
//
// With a session, the server copy wins: the session survives an app reinstall
// (Keychain) but AsyncStorage doesn't, so a local-only read would show the
// switch on while the server still has push_alerts=false.
export async function readNotificationsEnabled(): Promise<boolean> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session) {
      const { data, error } = await supabase.from('notification_preferences').select('push_alerts').eq('user_id', session.user.id).maybeSingle();
      if (!error && data) {
        await AsyncStorage.setItem(STORAGE_KEY, String(data.push_alerts !== false)).catch(() => {});
        return data.push_alerts !== false;
      }
    }
  } catch {
    // offline / no row: fall back to the local copy
  }
  try {
    return (await AsyncStorage.getItem(STORAGE_KEY)) !== 'false';
  } catch {
    return true;
  }
}

// No session yet = nobody to mute server-side; use-tracked-items calls this
// right after the first anonymous sign-in so a switch turned off before then
// still holds. Throws on a failed write (supabase-js returns errors instead of
// throwing) so callers' .catch actually sees it.
export async function syncPushPreference(enabled: boolean): Promise<void> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return;
  const { error } = await supabase.from('notification_preferences').update({ push_alerts: enabled }).eq('user_id', session.user.id);
  if (error) throw error;
}

export function useNotificationSetting() {
  const [permission, setPermission] = useState<SystemPermission | null>(null); // null = ainda lendo
  const [enabled, setEnabled] = useState(true);
  const { requestPermission } = usePushNotifications({ autoRequest: false });

  const refresh = useCallback(async () => {
    const [perm, pref] = await Promise.all([Notifications.getPermissionsAsync(), readNotificationsEnabled()]);
    setPermission(toPermission(perm.status));
    setEnabled(pref);
  }, []);

  useEffect(() => {
    refresh().catch(() => {});
    // Coming back from the device's Settings app must unlock the switch.
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') refresh().catch(() => {});
    });
    return () => sub.remove();
  }, [refresh]);

  const ui: NotificationUi | null = permission ? resolveNotificationUi(permission, enabled) : null;

  // Returns the new state so the screen can emit the matching event.
  const toggle = useCallback(async (): Promise<'on' | 'off' | 'blocked' | null> => {
    if (!permission || permission === 'denied') return null;
    const turnOn = !(permission === 'granted' && enabled);
    if (turnOn && permission !== 'granted') {
      // The tap is the context for the system dialog (decisão 10).
      const granted = await requestPermission().catch(() => false);
      if (!granted) {
        await refresh();
        return 'blocked';
      }
    }
    setEnabled(turnOn);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, String(turnOn));
    } catch {
      // best-effort: the in-memory choice still applies for this session
    }
    await syncPushPreference(turnOn).catch((e) => console.warn('push_alerts sync failed', e));
    await refresh();
    return turnOn ? 'on' : 'off';
  }, [permission, enabled, requestPermission, refresh]);

  return { ui, toggle };
}
