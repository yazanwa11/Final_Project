from __future__ import annotations

from celery import shared_task
from django.utils import timezone

from .models import Plant, WeatherSnapshot
from .models import AssistantExpertTip, ExpertPost
from .smart_reminders import apply_weather_to_plant_reminders, dispatch_unsent_smart_events
from .weather_service import WeatherAPIClient, build_location_key
from .health_scoring import compute_and_store_plant_health


@shared_task(bind=True, autoretry_for=(Exception,), retry_backoff=True, max_retries=3)
def sync_weather_snapshot_for_plant(self, plant_id: int):
    plant = Plant.objects.get(id=plant_id)

    if not plant.weather_opt_in:
        return {"status": "skipped", "reason": "weather_opt_in disabled"}

    latitude = plant.latitude
    longitude = plant.longitude

    if latitude is None or longitude is None:
        coords = WeatherAPIClient.geocode_location(plant.location)
        if coords is None:
            return {"status": "skipped", "reason": "unable to geocode location"}
        latitude = coords.latitude
        longitude = coords.longitude
        plant.latitude = latitude
        plant.longitude = longitude
        plant.location_timezone = coords.timezone
        plant.save(update_fields=["latitude", "longitude", "location_timezone"])

    summary = WeatherAPIClient.fetch_forecast_summary(latitude, longitude, plant.location_timezone or "auto")
    location_key = build_location_key(latitude, longitude)

    snapshot = WeatherSnapshot.objects.create(
        location_key=location_key,
        latitude=latitude,
        longitude=longitude,
        timezone=summary["timezone"],
        next24h_rain_prob_max=summary["next24h_rain_prob_max"],
        next24h_rain_mm_sum=summary["next24h_rain_mm_sum"],
        next48h_temp_max=summary["next48h_temp_max"],
        next48h_temp_min=summary["next48h_temp_min"],
        frost_risk=summary["frost_risk"],
        heatwave_risk=summary["heatwave_risk"],
        provider=summary["provider"],
        payload=summary["payload"],
        forecast_at=summary["forecast_at"],
        expires_at=summary["expires_at"],
    )
    return {"status": "ok", "plant_id": plant.id, "snapshot_id": snapshot.id}


@shared_task(bind=True, autoretry_for=(Exception,), retry_backoff=True, max_retries=3)
def evaluate_smart_reminders(self):
    plants = Plant.objects.filter(weather_opt_in=True).select_related("user")
    processed = 0

    for plant in plants:
        if plant.latitude is None or plant.longitude is None:
            sync_weather_snapshot_for_plant.delay(plant.id)
            continue

        location_key = build_location_key(plant.latitude, plant.longitude)
        snapshot = (
            WeatherSnapshot.objects.filter(location_key=location_key, expires_at__gte=timezone.now())
            .order_by("-forecast_at")
            .first()
        )

        if snapshot is None:
            sync_weather_snapshot_for_plant.delay(plant.id)
            continue

        apply_weather_to_plant_reminders(plant, snapshot)
        processed += 1

    return {"status": "ok", "processed": processed}


@shared_task
def dispatch_smart_notifications():
    sent = dispatch_unsent_smart_events(limit=200)
    return {"status": "ok", "sent": sent}


@shared_task(bind=True, autoretry_for=(Exception,), retry_backoff=True, max_retries=3)
def recompute_plant_health_score(self, plant_id: int, window_days: int = 30):
    plant = Plant.objects.get(id=plant_id)
    snapshot = compute_and_store_plant_health(plant, window_days=window_days)
    return {"status": "ok", "plant_id": plant.id, "score": snapshot.score, "snapshot_id": snapshot.id}


@shared_task(bind=True, autoretry_for=(Exception,), retry_backoff=True, max_retries=3)
def recompute_all_health_scores(self, window_days: int = 30):
    plants = Plant.objects.select_related("user").all()
    processed = 0
    for plant in plants:
        compute_and_store_plant_health(plant, window_days=window_days)
        processed += 1
    return {"status": "ok", "processed": processed}


@shared_task(bind=True, autoretry_for=(Exception,), retry_backoff=True, max_retries=3)
def sync_assistant_expert_tips(self):
    created = 0
    for post in ExpertPost.objects.all()[:300]:
        title = (post.title or "").strip()
        content = (post.content or "").strip()
        if not title or not content:
            continue

        tip, was_created = AssistantExpertTip.objects.get_or_create(
            source="expert_post",
            title=title,
            defaults={
                "content": content,
                "tags": ["expert_post"],
                "source_quality": 0.8,
                "is_active": True,
            },
        )
        if not was_created and tip.content != content:
            tip.content = content
            tip.save(update_fields=["content"])
        if was_created:
            created += 1

    return {"status": "ok", "created": created}
