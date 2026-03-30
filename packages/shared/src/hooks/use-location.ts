import { useState, useEffect, useCallback } from 'react';
import * as Location from 'expo-location';

const LOCATION_STORAGE_KEY = 'poup:selected-city';

// Default: Matao, SP
const FALLBACK_LOCATION = {
  latitude: -21.6033,
  longitude: -48.3658,
  city: 'Matao',
  state: 'SP',
};

type CitySelection = {
  city: string;
  state: string;
};

type LocationStorage = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

const fallbackStorage: LocationStorage = {
  getItem: async () => null,
  setItem: async () => {},
  removeItem: async () => {},
};

const locationStorage: LocationStorage = (() => {
  try {
    // Keep tests and non-native runtimes from crashing on module initialization.
    const storage = require('@react-native-async-storage/async-storage').default as LocationStorage;
    return storage ?? fallbackStorage;
  } catch {
    return fallbackStorage;
  }
})();

function getCityStateFromGeocode(result: Location.LocationGeocodedAddress): CitySelection {
  const geocode = result as Location.LocationGeocodedAddress & { district?: string | null };
  const city = geocode.city ?? geocode.subregion ?? geocode.district ?? FALLBACK_LOCATION.city;
  const state = geocode.region ?? geocode.subregion ?? FALLBACK_LOCATION.state;

  return {
    city: city.trim(),
    state: state.trim().slice(0, 2).toUpperCase(),
  };
}

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
  const [location, setLocation] = useState({
    latitude: FALLBACK_LOCATION.latitude,
    longitude: FALLBACK_LOCATION.longitude,
  });
  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [detectedCity, setDetectedCity] = useState<CitySelection>({
    city: FALLBACK_LOCATION.city,
    state: FALLBACK_LOCATION.state,
  });
  const [selectedCity, setSelectedCity] = useState<CitySelection | null>(null);

  useEffect(() => {
    async function getLocation() {
      try {
        const storedSelection = await locationStorage.getItem(LOCATION_STORAGE_KEY);
        if (storedSelection) {
          const parsed = JSON.parse(storedSelection) as CitySelection;
          if (parsed?.city && parsed?.state) {
            setSelectedCity(parsed);
          }
        }

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

          const geocode = await Location.reverseGeocodeAsync({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          });

          if (geocode.length > 0) {
            setDetectedCity(getCityStateFromGeocode(geocode[0]));
          }
        }
      } catch {
        // Keep fallback location
      } finally {
        setIsLoading(false);
      }
    }

    getLocation();
  }, []);

  const setPreferredCity = useCallback(async (city: string, state: string) => {
    const next = {
      city: city.trim(),
      state: state.trim().toUpperCase(),
    };

    setSelectedCity(next);
    await locationStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(next));
  }, []);

  const clearPreferredCity = useCallback(async () => {
    setSelectedCity(null);
    await locationStorage.removeItem(LOCATION_STORAGE_KEY);
  }, []);

  const activeCity = selectedCity ?? detectedCity;

  return {
    latitude: location.latitude,
    longitude: location.longitude,
    city: activeCity.city,
    state: activeCity.state,
    locationLabel: `${activeCity.city}, ${activeCity.state}`,
    permissionGranted,
    isLoading,
    setPreferredCity,
    clearPreferredCity,
  };
}
