import { View, Text, FlatList } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Heart, MapPin } from "lucide-react-native";
import { products } from "@/data/products";
import { promotions } from "@/data/promotions";
import { stores } from "@/data/stores";
import { Colors } from "@/constants/colors";

// Static mockup: pick 5 products that have active promotions
const favoriteProducts = products.slice(0, 5).map((product) => {
  const bestPromo = promotions
    .filter((p) => p.productId === product.id && p.status === "active")
    .sort((a, b) => a.promoPrice - b.promoPrice)[0];
  const store = bestPromo ? stores.find((s) => s.id === bestPromo.storeId) : null;

  return {
    product,
    bestPrice: bestPromo?.promoPrice ?? null,
    storeName: store?.name ?? null,
  };
});

export default function FavoritesScreen() {
  return (
    <SafeAreaView className="flex-1 bg-surface-secondary" edges={["top"]}>
      <View className="px-4 pt-6 pb-3">
        <Text className="text-2xl font-bold text-text-primary">
          Seus Favoritos
        </Text>
        <Text className="text-sm text-text-secondary mt-1">
          Produtos que voce esta acompanhando
        </Text>
      </View>

      <FlatList
        data={favoriteProducts}
        keyExtractor={(item) => item.product.id}
        contentContainerClassName="gap-3 px-4 pb-4"
        renderItem={({ item }) => (
          <View className="bg-white rounded-2xl border border-border p-4 flex-row items-center">
            {/* Heart icon */}
            <Heart
              size={20}
              color={Colors.semantic.error}
              fill={Colors.semantic.error}
            />

            {/* Product info */}
            <View className="flex-1 ml-3">
              <Text className="text-base font-semibold text-text-primary">
                {item.product.name}
              </Text>
              {item.product.brand && (
                <Text className="text-xs text-text-tertiary">
                  {item.product.brand}
                </Text>
              )}
              {item.storeName && (
                <View className="flex-row items-center gap-1 mt-1">
                  <MapPin size={10} color={Colors.text.tertiary} />
                  <Text className="text-xs text-text-secondary">
                    {item.storeName}
                  </Text>
                </View>
              )}
            </View>

            {/* Price */}
            <View className="items-end">
              {item.bestPrice ? (
                <>
                  <Text className="text-lg font-bold text-brand-green">
                    R$ {item.bestPrice.toFixed(2)}
                  </Text>
                  <Text className="text-[10px] text-text-tertiary">
                    melhor preco
                  </Text>
                </>
              ) : (
                <Text className="text-sm text-text-tertiary">
                  Sem oferta
                </Text>
              )}
            </View>
          </View>
        )}
      />
    </SafeAreaView>
  );
}
