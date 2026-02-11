import { Redirect } from "expo-router";
import { useAppStore } from "@/store/app-store";

export default function Index() {
  const hasSeenOnboarding = useAppStore((s) => s.hasSeenOnboarding);
  const isAuthenticated = useAppStore((s) => s.isAuthenticated);

  if (!hasSeenOnboarding || !isAuthenticated) {
    return <Redirect href="/onboarding" />;
  }

  return <Redirect href="/(tabs)" />;
}
