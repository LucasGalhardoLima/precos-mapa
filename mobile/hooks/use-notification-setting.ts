import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { usePushNotifications } from './use-push-notifications';
import { resolveNotificationUi, toPermission, type NotificationUi, type SystemPermission } from '../lib/ajustes';

const STORAGE_KEY = 'poup:notifications-enabled';

// shortcut: "Avisar quando um item baixar" is only a LOCAL preference (default
// on). Nothing server-side reads it yet: notify-favorite-match still targets
// the legacy user_favorites table and profiles.push_token is never written in
// the MLP (the auth store is not filled). So OFF does not mute server pushes.
// Upgrade: when push for tracked_items ships, mirror this flag (or clear the
// token) server-side.
async function readEnabled(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(STORAGE_KEY)) !== 'false';
  } catch {
    return true;
  }
}

export function useNotificationSetting() {
  const [permission, setPermission] = useState<SystemPermission | null>(null); // null = ainda lendo
  const [enabled, setEnabled] = useState(true);
  const { requestPermission } = usePushNotifications({ autoRequest: false });

  const refresh = useCallback(async () => {
    const [perm, pref] = await Promise.all([Notifications.getPermissionsAsync(), readEnabled()]);
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
    await refresh();
    return turnOn ? 'on' : 'off';
  }, [permission, enabled, requestPermission, refresh]);

  return { ui, toggle };
}
