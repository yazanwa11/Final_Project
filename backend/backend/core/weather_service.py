from __future__ import annotations

from dataclasses import dataclass
from datetime import timedelta
from typing import Optional, Dict, Any

import requests
from django.utils import timezone


@dataclass
class Coordinates:
    latitude: float
    longitude: float
    timezone: str


class WeatherAPIClient:
    GEOCODE_URL = "https://geocoding-api.open-meteo.com/v1/search"
    FORECAST_URL = "https://api.open-meteo.com/v1/forecast"

    @classmethod
    def geocode_location(cls, location_text: str) -> Optional[Coordinates]:
        if not location_text:
            return None

        response = requests.get(
            cls.GEOCODE_URL,
            params={"name": location_text, "count": 1, "language": "en", "format": "json"},
            timeout=10,
        )
        response.raise_for_status()
        payload = response.json()
        results = payload.get("results") or []
        if not results:
            return None

        top = results[0]
        return Coordinates(
            latitude=float(top["latitude"]),
            longitude=float(top["longitude"]),
            timezone=top.get("timezone") or "UTC",
        )

    @classmethod
    def fetch_forecast_summary(cls, latitude: float, longitude: float, timezone_name: str = "auto") -> Dict[str, Any]:
        response = requests.get(
            cls.FORECAST_URL,
            params={
                "latitude": latitude,
                "longitude": longitude,
                "timezone": timezone_name or "auto",
                "forecast_days": 3,
                "daily": "temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max",
            },
            timeout=10,
        )
        response.raise_for_status()
        payload = response.json()

        daily = payload.get("daily") or {}
        tmax = daily.get("temperature_2m_max") or []
        tmin = daily.get("temperature_2m_min") or []
        rain_mm = daily.get("precipitation_sum") or []
        rain_prob = daily.get("precipitation_probability_max") or []

        next24h_rain_mm_sum = float(rain_mm[0]) if len(rain_mm) >= 1 and rain_mm[0] is not None else 0.0
        next24h_rain_prob_max = float(rain_prob[0] or 0.0) / 100.0 if len(rain_prob) >= 1 else 0.0

        next48h_temp_max = max([float(v) for v in tmax[:2] if v is not None], default=0.0)
        next48h_temp_min = min([float(v) for v in tmin[:2] if v is not None], default=0.0)

        return {
            "provider": "open-meteo",
            "timezone": payload.get("timezone") or timezone_name or "UTC",
            "next24h_rain_prob_max": next24h_rain_prob_max,
            "next24h_rain_mm_sum": next24h_rain_mm_sum,
            "next48h_temp_max": next48h_temp_max,
            "next48h_temp_min": next48h_temp_min,
            "frost_risk": next48h_temp_min <= 2.0,
            "heatwave_risk": next48h_temp_max >= 35.0,
            "payload": payload,
            "forecast_at": timezone.now(),
            "expires_at": timezone.now() + timedelta(hours=6),
        }


def build_location_key(latitude: float, longitude: float) -> str:
    return f"{round(latitude, 2)}:{round(longitude, 2)}"
