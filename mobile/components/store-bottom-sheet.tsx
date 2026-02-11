import { View, Text } from "react-native";
import BottomSheet, { BottomSheetView } from "@gorhom/bottom-sheet";
import { forwardRef, useMemo, useCallback } from "react";
import { MapPin, ShoppingBag } from "lucide-react-native";
import { DealCard } from "@/components/deal-card";
import { Colors } from "@/constants/colors";
import type { StoreWithPromotions } from "@/types";

interface StoreBottomSheetProps {
  storeData: StoreWithPromotions | null;
  onClose: () => void;
}

export const StoreBottomSheet = forwardRef<BottomSheet, StoreBottomSheetProps>(
  function StoreBottomSheet({ storeData, onClose }, ref) {
    const snapPoints = useMemo(() => ["40%", "85%"], []);

    const handleSheetChanges = useCallback(
      (index: number) => {
        if (index === -1) onClose();
      },
      [onClose]
    );

    if (!storeData) return null;

    const { store, activePromotionCount, topDeals, distanceKm } = storeData;

    return (
      <BottomSheet
        ref={ref}
        index={-1}
        snapPoints={snapPoints}
        onChange={handleSheetChanges}
        enablePanDownToClose
        backgroundStyle={{ borderRadius: 24 }}
        handleIndicatorStyle={{ backgroundColor: Colors.text.tertiary }}
      >
        <BottomSheetView className="flex-1 px-5 pb-6">
          {/* Store Header */}
          <View className="flex-row items-center gap-3 mb-4">
            <View
              className="w-12 h-12 rounded-full items-center justify-center"
              style={{ backgroundColor: store.logoColor }}
            >
              <Text className="text-white font-bold text-lg">
                {store.logoInitial}
              </Text>
            </View>
            <View className="flex-1">
              <Text className="text-lg font-bold text-text-primary">
                {store.name}
              </Text>
              <Text className="text-sm text-text-secondary">
                {store.address}
              </Text>
            </View>
          </View>

          {/* Info Row */}
          <View className="flex-row gap-4 mb-5">
            <View className="flex-row items-center gap-1">
              <MapPin size={14} color={Colors.brand.green} />
              <Text className="text-sm font-medium text-brand-green">
                {distanceKm} km de voce
              </Text>
            </View>
            <View className="flex-row items-center gap-1">
              <ShoppingBag size={14} color={Colors.text.secondary} />
              <Text className="text-sm text-text-secondary">
                {activePromotionCount} ofertas ativas
              </Text>
            </View>
          </View>

          {/* Top Deals */}
          <Text className="text-base font-semibold text-text-primary mb-3">
            Melhores ofertas
          </Text>
          <View className="gap-3">
            {topDeals.map((deal, i) => (
              <DealCard key={deal.id} deal={deal} index={i} compact />
            ))}
          </View>
        </BottomSheetView>
      </BottomSheet>
    );
  }
);
