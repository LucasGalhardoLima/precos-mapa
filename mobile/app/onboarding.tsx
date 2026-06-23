import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MapPin, Bell } from 'lucide-react-native';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { useAuthStore } from '@poup/shared';

export default function Onboarding() {
  const router = useRouter();
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
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {step === 'location' && (
          <>
            <View style={styles.iconWrap}>
              <MapPin size={48} color="#16a34a" />
            </View>
            <Text style={styles.title}>Lojas perto de você</Text>
            <Text style={styles.subtitle}>
              Usamos sua localização para mostrar supermercados e ofertas na sua região.
            </Text>
            <Pressable
              style={[styles.button, requesting && styles.buttonDisabled]}
              onPress={requestLocation}
              disabled={requesting}
            >
              <Text style={styles.buttonText}>
                {requesting ? 'Aguarde...' : 'Permitir localização'}
              </Text>
            </Pressable>
            <Pressable onPress={() => setStep('notification')}>
              <Text style={styles.skip}>Agora não</Text>
            </Pressable>
          </>
        )}

        {step === 'notification' && (
          <>
            <View style={styles.iconWrap}>
              <Bell size={48} color="#16a34a" />
            </View>
            <Text style={styles.title}>Alertas de oferta</Text>
            <Text style={styles.subtitle}>
              Receba notificações quando preços caírem nos produtos que você acompanha.
            </Text>
            <Pressable
              style={[styles.button, requesting && styles.buttonDisabled]}
              onPress={requestNotification}
              disabled={requesting}
            >
              <Text style={styles.buttonText}>
                {requesting ? 'Aguarde...' : 'Permitir notificações'}
              </Text>
            </Pressable>
            <Pressable onPress={finish}>
              <Text style={styles.skip}>Agora não</Text>
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
    backgroundColor: '#fff',
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
    backgroundColor: '#dcfce7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  title: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 26,
    color: '#111827',
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 24,
  },
  button: {
    backgroundColor: '#16a34a',
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
    color: '#9ca3af',
    marginTop: 4,
  },
});
