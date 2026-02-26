import { useState, useEffect } from 'react';
import * as Location from 'expo-location';

// Default: Matao, SP
const FALLBACK_LOCATION = {
  latitude: -21.6033,
  longitude: -48.3658,
};

export function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

export function useLocation() {
  const [location, setLocation] = useState(FALLBACK_LOCATION);
  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function getLocation() {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        const granted = status === 'granted';
        setPermissionGranted(granted);

        if (granted) {
          const pos = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          setLocation({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          });
        }
      } catch {
        // Keep fallback location
      } finally {
        setIsLoading(false);
      }
    }

    getLocation();
  }, []);

  return {
    latitude: location.latitude,
    longitude: location.longitude,
    permissionGranted,
    isLoading,
  };
}
