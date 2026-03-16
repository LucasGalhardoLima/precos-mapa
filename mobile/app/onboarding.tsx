import { useState, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Dimensions,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MotiView } from 'moti';
import { Store, MapPin, TrendingDown } from 'lucide-react-native';
import Svg, { Circle, Rect, Path, G, Defs, RadialGradient, Stop } from 'react-native-svg';
import { AuthButtons } from '@/components/auth-buttons';
import { StoreSetup } from '@/components/store-setup';
import { useAuthStore } from '@precomapa/shared';
import { useTheme } from '@/theme/use-theme';
import { supabase } from '@/lib/supabase';
import type { UserRole, Profile } from '@/types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CAROUSEL_PAGES = 1; // Single page for now; easily extendable

type Step = 'role-select' | 'auth' | 'store-setup';
type AuthMode = 'sign-up' | 'sign-in';

// ---------------------------------------------------------------------------
// Hero Illustration — Price tags on a stylized map
// ---------------------------------------------------------------------------

function HeroIllustration({ primaryColor }: { primaryColor: string }) {
  return (
    <Svg
      width={SCREEN_WIDTH * 0.7}
      height={SCREEN_WIDTH * 0.55}
      viewBox="0 0 280 220"
    >
      <Defs>
        <RadialGradient id="mapGlow" cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor={primaryColor} stopOpacity="0.25" />
          <Stop offset="100%" stopColor={primaryColor} stopOpacity="0" />
        </RadialGradient>
      </Defs>

      {/* Map grid lines */}
      <G opacity={0.15}>
        <Path d="M20,60 Q80,40 140,70 T260,50" stroke="#FFFFFF" strokeWidth="1" fill="none" />
        <Path d="M10,110 Q100,90 180,120 T270,100" stroke="#FFFFFF" strokeWidth="1" fill="none" />
        <Path d="M30,160 Q120,140 200,170 T260,150" stroke="#FFFFFF" strokeWidth="1" fill="none" />
        <Path d="M60,20 Q70,80 55,140 T70,210" stroke="#FFFFFF" strokeWidth="0.8" fill="none" />
        <Path d="M140,10 Q150,70 135,130 T150,200" stroke="#FFFFFF" strokeWidth="0.8" fill="none" />
        <Path d="M220,20 Q230,80 215,140 T230,210" stroke="#FFFFFF" strokeWidth="0.8" fill="none" />
      </G>

      {/* Subtle radial glow behind central tag */}
      <Circle cx="140" cy="110" r="70" fill="url(#mapGlow)" />

      {/* Location dots */}
      <Circle cx="70" cy="65" r="4" fill={primaryColor} opacity={0.6} />
      <Circle cx="200" cy="55" r="4" fill={primaryColor} opacity={0.6} />
      <Circle cx="100" cy="155" r="4" fill={primaryColor} opacity={0.6} />
      <Circle cx="210" cy="150" r="4" fill={primaryColor} opacity={0.6} />
      <Circle cx="140" cy="110" r="6" fill={primaryColor} />

      {/* Location rings */}
      <Circle cx="140" cy="110" r="14" stroke={primaryColor} strokeWidth="1.5" fill="none" opacity={0.4} />
      <Circle cx="140" cy="110" r="24" stroke={primaryColor} strokeWidth="1" fill="none" opacity={0.2} />

      {/* Price tag 1 — top left: R$3,49 */}
      <G>
        <Rect x="35" y="35" width="60" height="28" rx="6" fill="#FFFFFF" opacity={0.95} />
        <Circle cx="42" cy="49" r="3" fill={primaryColor} />
        <Path d="M95,49 L102,42 L102,56 Z" fill="#FFFFFF" opacity={0.95} />
      </G>

      {/* Price tag 2 — top right: R$2,99 */}
      <G>
        <Rect x="175" y="28" width="60" height="28" rx="6" fill="#FFFFFF" opacity={0.95} />
        <Circle cx="182" cy="42" r="3" fill="#C8392B" />
        <Path d="M235,42 L242,35 L242,49 Z" fill="#FFFFFF" opacity={0.95} />
      </G>

      {/* Price tag 3 — center: R$1,89 (highlighted, discount) */}
      <G>
        <Rect x="108" y="82" width="65" height="32" rx="7" fill={primaryColor} />
        <Circle cx="116" cy="98" r="3.5" fill="#FFFFFF" />
      </G>

      {/* Price tag 4 — bottom left */}
      <G>
        <Rect x="60" y="135" width="58" height="26" rx="6" fill="#FFFFFF" opacity={0.9} />
        <Circle cx="67" cy="148" r="3" fill={primaryColor} />
      </G>

      {/* Price tag 5 — bottom right */}
      <G>
        <Rect x="180" y="128" width="55" height="26" rx="6" fill="#FFFFFF" opacity={0.9} />
        <Circle cx="187" cy="141" r="3" fill="#C8392B" />
      </G>

      {/* Price text (approximate positions) */}
      {/* React Native SVG Text is used inline for price labels */}
    </Svg>
  );
}

// ---------------------------------------------------------------------------
// Pagination Dots
// ---------------------------------------------------------------------------

function PaginationDots({
  total,
  current,
  activeColor,
}: {
  total: number;
  current: number;
  activeColor: string;
}) {
  return (
    <View style={styles.dotsContainer}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.dot,
            i === current
              ? { backgroundColor: activeColor, width: 24 }
              : { backgroundColor: 'rgba(255,255,255,0.3)' },
          ]}
        />
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Value Proposition Row
// ---------------------------------------------------------------------------

function ValuePropRow({
  icon: Icon,
  label,
  delay,
  primaryColor,
}: {
  icon: typeof Store;
  label: string;
  delay: number;
  primaryColor: string;
}) {
  return (
    <MotiView
      from={{ opacity: 0, translateX: -20 }}
      animate={{ opacity: 1, translateX: 0 }}
      transition={{ type: 'spring', damping: 15, stiffness: 130, delay }}
      style={styles.valuePropRow}
    >
      <View style={[styles.valuePropIcon, { backgroundColor: primaryColor + '30' }]}>
        <Icon size={20} color={primaryColor} />
      </View>
      <Text style={styles.valuePropLabel}>{label}</Text>
    </MotiView>
  );
}

// ---------------------------------------------------------------------------
// Main Screen
// ---------------------------------------------------------------------------

export default function OnboardingScreen() {
  const router = useRouter();
  const { tokens } = useTheme();
  const setHasSeenOnboarding = useAuthStore((s) => s.setHasSeenOnboarding);
  const session = useAuthStore((s) => s.session);

  const [step, setStep] = useState<Step>('role-select');
  const [selectedRole, setSelectedRole] = useState<UserRole>('consumer');
  const [authMode, setAuthMode] = useState<AuthMode>('sign-up');

  // -----------------------------------------------------------------------
  // Auth success handler — preserves ALL existing logic
  // -----------------------------------------------------------------------
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

  // -----------------------------------------------------------------------
  // Store setup for business users
  // -----------------------------------------------------------------------
  const handleStoreSetupComplete = () => {
    router.replace('/(business)');
  };

  // -----------------------------------------------------------------------
  // Session redirect for returning users
  // -----------------------------------------------------------------------
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

  // -----------------------------------------------------------------------
  // CTA handlers
  // -----------------------------------------------------------------------
  const handleComecar = () => {
    setSelectedRole('consumer');
    setAuthMode('sign-up');
    setStep('auth');
  };

  const handleJaTenhoConta = () => {
    setSelectedRole('consumer');
    setAuthMode('sign-in');
    setStep('auth');
  };

  // Dev-only: skip auth and go straight to the app with a mock profile
  const handleDevLogin = (role: UserRole) => {
    const mockProfile = {
      id: 'dev-mock-user',
      role,
      display_name: `Dev ${role}`,
      avatar_url: null,
      city: 'Matão',
      state: 'SP',
      b2c_plan: 'free',
      search_radius_km: 10,
      rc_customer_id: null,
      push_token: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as Profile;
    useAuthStore.getState().setProfile(mockProfile);
    // Create a minimal fake session so the app doesn't redirect back
    useAuthStore.getState().setSession({ user: { id: 'dev-mock-user' } } as any);
    setHasSeenOnboarding(true);

    if (role === 'consumer') {
      router.replace('/(tabs)');
    } else {
      router.replace('/(business)');
    }
  };

  // -----------------------------------------------------------------------
  // Store setup step (full screen)
  // -----------------------------------------------------------------------
  if (step === 'store-setup') {
    return <StoreSetup onComplete={handleStoreSetupComplete} />;
  }

  // -----------------------------------------------------------------------
  // Dark background from theme tokens
  // -----------------------------------------------------------------------
  const darkBg = tokens.dark;
  const primaryColor = tokens.primary;

  // -----------------------------------------------------------------------
  // Auth step — themed overlay
  // -----------------------------------------------------------------------
  if (step === 'auth') {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: darkBg }]}>
        <ScrollView
          contentContainerStyle={styles.authScrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <MotiView
            from={{ opacity: 0, translateY: -10 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'spring', damping: 15, stiffness: 130 }}
            style={styles.authHeader}
          >
            <Text style={styles.authAppName}>POUP</Text>
            <Text style={styles.authSubtitle}>
              {authMode === 'sign-up'
                ? 'Crie sua conta para começar a economizar'
                : 'Entre na sua conta'}
            </Text>
          </MotiView>

          <MotiView
            from={{ opacity: 0, translateY: 15 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'spring', damping: 15, stiffness: 130, delay: 150 }}
            style={styles.authButtonsWrapper}
          >
            <AuthButtons onSuccess={handleAuthSuccess} />
          </MotiView>

          {/* Role switch for business users */}
          <MotiView
            from={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ type: 'spring', damping: 15, stiffness: 130, delay: 350 }}
            style={styles.authFooter}
          >
            {selectedRole === 'consumer' ? (
              <Pressable
                onPress={() => setSelectedRole('business')}
                hitSlop={12}
              >
                <Text style={styles.secondaryLink}>
                  Tenho um mercado
                </Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={() => setSelectedRole('consumer')}
                hitSlop={12}
              >
                <Text style={styles.secondaryLink}>
                  Sou consumidor
                </Text>
              </Pressable>
            )}

            <Pressable onPress={() => setStep('role-select')} hitSlop={12}>
              <Text style={styles.backLink}>Voltar</Text>
            </Pressable>
          </MotiView>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // -----------------------------------------------------------------------
  // Onboarding hero screen (role-select replacement)
  // -----------------------------------------------------------------------
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: darkBg }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Pagination dots */}
        <MotiView
          from={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ type: 'spring', damping: 15, stiffness: 130 }}
        >
          <PaginationDots
            total={CAROUSEL_PAGES}
            current={0}
            activeColor={primaryColor}
          />
        </MotiView>

        {/* Hero illustration */}
        <MotiView
          from={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', damping: 15, stiffness: 130, delay: 100 }}
          style={styles.heroContainer}
        >
          <HeroIllustration primaryColor={primaryColor} />
        </MotiView>

        {/* App name */}
        <MotiView
          from={{ opacity: 0, translateY: 10 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'spring', damping: 15, stiffness: 130, delay: 200 }}
          style={styles.titleContainer}
        >
          <Text style={styles.appName}>POUP</Text>
          <Text style={styles.tagline}>
            Descubra o mercado mais barato perto de você
          </Text>
        </MotiView>

        {/* Value propositions */}
        <View style={styles.valuePropsContainer}>
          <ValuePropRow
            icon={Store}
            label="Escolha seus mercados"
            delay={350}
            primaryColor={primaryColor}
          />
          <ValuePropRow
            icon={MapPin}
            label="Permita a localização"
            delay={500}
            primaryColor={primaryColor}
          />
          <ValuePropRow
            icon={TrendingDown}
            label="Comece a economizar"
            delay={650}
            primaryColor={primaryColor}
          />
        </View>

        {/* CTA */}
        <MotiView
          from={{ opacity: 0, translateY: 15 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'spring', damping: 15, stiffness: 130, delay: 750 }}
          style={styles.ctaContainer}
        >
          <Pressable
            onPress={handleComecar}
            style={[styles.ctaButton, { backgroundColor: primaryColor }]}
            android_ripple={{ color: 'rgba(255,255,255,0.2)' }}
          >
            <Text style={styles.ctaText}>Começar</Text>
          </Pressable>

          <Pressable onPress={handleJaTenhoConta} hitSlop={12}>
            <Text style={styles.signInLink}>Já tenho conta</Text>
          </Pressable>
        </MotiView>

        {/* Dev-only role toggle — skips auth entirely */}
        {__DEV__ && (
          <MotiView
            from={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ type: 'timing', duration: 300, delay: 900 }}
            style={styles.devToggleContainer}
          >
            <Text style={styles.devLabel}>DEV MODE</Text>
            <View style={styles.devButtonsRow}>
              <Pressable
                onPress={() => handleDevLogin('consumer')}
                style={[styles.devButton, { borderColor: primaryColor }]}
              >
                <Text style={[styles.devButtonText, { color: primaryColor }]}>
                  Consumer
                </Text>
              </Pressable>
              <Pressable
                onPress={() => handleDevLogin('business')}
                style={[styles.devButton, { borderColor: '#F59E0B' }]}
              >
                <Text style={[styles.devButtonText, { color: '#F59E0B' }]}>
                  Business
                </Text>
              </Pressable>
              <Pressable
                onPress={() => handleDevLogin('super_admin')}
                style={[styles.devButton, { borderColor: '#EF4444' }]}
              >
                <Text style={[styles.devButtonText, { color: '#EF4444' }]}>
                  Admin
                </Text>
              </Pressable>
            </View>
          </MotiView>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 40,
  },

  // Pagination dots
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  dot: {
    height: 6,
    width: 6,
    borderRadius: 3,
  },

  // Hero illustration
  heroContainer: {
    alignItems: 'center',
    marginTop: 16,
  },

  // Title
  titleContainer: {
    alignItems: 'center',
    marginTop: 24,
  },
  appName: {
    fontSize: 48,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 6,
  },
  tagline: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 22,
    paddingHorizontal: 16,
  },

  // Value propositions
  valuePropsContainer: {
    marginTop: 32,
    gap: 16,
  },
  valuePropRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  valuePropIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  valuePropLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
  },

  // CTA
  ctaContainer: {
    marginTop: 36,
    gap: 16,
    alignItems: 'center',
  },
  ctaButton: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  ctaText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  signInLink: {
    fontSize: 15,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.6)',
  },

  // Auth step
  authScrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 40,
    justifyContent: 'center',
  },
  authHeader: {
    alignItems: 'center',
    marginBottom: 32,
  },
  authAppName: {
    fontSize: 36,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 4,
  },
  authSubtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 22,
  },
  authButtonsWrapper: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    padding: 20,
  },
  authFooter: {
    alignItems: 'center',
    marginTop: 24,
    gap: 16,
  },
  secondaryLink: {
    fontSize: 15,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.6)',
  },
  backLink: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.4)',
  },

  // Dev toggle
  devToggleContainer: {
    marginTop: 32,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    gap: 10,
  },
  devLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.3)',
    letterSpacing: 2,
  },
  devButtonsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  devButton: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  devButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
