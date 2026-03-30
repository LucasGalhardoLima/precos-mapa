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
}

export function usePushNotifications(options?: UsePushNotificationsOptions) {
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [notification, setNotification] = useState<Notifications.Notification | null>(null);
  const notificationListener = useRef<Notifications.EventSubscription>(null);
  const responseListener = useRef<Notifications.EventSubscription>(null);
  const onTapRef = useRef(options?.onNotificationTap);
  const session = useAuthStore((s) => s.session);

  // Keep callback ref up to date without re-subscribing
  onTapRef.current = options?.onNotificationTap;

  useEffect(() => {
    registerForPushNotifications().then(async (token) => {
      if (token) {
        setExpoPushToken(token);
        if (session?.user?.id) {
          await supabase
            .from('profiles')
            .update({ push_token: token })
            .eq('id', session.user.id);
        }
      }
    });

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
  }, [session?.user?.id]);

  return { expoPushToken, notification };
}

async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) return null;

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
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
