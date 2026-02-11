import { View, Text, ScrollView, Alert } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { MotiView } from "moti";
import { MapPin } from "lucide-react-native";
import { SocialProof } from "@/components/social-proof";
import { FeaturedDealsCarousel } from "@/components/featured-deals-carousel";
import { StyledButton } from "@/components/ui/button";
import { useAppStore } from "@/store/app-store";
import { Colors } from "@/constants/colors";

export default function OnboardingScreen() {
  const router = useRouter();
  const setHasSeenOnboarding = useAppStore((s) => s.setHasSeenOnboarding);
  const setIsAuthenticated = useAppStore((s) => s.setIsAuthenticated);

  const handleConsumer = () => {
    setHasSeenOnboarding(true);
    setIsAuthenticated(true);
    router.replace("/(tabs)");
  };

  const handleAdmin = () => {
    Alert.alert(
      "Painel Admin",
      "O painel administrativo esta disponivel na versao web. Acesse pelo navegador.",
      [{ text: "OK" }]
    );
  };

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
          transition={{ type: "timing", duration: 500 }}
          className="items-center pt-8 pb-4 px-6"
        >
          <View className="w-16 h-16 bg-brand-green rounded-2xl items-center justify-center mb-3">
            <Text className="text-3xl font-bold text-white">P</Text>
          </View>
          <Text className="text-3xl font-bold text-text-primary">
            PrecoMapa
          </Text>
          <Text className="text-base text-text-secondary mt-1 text-center">
            Compare precos e economize no supermercado
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

        {/* CTAs */}
        <View className="px-5 mt-8 gap-3">
          <StyledButton
            title="Sou Consumidor"
            variant="primary"
            onPress={handleConsumer}
          />
          <StyledButton
            title="Tenho um Mercado"
            variant="secondary"
            onPress={handleAdmin}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
