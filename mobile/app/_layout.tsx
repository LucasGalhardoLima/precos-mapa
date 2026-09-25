import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { useFonts } from 'expo-font';
import { Manrope_500Medium, Manrope_600SemiBold, Manrope_700Bold, Manrope_800ExtraBold } from '@expo-google-fonts/manrope';
import { ActivityIndicator, View } from 'react-native';
import { colors } from '../constants/tokens';
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
