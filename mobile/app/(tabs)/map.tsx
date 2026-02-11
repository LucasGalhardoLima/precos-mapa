import { useRef, useState, useCallback } from "react";
import { View, StyleSheet } from "react-native";
import MapView from "react-native-maps";
import BottomSheet from "@gorhom/bottom-sheet";
import { StoreMarker } from "@/components/store-marker";
import { StoreBottomSheet } from "@/components/store-bottom-sheet";
import { useStores } from "@/hooks/use-stores";
import { useLocation } from "@/hooks/use-location";
import type { StoreWithPromotions } from "@/types";

export default function MapScreen() {
  const { latitude, longitude } = useLocation();
  const { stores } = useStores({
    userLatitude: latitude,
    userLongitude: longitude,
  });

  const bottomSheetRef = useRef<BottomSheet>(null);
  const [selectedStore, setSelectedStore] =
    useState<StoreWithPromotions | null>(null);

  const handleMarkerPress = useCallback(
    (storeData: StoreWithPromotions) => {
      setSelectedStore(storeData);
      bottomSheetRef.current?.snapToIndex(0);
    },
    []
  );

  const handleCloseSheet = useCallback(() => {
    setSelectedStore(null);
  }, []);

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        initialRegion={{
          latitude,
          longitude,
          latitudeDelta: 1.2,
          longitudeDelta: 1.2,
        }}
        showsUserLocation
        showsMyLocationButton
      >
        {stores.map((storeData) => (
          <StoreMarker
            key={storeData.store.id}
            storeData={storeData}
            onPress={() => handleMarkerPress(storeData)}
          />
        ))}
      </MapView>

      <StoreBottomSheet
        ref={bottomSheetRef}
        storeData={selectedStore}
        onClose={handleCloseSheet}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
});
