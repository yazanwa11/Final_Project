from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Plant, WeatherSnapshot, SmartReminderEvent
from .serializers import WeatherSnapshotSerializer, SmartReminderEventSerializer
from .smart_reminders import apply_weather_to_plant_reminders
from .tasks import sync_weather_snapshot_for_plant, evaluate_smart_reminders
from .weather_service import build_location_key, WeatherAPIClient


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def trigger_weather_sync_for_plant(request, plant_id: int):
    try:
        plant = Plant.objects.get(id=plant_id, user=request.user)
    except Plant.DoesNotExist:
        return Response({"detail": "Plant not found"}, status=404)

    try:
        task = sync_weather_snapshot_for_plant.delay(plant.id)
        return Response({"status": "queued", "task_id": task.id, "mode": "async"})
    except Exception:
        result = sync_weather_snapshot_for_plant.apply(args=[plant.id]).result
        return Response({"status": "completed", "mode": "sync", "result": result})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def trigger_weather_evaluation(request):
    try:
        task = evaluate_smart_reminders.delay()
        return Response({"status": "queued", "task_id": task.id, "mode": "async"})
    except Exception:
        result = evaluate_smart_reminders.apply(args=[]).result
        return Response({"status": "completed", "mode": "sync", "result": result})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def plant_weather_status(request, plant_id: int):
    try:
        plant = Plant.objects.get(id=plant_id, user=request.user)
    except Plant.DoesNotExist:
        return Response({"detail": "Plant not found"}, status=404)

    snapshot = None
    if plant.latitude is not None and plant.longitude is not None:
        location_key = build_location_key(plant.latitude, plant.longitude)
        snapshot = (
            WeatherSnapshot.objects.filter(location_key=location_key)
            .order_by("-forecast_at")
            .first()
        )

    if snapshot and snapshot.expires_at >= timezone.now():
        apply_weather_to_plant_reminders(plant, snapshot)

    recent_events = SmartReminderEvent.objects.filter(plant=plant).order_by("-created_at")[:20]

    return Response(
        {
            "plant_id": plant.id,
            "plant_name": plant.name,
            "weather_opt_in": plant.weather_opt_in,
            "base_watering_interval": plant.watering_interval,
            "dynamic_watering_interval": plant.dynamic_watering_interval,
            "snapshot": WeatherSnapshotSerializer(snapshot).data if snapshot else None,
            "events": SmartReminderEventSerializer(recent_events, many=True).data,
        }
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_forecast(request):
    """Get 3-day weather forecast for user's location or specified location"""
    location = request.GET.get("location", "Tel Aviv")  # Default location
    
    try:
        coords = WeatherAPIClient.geocode_location(location)
        if not coords:
            return Response({"detail": "Location not found"}, status=404)
        
        forecast_data = WeatherAPIClient.fetch_forecast_summary(
            coords.latitude, 
            coords.longitude, 
            coords.timezone
        )
        
        # Parse daily data for 3 days
        payload = forecast_data.get("payload", {})
        daily = payload.get("daily", {})
        dates = daily.get("time", [])
        tmax = daily.get("temperature_2m_max", [])
        tmin = daily.get("temperature_2m_min", [])
        rain_sum = daily.get("precipitation_sum", [])
        rain_prob = daily.get("precipitation_probability_max", [])
        
        days = []
        for i in range(min(3, len(dates))):
            days.append({
                "date": dates[i] if i < len(dates) else None,
                "temp_max": tmax[i] if i < len(tmax) else None,
                "temp_min": tmin[i] if i < len(tmin) else None,
                "precipitation_sum": rain_sum[i] if i < len(rain_sum) else 0,
                "precipitation_probability": rain_prob[i] if i < len(rain_prob) else 0,
            })
        
        return Response({
            "location": location,
            "latitude": coords.latitude,
            "longitude": coords.longitude,
            "timezone": coords.timezone,
            "days": days,
        })
    
    except Exception as e:
        return Response({"detail": str(e)}, status=500)
