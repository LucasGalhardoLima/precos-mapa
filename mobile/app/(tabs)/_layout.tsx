import { useEffect } from 'react';
import { router } from 'expo-router';
import { useAuthStore } from '@poup/shared';
import { ThemeProvider } from '../../theme/provider';
import { NativeTabLayout } from '../../components/native-tab-layout';

export default function TabLayout() {
  const session = useAuthStore((s) => s.session);

  useEffect(() => {
    if (session === null) {
      router.replace('/onboarding');
    }
  }, [session]);

  return (
    <ThemeProvider>
      <NativeTabLayout />
    </ThemeProvider>
  );
}
