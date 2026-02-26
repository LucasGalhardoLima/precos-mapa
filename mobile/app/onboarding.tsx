import { useState, useEffect } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MotiView } from 'moti';
import { MapPin } from 'lucide-react-native';
import { SocialProof } from '@/components/social-proof';
import { FeaturedDealsCarousel } from '@/components/featured-deals-carousel';
import { AuthButtons } from '@/components/auth-buttons';
import { StoreSetup } from '@/components/store-setup';
import { StyledButton } from '@/components/ui/button';
import { useAuthStore } from '@precomapa/shared';
import { supabase } from '@/lib/supabase';
import { Colors } from '@/constants/colors';
import type { UserRole, Profile } from '@/types';

type Step = 'role-select' | 'auth' | 'store-setup';

export default function OnboardingScreen() {
  const router = useRouter();
  const setHasSeenOnboarding = useAuthStore((s) => s.setHasSeenOnboarding);
  const session = useAuthStore((s) => s.session);

  const [step, setStep] = useState<Step>('role-select');
  const [selectedRole, setSelectedRole] = useState<UserRole>('consumer');

  const handleSelectRole = (role: UserRole) => {
    setSelectedRole(role);
    setStep('auth');
  };

  const handleAuthSuccess = async (userId: string) => {
    try {
      // Fetch fresh profile — store may not be populated yet due to race condition
      const { data: freshProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      // Sync profile to Zustand so downstream screens have it immediately
      if (freshProfile) {
        useAuthStore.getState().setProfile(freshProfile as Profile);
      }

      setHasSeenOnboarding(true);

      // Super admin: skip role update and store setup
      if (freshProfile?.role === 'super_admin') {
        router.replace('/(business)');
        return;
      }

      // Set role directly via Supabase (avoids stale session closure in useAuth.setRole)
      await supabase
        .from('profiles')
        .update({ role: selectedRole })
        .eq('id', userId);

      if (selectedRole === 'business') {
        setStep('store-setup');
      } else {
        router.replace('/(tabs)');
      }
    } catch (error) {
      console.warn('[handleAuthSuccess] failed:', error);
    }
  };

  const handleStoreSetupComplete = () => {
    router.replace('/(business)');
  };

  // If already authenticated (returning user tapped back), skip to correct route
  useEffect(() => {
    if (session && step === 'role-select') {
      const profile = useAuthStore.getState().profile;
      if (profile?.role === 'business' || profile?.role === 'super_admin') {
        router.replace('/(business)');
      } else if (profile?.role === 'consumer') {
        router.replace('/(tabs)');
      }
    }
  }, [session, step, router]);

  // Store setup step (full screen)
  if (step === 'store-setup') {
    return <StoreSetup onComplete={handleStoreSetupComplete} />;
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView
        className="flex-1"
        contentContainerClassName="pb-8"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <MotiView
          from={{ opacity: 0, translateY: -10 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 500 }}
          className="items-center pt-8 pb-4 px-6"
        >
          <View className="w-16 h-16 bg-brand-green rounded-2xl items-center justify-center mb-3">
            <Text className="text-3xl font-bold text-white">P</Text>
          </View>
          <Text className="text-3xl font-bold text-text-primary">
            PrecoMapa
          </Text>
          <Text className="text-base text-text-secondary mt-1 text-center">
            Compre com inteligencia. Economize com dados.
          </Text>
          <View className="flex-row items-center gap-1 mt-2">
            <MapPin size={14} color={Colors.brand.green} />
            <Text className="text-sm text-brand-green font-medium">
              Matao, SP
            </Text>
          </View>
        </MotiView>

        {/* Social Proof */}
        <View className="px-5 mt-4">
          <SocialProof />
        </View>

        {/* Featured Deals */}
        <View className="px-5 mt-6">
          <FeaturedDealsCarousel />
        </View>

        {/* CTAs / Auth */}
        <View className="px-5 mt-8">
          {step === 'role-select' && (
            <View className="gap-3">
              <StyledButton
                title="Sou Consumidor"
                variant="primary"
                onPress={() => handleSelectRole('consumer')}
              />
              <StyledButton
                title="Tenho um Mercado"
                variant="secondary"
                onPress={() => handleSelectRole('business')}
              />
            </View>
          )}

          {step === 'auth' && (
            <MotiView
              from={{ opacity: 0, translateY: 10 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: 'timing', duration: 300 }}
              className="gap-4"
            >
              <Text className="text-base font-semibold text-text-primary text-center">
                {selectedRole === 'consumer'
                  ? 'Entre para comecar a economizar'
                  : 'Entre para gerenciar sua loja'}
              </Text>
              <AuthButtons onSuccess={handleAuthSuccess} />
              <StyledButton
                title="Voltar"
                variant="ghost"
                onPress={() => setStep('role-select')}
              />
            </MotiView>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
