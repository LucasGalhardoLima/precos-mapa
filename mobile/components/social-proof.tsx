import { View, Text, ScrollView } from "react-native";
import { MotiView } from "moti";
import { useSocialProof } from "@/hooks/use-social-proof";
import { Users, TrendingDown } from "lucide-react-native";
import { Colors } from "@/constants/colors";

export function SocialProof() {
  const { stats, testimonials } = useSocialProof();

  return (
    <View className="gap-5">
      {/* Stats Row */}
      <MotiView
        from={{ opacity: 0, translateY: 10 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: "timing", duration: 500 }}
        className="flex-row gap-4 justify-center"
      >
        <View className="bg-brand-green/10 rounded-2xl px-5 py-4 items-center flex-1">
          <Users size={24} color={Colors.brand.green} />
          <Text className="text-xl font-bold text-brand-green mt-1">
            {stats.userCount}
          </Text>
          <Text className="text-xs text-text-secondary mt-0.5">
            usuarios em {stats.cityName}
          </Text>
        </View>
        <View className="bg-brand-orange/10 rounded-2xl px-5 py-4 items-center flex-1">
          <TrendingDown size={24} color={Colors.brand.orange} />
          <Text className="text-xl font-bold text-brand-orange mt-1">
            {stats.avgMonthlySavings}
          </Text>
          <Text className="text-xs text-text-secondary mt-0.5">
            economia media/mes
          </Text>
        </View>
      </MotiView>

      {/* Testimonials */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="gap-3 px-1"
      >
        {testimonials.map((t, index) => (
          <MotiView
            key={t.id}
            from={{ opacity: 0, translateY: 15 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: "timing", duration: 400, delay: index * 100 }}
            className="bg-white rounded-2xl p-4 w-72 border border-border"
          >
            <Text className="text-sm text-text-secondary leading-5">
              "{t.text}"
            </Text>
            <View className="flex-row justify-between items-center mt-3">
              <Text className="text-sm font-semibold text-text-primary">
                {t.userName}
              </Text>
              <Text className="text-xs font-bold text-brand-green">
                Economizou R$ {t.savingsAmount}
              </Text>
            </View>
          </MotiView>
        ))}
      </ScrollView>
    </View>
  );
}
