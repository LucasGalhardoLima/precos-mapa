import { useEffect } from 'react';
import { Tabs, router } from 'expo-router';
import { useAuthStore } from '@precomapa/shared';
import { ThemeProvider } from '../../theme/provider';
import { FloatingTabBar } from '../../components/floating-tab-bar';
import { NativeTabLayout } from '../../components/native-tab-layout';
import { useThemeStore } from '../../theme/store';

export default function TabLayout() {
  const session = useAuthStore((s) => s.session);
  const tabStyle = useThemeStore((s) => s.tabStyle);

  useEffect(() => {
    if (session === null) {
      router.replace('/onboarding');
    }
  }, [session]);

  return (
    <ThemeProvider>
      {tabStyle === 'native' ? (
        <NativeTabLayout />
      ) : (
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
          <Tabs.Screen name="account" />

          {/* ---- Hidden (legacy) screens ---- */}
          <Tabs.Screen name="favorites" options={{ href: null }} />
          <Tabs.Screen name="alerts" options={{ href: null }} />
          <Tabs.Screen name="profile" options={{ href: null }} />
        </Tabs>
      )}
    </ThemeProvider>
  );
}
