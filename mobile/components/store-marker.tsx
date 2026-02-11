import { View, Text } from "react-native";
import { Marker } from "react-native-maps";
import type { StoreWithPromotions } from "@/types";

interface StoreMarkerProps {
  storeData: StoreWithPromotions;
  onPress: () => void;
}

export function StoreMarker({ storeData, onPress }: StoreMarkerProps) {
  const { store } = storeData;

  return (
    <Marker
      coordinate={{
        latitude: store.latitude,
        longitude: store.longitude,
      }}
      onPress={onPress}
      title={store.name}
    >
      <View className="items-center">
        <View
          className="w-10 h-10 rounded-full items-center justify-center border-2 border-white shadow-sm"
          style={{ backgroundColor: store.logoColor }}
        >
          <Text className="text-white font-bold text-base">
            {store.logoInitial}
          </Text>
        </View>
        <View className="bg-white rounded-md px-1.5 py-0.5 mt-0.5 shadow-sm">
          <Text className="text-[10px] font-semibold text-text-primary" numberOfLines={1}>
            {storeData.activePromotionCount} ofertas
          </Text>
        </View>
      </View>
    </Marker>
  );
}
