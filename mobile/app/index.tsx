import { Redirect } from 'expo-router';
import { useAuthStore } from '@precomapa/shared';

export default function Index() {
  const hasSeenOnboarding = useAuthStore((s) => s.hasSeenOnboarding);
  const session = useAuthStore((s) => s.session);
  const profile = useAuthStore((s) => s.profile);

  // No session or first time → onboarding
  if (!hasSeenOnboarding || !session) {
    return <Redirect href="/onboarding" />;
  }

  // Business or super_admin role → business tabs
  if (profile?.role === 'business' || profile?.role === 'super_admin') {
    return <Redirect href="/(business)" />;
  }

  // Consumer role (default)
  return <Redirect href="/(tabs)" />;
}
