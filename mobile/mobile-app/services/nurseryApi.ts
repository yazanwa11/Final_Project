import AsyncStorage from "@react-native-async-storage/async-storage";

const API_BASE = "http://10.0.2.2:8000/api";

export type NearbyNursery = {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  distance_km: number;
  phone_number?: string | null;
  rating?: number | null;
  user_ratings_total?: number | null;
  place_id: string;
  google_maps_url: string;
  navigation_url: string;
};

type NearbyNurseriesResponse = {
  latitude: number;
  longitude: number;
  keyword: string;
  count: number;
  results: NearbyNursery[];
};

async function fetchWithAuth(url: string, options: RequestInit = {}) {
  let access = await AsyncStorage.getItem("access");

  let response = await fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${access}`,
    },
  });

  if (response.status === 401) {
    const refresh = await AsyncStorage.getItem("refresh");
    if (refresh) {
      const refreshResponse = await fetch(`${API_BASE}/users/refresh/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh }),
      });

      if (refreshResponse.ok) {
        const tokens = await refreshResponse.json();
        await AsyncStorage.setItem("access", tokens.access);
        access = tokens.access;

        response = await fetch(url, {
          ...options,
          headers: {
            ...(options.headers || {}),
            Authorization: `Bearer ${access}`,
          },
        });
      }
    }
  }

  return response;
}

export async function listNearbyNurseries(params: {
  latitude: number;
  longitude: number;
  keyword?: string;
  limit?: number;
}): Promise<NearbyNurseriesResponse> {
  const query = new URLSearchParams({
    latitude: String(params.latitude),
    longitude: String(params.longitude),
    keyword: params.keyword?.trim() || "משתלה",
    limit: String(params.limit ?? 12),
  });

  const response = await fetchWithAuth(`${API_BASE}/places/nurseries/?${query.toString()}`, {
    headers: { Accept: "application/json" },
  });

  const raw = await response.text();
  if (!response.ok) {
    throw new Error(raw || "Failed to load nearby nurseries");
  }

  return JSON.parse(raw);
}
