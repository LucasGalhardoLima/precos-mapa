import { View, Text, FlatList, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { SearchBar } from "@/components/search-bar";
import { FilterChips } from "@/components/filter-chips";
import { CategoryTabs } from "@/components/category-tabs";
import { DealCard } from "@/components/deal-card";
import { usePromotions } from "@/hooks/use-promotions";
import { useLocation } from "@/hooks/use-location";
import { useAppStore } from "@/store/app-store";
import { Colors } from "@/constants/colors";
import type { EnrichedPromotion } from "@/types";
import { ShoppingBag } from "lucide-react-native";

function SkeletonCard() {
  return (
    <View className="bg-surface-tertiary rounded-2xl p-4 gap-2">
      <View className="bg-border rounded-lg h-4 w-3/4" />
      <View className="bg-border rounded-lg h-3 w-1/2" />
      <View className="bg-border rounded-lg h-6 w-1/3 mt-2" />
      <View className="flex-row gap-2 mt-1">
        <View className="bg-border rounded-md h-5 w-12" />
        <View className="bg-border rounded-md h-5 w-16" />
      </View>
    </View>
  );
}

function EmptyState() {
  return (
    <View className="items-center justify-center py-16 px-8">
      <ShoppingBag size={48} color={Colors.text.tertiary} />
      <Text className="text-lg font-semibold text-text-primary mt-4">
        Nenhuma oferta encontrada
      </Text>
      <Text className="text-sm text-text-secondary text-center mt-2">
        Tente buscar por outro produto ou mude a categoria
      </Text>
    </View>
  );
}

export default function HomeScreen() {
  const { latitude, longitude } = useLocation();
  const searchQuery = useAppStore((s) => s.searchQuery);
  const sortMode = useAppStore((s) => s.sortMode);
  const selectedCategoryId = useAppStore((s) => s.selectedCategoryId);

  const { promotions, isLoading, isEmpty } = usePromotions({
    query: searchQuery || undefined,
    categoryId: selectedCategoryId ?? undefined,
    sortMode,
    userLatitude: latitude,
    userLongitude: longitude,
  });

  // Get nearest 5 deals for "Perto de voce" when not searching
  const { promotions: nearbyDeals } = usePromotions({
    sortMode: "nearest",
    userLatitude: latitude,
    userLongitude: longitude,
  });
  const nearbyTop5 = nearbyDeals.slice(0, 5);
  const showNearby = !searchQuery && !selectedCategoryId;

  const renderDeal = ({
    item,
    index,
  }: {
    item: EnrichedPromotion;
    index: number;
  }) => <DealCard deal={item} index={index} />;

  return (
    <SafeAreaView className="flex-1 bg-surface-secondary" edges={["top"]}>
      <View className="flex-1 px-4 pt-4">
        {/* Search */}
        <SearchBar />

        {/* Filters + Categories */}
        <View className="mt-3">
          <FilterChips />
        </View>
        <View className="mt-2">
          <CategoryTabs />
        </View>

        {/* Content */}
        {isLoading ? (
          <View className="gap-3 mt-4">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </View>
        ) : isEmpty ? (
          <EmptyState />
        ) : (
          <FlatList
            data={promotions}
            keyExtractor={(item) => item.id}
            renderItem={renderDeal}
            contentContainerClassName="gap-3 pb-4"
            className="mt-4"
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={
              showNearby && nearbyTop5.length > 0 ? (
                <View className="mb-4">
                  <Text className="text-lg font-semibold text-text-primary mb-3">
                    Perto de voce
                  </Text>
                  <View className="gap-3">
                    {nearbyTop5.map((deal, i) => (
                      <DealCard key={deal.id} deal={deal} index={i} />
                    ))}
                  </View>
                  <View className="h-px bg-border mt-4 mb-2" />
                  <Text className="text-lg font-semibold text-text-primary mt-2">
                    Todas as ofertas
                  </Text>
                </View>
              ) : null
            }
          />
        )}
      </View>
    </SafeAreaView>
  );
}
