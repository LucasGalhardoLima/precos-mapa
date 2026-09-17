import { Tabs } from 'expo-router';
import { ThemeProvider } from '../../theme/provider';
import { FloatingTabBar } from '../../components/floating-tab-bar';

/* AUTH_STASHED
import { useEffect } from 'react';
import { router } from 'expo-router';
import { useAuthStore } from '@poup/shared';

// Session guard — redirect to onboarding when logged out
// const session = useAuthStore((s) => s.session);
// useEffect(() => { if (session === null) router.replace('/onboarding'); }, [session]);
AUTH_STASHED */

export default function TabLayout() {
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
