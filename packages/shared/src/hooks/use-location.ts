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

/**
 * Reads the foreground location permission, showing the system dialog only
 * when `prompt` is true. `definitive` is false for a prompt-free read of
 * "undetermined": that means "never asked", not "denied", so callers must not
 * record it as a refusal. Exported for unit tests (no react-test-renderer in
 * this repo to render the hook).
 */
export async function readForegroundPermission(
  prompt: boolean
): Promise<{ granted: boolean; definitive: boolean }> {
  const { status } = prompt
    ? await Location.requestForegroundPermissionsAsync()
    : await Location.getForegroundPermissionsAsync();

  return {
    granted: status === 'granted',
    definitive: prompt || status !== 'undetermined',
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

type UseLocationOptions = {
  /**
   * When false, mounting the hook never shows the system permission dialog:
   * it only reads the permission status that already exists (and resolves the
   * device location if that status is already "granted"). `requestPermission()`
   * still prompts. Default true keeps the original behavior for every caller
   * that doesn't pass options. Needed by screens that must ask with context
   * first (the MLP onboarding) and by useAnalytics, which mounts this hook
   * on every screen just to read the region.
   */
  autoRequest?: boolean;
};

export function useLocation({ autoRequest = true }: UseLocationOptions = {}) {
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
  // True only once reverse geocoding actually succeeds — distinct from
  // `detectedCity` being *set*, since detectedCity starts at the hardcoded
  // fallback and permission-denied/failed-geocode users never move off it.
  // Consumers (e.g. analytics tracking) that must never persist the fallback
  // as if it were a real location need this signal, not detectedCity alone.
  const [deviceLocationResolved, setDeviceLocationResolved] = useState(false);

  // Shared by the initial mount effect and requestPermission() below — the
  // latter lets a screen re-prompt a user who skipped location during
  // onboarding, without duplicating the permission/geocode logic.
  const resolveDeviceLocation = useCallback(async (prompt: boolean) => {
    try {
      const { granted, definitive } = await readForegroundPermission(prompt);
      if (definitive) setPermissionGranted(granted);

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
          setDeviceLocationResolved(true);
        }
      }

      return granted;
    } catch {
      // Keep fallback location
      return false;
    }
  }, []);

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

        await resolveDeviceLocation(autoRequest);
      } finally {
        setIsLoading(false);
      }
    }

    getLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Takes no arguments on purpose: legacy screens pass it straight to onPress,
  // which would hand it a press event.
  const requestPermission = useCallback(async () => {
    return resolveDeviceLocation(true);
  }, [resolveDeviceLocation]);

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
  // A manually-chosen city is a genuine, intentional value regardless of GPS
  // permission; a device-detected city is genuine only once geocoding has
  // actually resolved it — otherwise activeCity is still the hardcoded
  // fallback wearing a "detected" label.
  const hasResolvedLocation = selectedCity !== null || deviceLocationResolved;

  return {
    latitude: location.latitude,
    longitude: location.longitude,
    city: activeCity.city,
    state: activeCity.state,
    locationLabel: `${activeCity.city}, ${activeCity.state}`,
    permissionGranted,
    isLoading,
    hasResolvedLocation,
    setPreferredCity,
    clearPreferredCity,
    requestPermission,
  };
}
