from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

import requests
from django.conf import settings


@dataclass
class NearbyNursery:
    name: str
    address: str
    latitude: float
    longitude: float
    distance_km: float
    phone_number: Optional[str]
    rating: Optional[float]
    user_ratings_total: Optional[int]
    place_id: str
    google_maps_url: str
    navigation_url: str


class GooglePlacesClient:
    NEARBY_SEARCH_URL = "https://maps.googleapis.com/maps/api/place/nearbysearch/json"
    PLACE_DETAILS_URL = "https://maps.googleapis.com/maps/api/place/details/json"

    @staticmethod
    def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        radius_km = 6371.0
        lat1_rad = math.radians(lat1)
        lat2_rad = math.radians(lat2)
        delta_lat = math.radians(lat2 - lat1)
        delta_lon = math.radians(lon2 - lon1)

        sin_lat = math.sin(delta_lat / 2)
        sin_lon = math.sin(delta_lon / 2)
        a = sin_lat * sin_lat + math.cos(lat1_rad) * math.cos(lat2_rad) * sin_lon * sin_lon
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        return radius_km * c

    @staticmethod
    def _api_key() -> str:
        key = getattr(settings, "GOOGLE_MAPS_API_KEY", "") or ""
        if not key:
            raise ValueError("Google Maps API key is missing. Set GOOGLE_MAPS_API_KEY in backend .env")
        return key

    @classmethod
    def _fetch_phone_by_place_id(cls, place_id: str, api_key: str) -> Optional[str]:
        response = requests.get(
            cls.PLACE_DETAILS_URL,
            params={
                "place_id": place_id,
                "fields": "formatted_phone_number,international_phone_number",
                "key": api_key,
            },
            timeout=10,
        )
        response.raise_for_status()

        payload = response.json()
        status = payload.get("status")
        if status not in {"OK", "ZERO_RESULTS"}:
            return None

        result = payload.get("result") or {}
        return result.get("international_phone_number") or result.get("formatted_phone_number")

    @classmethod
    def list_nearby_nurseries(
        cls,
        *,
        user_latitude: float,
        user_longitude: float,
        keyword: str = "משתלה",
        limit: int = 12,
    ) -> List[Dict[str, Any]]:
        api_key = cls._api_key()
        safe_limit = max(1, min(int(limit or 12), 20))
        normalized_keyword = (keyword or "משתלה").strip() or "משתלה"

        search_response = requests.get(
            cls.NEARBY_SEARCH_URL,
            params={
                "location": f"{user_latitude},{user_longitude}",
                "rankby": "distance",
                "type": "florist",
                "keyword": normalized_keyword,
                "language": "he",
                "key": api_key,
            },
            timeout=12,
        )
        search_response.raise_for_status()

        payload = search_response.json()
        status = payload.get("status")
        if status not in {"OK", "ZERO_RESULTS"}:
            error_message = payload.get("error_message")
            raise ValueError(error_message or f"Google Places error: {status}")

        places = payload.get("results") or []
        normalized_items: List[NearbyNursery] = []

        for place in places[:safe_limit]:
            geometry = place.get("geometry") or {}
            location = geometry.get("location") or {}
            place_lat = location.get("lat")
            place_lng = location.get("lng")
            place_id = place.get("place_id")
            if place_lat is None or place_lng is None or not place_id:
                continue

            distance_km = cls._haversine_km(
                float(user_latitude),
                float(user_longitude),
                float(place_lat),
                float(place_lng),
            )

            phone_number = None
            try:
                phone_number = cls._fetch_phone_by_place_id(str(place_id), api_key)
            except Exception:
                phone_number = None

            name = str(place.get("name") or "Nursery")
            address = str(place.get("vicinity") or place.get("formatted_address") or "")
            map_url = f"https://www.google.com/maps/place/?q=place_id:{place_id}"
            nav_url = (
                "https://www.google.com/maps/dir/?api=1"
                f"&destination={place_lat},{place_lng}"
                f"&destination_place_id={place_id}"
            )

            normalized_items.append(
                NearbyNursery(
                    name=name,
                    address=address,
                    latitude=float(place_lat),
                    longitude=float(place_lng),
                    distance_km=round(distance_km, 2),
                    phone_number=phone_number,
                    rating=float(place["rating"]) if place.get("rating") is not None else None,
                    user_ratings_total=int(place["user_ratings_total"])
                    if place.get("user_ratings_total") is not None
                    else None,
                    place_id=str(place_id),
                    google_maps_url=map_url,
                    navigation_url=nav_url,
                )
            )

        normalized_items.sort(key=lambda item: item.distance_km)
        return [
            {
                "name": item.name,
                "address": item.address,
                "latitude": item.latitude,
                "longitude": item.longitude,
                "distance_km": item.distance_km,
                "phone_number": item.phone_number,
                "rating": item.rating,
                "user_ratings_total": item.user_ratings_total,
                "place_id": item.place_id,
                "google_maps_url": item.google_maps_url,
                "navigation_url": item.navigation_url,
            }
            for item in normalized_items
        ]
