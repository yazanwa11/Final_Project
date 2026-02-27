from __future__ import annotations

from dataclasses import dataclass
from datetime import timedelta
from typing import Optional

from django.utils import timezone

from .models import Plant, Reminder, SmartReminderEvent, WeatherSnapshot, Notification


@dataclass
class SmartDecision:
    skip_watering: bool
    send_heatwave: bool
    send_frost: bool
    recommended_interval_days: int
    reason: str


class WeatherDecisionEngine:
    RAIN_PROB_SKIP = 0.60
    RAIN_MM_SKIP = 2.0
    HEATWAVE_C = 35.0
    FROST_C = 2.0

    @classmethod
    def evaluate(cls, base_interval: int, snapshot: WeatherSnapshot) -> SmartDecision:
        rain_prob = snapshot.next24h_rain_prob_max
        rain_mm = snapshot.next24h_rain_mm_sum
        tmax = snapshot.next48h_temp_max
        tmin = snapshot.next48h_temp_min

        skip = rain_prob >= cls.RAIN_PROB_SKIP or rain_mm >= cls.RAIN_MM_SKIP
        heat = tmax >= cls.HEATWAVE_C
        frost = tmin <= cls.FROST_C

        recommended = base_interval
        if tmax >= 32:
            recommended = max(1, base_interval - 1)
        elif tmax <= 10:
            recommended = min(14, base_interval + 1)

        reason = f"rain_prob={rain_prob:.2f}, rain_mm={rain_mm:.2f}, tmax={tmax:.1f}, tmin={tmin:.1f}"
        return SmartDecision(skip, heat, frost, recommended, reason)


def create_event(plant: Plant, event_type: str, severity: str, reason: str, days_valid: int = 1) -> SmartReminderEvent:
    now = timezone.now()
    return SmartReminderEvent.objects.create(
        plant=plant,
        user=plant.user,
        event_type=event_type,
        severity=severity,
        decision_reason=reason,
        effective_from=now,
        effective_to=now + timedelta(days=days_valid),
    )


def apply_weather_to_plant_reminders(plant: Plant, snapshot: Optional[WeatherSnapshot]) -> Optional[SmartDecision]:
    if snapshot is None or not plant.weather_opt_in:
        return None

    base_interval = plant.watering_interval or 3
    decision = WeatherDecisionEngine.evaluate(base_interval, snapshot)

    if plant.dynamic_watering_interval != decision.recommended_interval_days:
        plant.dynamic_watering_interval = decision.recommended_interval_days
        plant.last_weather_adjusted_at = timezone.now()
        plant.save(update_fields=["dynamic_watering_interval", "last_weather_adjusted_at"])
        create_event(plant, "interval_adjusted", "low", decision.reason)

    if decision.send_heatwave:
        create_event(plant, "heatwave_alert", "high", decision.reason)

    if decision.send_frost:
        create_event(plant, "frost_warning", "high", decision.reason)

    watering_reminders = Reminder.objects.filter(plant=plant, user=plant.user, type="Watering")
    for reminder in watering_reminders:
        if decision.skip_watering:
            reminder.next_run = reminder.next_run + timedelta(days=1)
            reminder.save(update_fields=["next_run"])
            create_event(plant, "watering_skipped_rain", "medium", decision.reason)
        else:
            reminder.frequency_days = decision.recommended_interval_days
            reminder.save(update_fields=["frequency_days"])

    return decision


def dispatch_unsent_smart_events(limit: int = 200) -> int:
    events = SmartReminderEvent.objects.filter(is_sent=False).select_related("plant", "user")[:limit]
    count = 0
    for event in events:
        title_map = {
            "watering_skipped_rain": "Watering skipped due to expected rain ☔",
            "heatwave_alert": "Heatwave alert for your plant 🌡️",
            "frost_warning": "Frost warning for your plant ❄️",
            "interval_adjusted": "Watering interval adjusted automatically",
        }
        Notification.objects.create(
            user=event.user,
            type="system",
            title=title_map.get(event.event_type, "Smart reminder update"),
            body=f"{event.plant.name}: {event.decision_reason}",
            data={"plant_id": event.plant_id, "smart_event_id": event.id, "event_type": event.event_type},
        )
        event.is_sent = True
        event.save(update_fields=["is_sent"])
        count += 1
    return count
