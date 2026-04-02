import '../global.css';
import { Stack, useRouter } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { PostHogProvider } from 'posthog-react-native';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import {
  Poppins_700Bold,
} from '@expo-google-fonts/poppins';
import {
  Inter_400Regular,
  Inter_500Medium,
} from '@expo-google-fonts/inter';
import { useAuth } from '@/hooks/use-auth';
import { useAuthStore, usePushNotifications } from '@poup/shared';
import type { NotificationData } from '@poup/shared';
import { posthogClient } from '@/lib/posthog';
import { initRevenueCat, loginRevenueCat, logoutRevenueCat } from '@/lib/revenue-cat';
import { useCallback, useEffect, useRef } from 'react';
import { ActivityIndicator, View } from 'react-native';

export default function RootLayout() {
  const { isLoading } = useAuth();
  const hasSeenOnboarding = useAuthStore((s) => s.hasSeenOnboarding);
  const router = useRouter();

  const handleNotificationTap = useCallback((data: NotificationData) => {
    if (data.productId) {
      router.push(`/product/${data.productId}`);
    }
  }, [router]);

  usePushNotifications({ onNotificationTap: handleNotificationTap });

  // RevenueCat: init on mount, login/logout on auth state changes
  const prevUserIdRef = useRef<string | null>(null);
  useEffect(() => {
    initRevenueCat();
    return useAuthStore.subscribe((state) => {
      const userId = state.session?.user?.id ?? null;
      if (userId === prevUserIdRef.current) return;
      prevUserIdRef.current = userId;
      if (userId) {
        loginRevenueCat(userId);
      } else {
        logoutRevenueCat();
      }
    });
  }, []);

  const [fontsLoaded] = useFonts({
    Poppins_700Bold,
    Inter_400Regular,
    Inter_500Medium,
  });

  if (isLoading || !fontsLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color="#22C55E" />
      </View>
    );
  }

  const content = (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <BottomSheetModalProvider>
          <StatusBar style="dark" />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="onboarding" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="(business)" />
            <Stack.Screen name="product/[id]" options={{ animation: 'default' }} />
            <Stack.Screen
              name="account"
              options={{
                headerShown: true,
                title: 'Conta',
                headerBackTitle: 'Voltar',
                headerTintColor: '#0D9488',
              }}
            />
          </Stack>
        </BottomSheetModalProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );

  if (posthogClient) {
    return (
      <PostHogProvider client={posthogClient} autocapture>
        {content}
      </PostHogProvider>
    );
  }

  return content;
}
