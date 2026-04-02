import { useEffect } from 'react';
import { Tabs, router } from 'expo-router';
import { useAuthStore } from '@poup/shared';
import { ThemeProvider } from '../../theme/provider';
import { FloatingTabBar } from '../../components/floating-tab-bar';

export default function TabLayout() {
  const session = useAuthStore((s) => s.session);

  useEffect(() => {
    if (session === null) {
      router.replace('/onboarding');
    }
  }, [session]);

  return (
    <ThemeProvider>
      <Tabs
        tabBar={(props) => <FloatingTabBar {...props} />}
        screenOptions={{
          headerShown: false,
        }}
      >
        {/* ---- Visible tabs ---- */}
        <Tabs.Screen name="index" />
        <Tabs.Screen name="search" />
        <Tabs.Screen name="map" />
        <Tabs.Screen name="list" />
        <Tabs.Screen name="alerts" />

        {/* ---- Hidden screens — kept to avoid breaking deep links ---- */}
        <Tabs.Screen name="account" options={{ href: null }} />
      </Tabs>
    </ThemeProvider>
  );
}
