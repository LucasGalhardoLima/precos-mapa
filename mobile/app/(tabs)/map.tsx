import { useRef, useState, useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import MapView from 'react-native-maps';
import BottomSheet from '@gorhom/bottom-sheet';
import { MapPin } from 'lucide-react-native';
import { StoreMarker } from '@/components/store-marker';
import { StoreBottomSheet } from '@/components/store-bottom-sheet';
import { useStores } from '@/hooks/use-stores';
import { useLocation } from '@/hooks/use-location';
import { Colors } from '@/constants/colors';
import type { StoreWithPromotions } from '@/types';

export default function MapScreen() {
  const { latitude, longitude, permissionGranted } = useLocation();
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
      {/* Location denied banner */}
      {permissionGranted === false && (
        <View className="absolute top-12 left-4 right-4 z-10 bg-white rounded-xl p-4 shadow-sm border border-border">
          <View className="flex-row items-center gap-2">
            <MapPin size={18} color={Colors.semantic.warning} />
            <Text className="text-sm text-text-secondary flex-1">
              Permita acesso a localizacao para ver lojas perto de voce
            </Text>
          </View>
        </View>
      )}

      <MapView
        style={styles.map}
        initialRegion={{
          latitude,
          longitude,
          latitudeDelta: 1.2,
          longitudeDelta: 1.2,
        }}
        showsUserLocation={permissionGranted === true}
        showsMyLocationButton={permissionGranted === true}
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
