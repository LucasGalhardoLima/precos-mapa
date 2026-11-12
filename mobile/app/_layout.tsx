import { useEffect } from 'react';
import { Stack, useRouter, type ErrorBoundaryProps } from 'expo-router';
import { useFonts } from 'expo-font';
import { Manrope_500Medium, Manrope_600SemiBold, Manrope_700Bold, Manrope_800ExtraBold } from '@expo-google-fonts/manrope';
import { ActivityIndicator, View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fontFamily, typography, spacing } from '../constants/tokens';
import { FilledButton } from '../components/filled-button';
import { TextLink } from '../components/text-link';
import { clearInheritedLoginOnce } from '../lib/inherited-session';

export default function RootLayout() {
  // First launch of this build: drop a login inherited from the old app (see lib/inherited-session.ts).
  useEffect(() => {
    clearInheritedLoginOnce();
  }, []);

  const [fontsLoaded] = useFonts({
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
  });

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}

// Global error boundary (expo-router convention: a named `ErrorBoundary` export
// from the root layout catches any render error below it). Gray, like every
// other "absence" state: no red/amber (those are for blocking errors / stale
// stores). Two exits, neither a literal "voltar" beyond the button. No hooks
// beyond the router: whatever broke may be the data layer or analytics.
export function ErrorBoundary({ retry }: ErrorBoundaryProps) {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.body}>
        <Text style={styles.headline}>Algo deu errado</Text>
        <Text style={styles.support}>Não deu para mostrar esta tela. Comece de novo pelo início.</Text>
        <View style={styles.actions}>
          <FilledButton
            label="Voltar ao início ›"
            onPress={() => {
              // Navigate first, then clear the boundary so the new route (not
              // the one that crashed) is what re-renders.
              router.replace('/');
              retry();
            }}
          />
          <TextLink label="Tentar esta tela de novo" onPress={() => retry()} />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  body: { flex: 1, justifyContent: 'center', paddingHorizontal: spacing.xl },
  headline: {
    fontFamily: fontFamily.bold,
    fontSize: 22,
    lineHeight: 26,
    letterSpacing: -0.22,
    color: colors.secondary,
  },
  support: { ...typography.support, color: colors.secondary, marginTop: spacing.sm },
  actions: { gap: spacing.md - 2, marginTop: spacing.lg + 2 },
});
