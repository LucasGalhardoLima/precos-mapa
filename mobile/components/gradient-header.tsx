import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '@poup/shared';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Bom dia';
  if (hour < 18) return 'Boa tarde';
  return 'Boa noite';
}

// ---------------------------------------------------------------------------
// GradientHeader
// ---------------------------------------------------------------------------

export function GradientHeader() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const profile = useAuthStore((s) => s.profile);

  const firstName = profile?.full_name?.split(' ')[0] ?? 'Usuário';
  const initial = firstName.charAt(0).toUpperCase();
  const greeting = getGreeting();

  return (
    <LinearGradient
      colors={['#115E59', '#0D9488', '#14B8A6']}
      locations={[0, 0.5, 1]}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={[styles.gradient, { paddingTop: insets.top + 16 }]}
    >
      <View style={styles.row}>
        {/* Left: greeting + subtitle */}
        <View style={styles.textContainer}>
          <Text style={styles.greeting}>
            {greeting}, {firstName}
          </Text>
          <Text style={styles.subtitle}>
            Veja as melhores ofertas perto de você
          </Text>
        </View>

        {/* Right: avatar */}
        <Pressable
          onPress={() => router.push('/account')}
          accessibilityLabel="Ir para minha conta"
          accessibilityRole="button"
          style={styles.avatar}
        >
          <Text style={styles.avatarText}>{initial}</Text>
        </Pressable>
      </View>
    </LinearGradient>
  );
}

export default GradientHeader;

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  gradient: {
    paddingHorizontal: 20,
    paddingBottom: 22,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  textContainer: {
    flex: 1,
    marginRight: 12,
  },
  greeting: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  subtitle: {
    marginTop: 2,
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
