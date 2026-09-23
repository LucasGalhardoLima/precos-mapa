import { useState, useEffect, useRef, useCallback } from 'react';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/auth-store';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export interface NotificationData {
  promotionId?: string;
  productId?: string;
}

interface UsePushNotificationsOptions {
  onNotificationTap?: (data: NotificationData) => void;
  /**
   * When false, mounting the hook never shows the system permission dialog
   * — registration only proceeds once `requestPermission()` is called
   * imperatively. Mirrors useLocation's `autoRequest` (packages/shared/src/
   * hooks/use-location.ts). Default true keeps the original always-ask-on-
   * mount behavior for any caller that doesn't pass it. The MLP needs this:
   * "notificação no primeiro 'acompanhar'" (mobile/CLAUDE.md, decisão 10)
   * means the Resposta screen's acompanhar flow must pass `false` here and
   * call `requestPermission()` from the tap handler, not on screen mount.
   */
  autoRequest?: boolean;
}

// Exported for direct unit testing (no react-test-renderer in this repo to
// render the hook) — same convention as useLocation's readForegroundPermission.
export async function registerForPushToken(prompt: boolean): Promise<string | null> {
  if (!Device.isDevice) return null;

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted' && prompt) {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') return null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Ofertas',
      importance: Notifications.AndroidImportance.MAX,
    });
  }

  const tokenData = await Notifications.getExpoPushTokenAsync();
  return tokenData.data;
}

export function usePushNotifications(options?: UsePushNotificationsOptions) {
  const autoRequest = options?.autoRequest ?? true;
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [notification, setNotification] = useState<Notifications.Notification | null>(null);
  const notificationListener = useRef<Notifications.EventSubscription>(null);
  const responseListener = useRef<Notifications.EventSubscription>(null);
  const onTapRef = useRef(options?.onNotificationTap);
  const session = useAuthStore((s) => s.session);

  // Keep callback ref up to date without re-subscribing
  onTapRef.current = options?.onNotificationTap;

  const register = useCallback(
    async (prompt: boolean) => {
      const token = await registerForPushToken(prompt);
      if (token) {
        setExpoPushToken(token);
        if (session?.user?.id) {
          await supabase.from('profiles').update({ push_token: token }).eq('id', session.user.id);
        }
      }
      return token;
    },
    [session?.user?.id],
  );

  useEffect(() => {
    register(autoRequest);

    notificationListener.current =
      Notifications.addNotificationReceivedListener((n) => {
        setNotification(n);
      });

    responseListener.current =
      Notifications.addNotificationResponseReceivedListener((response) => {
        const data = response.notification.request.content.data as NotificationData | undefined;
        if (data && onTapRef.current) {
          onTapRef.current(data);
        }
      });

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id]);

  // Imperative re-request for autoRequest:false callers — takes no
  // arguments on purpose, same convention as useLocation's requestPermission
  // (legacy screens pass it straight to onPress, which would hand it a
  // press event otherwise).
  const requestPermission = useCallback(async () => {
    const token = await register(true);
    return token != null;
  }, [register]);

  return { expoPushToken, notification, requestPermission };
}
