import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MapPin, Bell } from 'lucide-react-native';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { useAuthStore } from '@poup/shared';
import { useTheme } from '@/theme/use-theme';

export default function Onboarding() {
  const router = useRouter();
  const { tokens } = useTheme();
  const setHasSeenOnboarding = useAuthStore((s) => s.setHasSeenOnboarding);
  const [step, setStep] = useState<'location' | 'notification' | 'done'>('location');
  const [requesting, setRequesting] = useState(false);

  const requestLocation = async () => {
    setRequesting(true);
    await Location.requestForegroundPermissionsAsync();
    setRequesting(false);
    setStep('notification');
  };

  const requestNotification = async () => {
    setRequesting(true);
    await Notifications.requestPermissionsAsync();
    setRequesting(false);
    finish();
  };

  const finish = () => {
    setHasSeenOnboarding(true);
    router.replace('/(tabs)');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: tokens.bg }]}>
      <View style={styles.content}>
        {step === 'location' && (
          <>
            <View style={[styles.iconWrap, { backgroundColor: tokens.primaryMuted }]}>
              <MapPin size={48} color={tokens.primary} />
            </View>
            <Text style={[styles.title, { color: tokens.textPrimary }]}>Lojas perto de você</Text>
            <Text style={[styles.subtitle, { color: tokens.textSecondary }]}>
              Usamos sua localização para mostrar supermercados e ofertas na sua região.
            </Text>
            <Pressable
              style={[
                styles.button,
                { backgroundColor: tokens.primary },
                requesting && styles.buttonDisabled,
              ]}
              onPress={requestLocation}
              disabled={requesting}
            >
              <Text style={styles.buttonText}>
                {requesting ? 'Aguarde...' : 'Permitir localização'}
              </Text>
            </Pressable>
            <Pressable onPress={() => setStep('notification')}>
              <Text style={[styles.skip, { color: tokens.textMuted }]}>Agora não</Text>
            </Pressable>
          </>
        )}

        {step === 'notification' && (
          <>
            <View style={[styles.iconWrap, { backgroundColor: tokens.primaryMuted }]}>
              <Bell size={48} color={tokens.primary} />
            </View>
            <Text style={[styles.title, { color: tokens.textPrimary }]}>Alertas de oferta</Text>
            <Text style={[styles.subtitle, { color: tokens.textSecondary }]}>
              Receba notificações quando preços caírem nos produtos que você acompanha.
            </Text>
            <Pressable
              style={[
                styles.button,
                { backgroundColor: tokens.primary },
                requesting && styles.buttonDisabled,
              ]}
              onPress={requestNotification}
              disabled={requesting}
            >
              <Text style={styles.buttonText}>
                {requesting ? 'Aguarde...' : 'Permitir notificações'}
              </Text>
            </Pressable>
            <Pressable onPress={finish}>
              <Text style={[styles.skip, { color: tokens.textMuted }]}>Agora não</Text>
            </Pressable>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 16,
  },
  iconWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  title: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 26,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  button: {
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 32,
    width: '100%',
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 17,
    color: '#fff',
  },
  skip: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    marginTop: 4,
  },
});
