import { Redirect } from 'expo-router';
import { useAuthStore } from '@poup/shared';

export default function Index() {
  const hasSeenOnboarding = useAuthStore((s) => s.hasSeenOnboarding);

  if (!hasSeenOnboarding) {
    return <Redirect href="/onboarding" />;
  }

  return <Redirect href="/(tabs)" />;

  /* AUTH_STASHED
  const session = useAuthStore((s) => s.session);
  const profile = useAuthStore((s) => s.profile);

  if (!hasSeenOnboarding || !session) {
    return <Redirect href="/onboarding" />;
  }

  if (profile?.role === 'business' || profile?.role === 'super_admin') {
    return <Redirect href="/(business)" />;
  }

  return <Redirect href="/(tabs)" />;
  AUTH_STASHED */
}
