import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";

const LOCATION_CACHE_KEY = "device_location_cache_v1";
const LOCATION_CACHE_TTL_MS = 30 * 60 * 1000;

export type DeviceLocation = {
  latitude: number;
  longitude: number;
  label?: string;
};

type GetLocationOptions = {
  forceFresh?: boolean;
};

type CachedLocation = {
  latitude: number;
  longitude: number;
  label?: string;
  cachedAt: number;
};

function parseCached(raw: string | null): CachedLocation | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as CachedLocation;
    if (
      typeof parsed?.latitude === "number" &&
      typeof parsed?.longitude === "number" &&
      typeof parsed?.cachedAt === "number"
    ) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

async function getCachedLocation(): Promise<DeviceLocation | null> {
  const cached = parseCached(await AsyncStorage.getItem(LOCATION_CACHE_KEY));
  if (!cached) return null;

  if (Date.now() - cached.cachedAt > LOCATION_CACHE_TTL_MS) return null;

  return {
    latitude: cached.latitude,
    longitude: cached.longitude,
    label: cached.label,
  };
}

async function saveCachedLocation(location: DeviceLocation): Promise<void> {
  const payload: CachedLocation = {
    latitude: location.latitude,
    longitude: location.longitude,
    label: location.label,
    cachedAt: Date.now(),
  };

  await AsyncStorage.setItem(LOCATION_CACHE_KEY, JSON.stringify(payload));
}

async function resolveLabel(latitude: number, longitude: number): Promise<string | undefined> {
  try {
    const result = await Location.reverseGeocodeAsync({ latitude, longitude });
    const top = result?.[0];
    const city = top?.city || top?.district || top?.subregion;
    const country = top?.country;
    if (city && country) return `${city}, ${country}`;
    if (city) return city;
    if (country) return country;
    return undefined;
  } catch {
    return undefined;
  }
}

export async function resolveLocationLabelFromCoords(
  latitude: number,
  longitude: number
): Promise<string | undefined> {
  return resolveLabel(latitude, longitude);
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), timeoutMs);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch(() => {
        clearTimeout(timer);
        resolve(null);
      });
  });
}

export async function getBestDeviceLocation(options: GetLocationOptions = {}): Promise<DeviceLocation | null> {
  const cached = await getCachedLocation();
  const forceFresh = Boolean(options.forceFresh);

  const permission = await Location.getForegroundPermissionsAsync();
  let status = permission.status;

  if (status !== "granted") {
    const requested = await Location.requestForegroundPermissionsAsync();
    status = requested.status;
  }

  if (status !== "granted") {
    return cached;
  }

  const currentTimeoutMs = forceFresh ? 8000 : 5000;
  const current = await withTimeout(
    Location.getCurrentPositionAsync({
      accuracy: forceFresh ? Location.Accuracy.BestForNavigation : Location.Accuracy.Low,
    }),
    currentTimeoutMs
  );

  if ((current as any)?.coords) {
    const coords = (current as Location.LocationObject).coords;
    const location: DeviceLocation = {
      latitude: Number(coords.latitude.toFixed(6)),
      longitude: Number(coords.longitude.toFixed(6)),
    };

    location.label = await resolveLabel(location.latitude, location.longitude);
    await saveCachedLocation(location);
    return location;
  }

  if (forceFresh) {
    return null;
  }

  const lastKnown = await Location.getLastKnownPositionAsync({
    maxAge: 6 * 60 * 60 * 1000,
    requiredAccuracy: 5000,
  });

  if (lastKnown?.coords) {
    const location: DeviceLocation = {
      latitude: Number(lastKnown.coords.latitude.toFixed(6)),
      longitude: Number(lastKnown.coords.longitude.toFixed(6)),
    };

    location.label = await resolveLabel(location.latitude, location.longitude);
    await saveCachedLocation(location);
    return location;
  }

  return cached;
}
