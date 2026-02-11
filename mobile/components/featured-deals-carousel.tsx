import { View, Text, FlatList } from "react-native";
import { MotiView } from "moti";
import { useFeaturedDeals } from "@/hooks/use-featured-deals";
import { Badge } from "@/components/ui/badge";
import type { EnrichedPromotion } from "@/types";

function CompactDealCard({
  deal,
  index,
}: {
  deal: EnrichedPromotion;
  index: number;
}) {
  return (
    <MotiView
      from={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "timing", duration: 350, delay: index * 80 }}
      className="bg-white rounded-2xl p-4 w-56 border border-border mr-3"
    >
      <Text className="text-sm font-semibold text-text-primary" numberOfLines={1}>
        {deal.product.name}
      </Text>
      <Text className="text-xs text-text-tertiary mt-0.5" numberOfLines={1}>
        {deal.store.name}
      </Text>
      <View className="flex-row items-center gap-2 mt-2">
        <Text className="text-lg font-bold text-brand-green">
          R$ {deal.promoPrice.toFixed(2)}
        </Text>
        <Badge variant="discount" label={`-${deal.discountPercent}%`} />
      </View>
    </MotiView>
  );
}

export function FeaturedDealsCarousel() {
  const { deals } = useFeaturedDeals();

  if (deals.length === 0) return null;

  return (
    <View className="gap-3">
      <Text className="text-base font-semibold text-text-primary px-1">
        Ofertas em destaque
      </Text>
      <FlatList
        data={deals}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => (
          <CompactDealCard deal={item} index={index} />
        )}
      />
    </View>
  );
}
