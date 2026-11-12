import { useEffect } from 'react';
import { useRouter, type Href } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { supabase } from '@/lib/supabase';
import { routeForNotification } from '@/lib/notification-route';

// getLastNotificationResponseAsync keeps returning the same response for the
// whole process, and Raiz can remount (back from onboarding) — remember what was
// already handled so a tap opens the Resposta once, not on every remount.
const handled = new Set<string>();

async function productExists(id: string): Promise<boolean> {
  const { data, error } = await supabase.from('products').select('id').eq('id', id).maybeSingle();
  return !error && data != null;
}

// Tap on a push → Resposta of that item. `ready` is Raiz's onboarding guard: we
// only navigate once it has resolved to "done", so a cold start from a tap
// never skips onboarding and the Resposta is pushed on top of Raiz (back
// returns to Raiz).
export function useNotificationTap(ready: boolean) {
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;

    const handle = async (response: Notifications.NotificationResponse | null) => {
      if (!response) return;
      const key = response.notification.request.identifier;
      if (handled.has(key)) return;
      handled.add(key);
      const route = await routeForNotification(response.notification.request.content.data, productExists);
      if (route && !cancelled) router.push(route as Href);
    };

    // Cold start: the tap that launched the app.
    Notifications.getLastNotificationResponseAsync()
      .then(handle)
      .catch(() => {});
    // Warm: taps while the app is running or in background.
    const sub = Notifications.addNotificationResponseReceivedListener((r) => {
      handle(r).catch(() => {});
    });

    return () => {
      cancelled = true;
      sub.remove();
    };
  }, [ready, router]);
}
