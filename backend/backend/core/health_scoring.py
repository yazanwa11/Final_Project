from __future__ import annotations

import math
from dataclasses import dataclass
from datetime import timedelta

from django.utils import timezone

from .models import CareLog, Plant, PlantHealthSnapshot, Prediction, Reminder


@dataclass
class HealthScoreComponents:
    watering: float
    fertilizing: float
    disease: float
    growth: float
    missed: float


class HealthDataAggregator:
    @staticmethod
    def _clamp(value: float, min_value: float = 0.0, max_value: float = 1.0) -> float:
        return max(min_value, min(max_value, value))

    @classmethod
    def watering_subscore(cls, plant: Plant, window_days: int) -> float:
        since = timezone.now() - timedelta(days=window_days)
        expected_interval = max(1, int(plant.dynamic_watering_interval or plant.watering_interval or 3))
        expected = max(1.0, window_days / expected_interval)
        actual = float(
            CareLog.objects.filter(
                user=plant.user,
                plant=plant,
                date__gte=since,
                action__icontains="water",
            ).count()
        )
        return cls._clamp(1.0 - abs(actual - expected) / (expected + 1e-6))

    @classmethod
    def fertilizing_subscore(cls, plant: Plant, window_days: int) -> float:
        since = timezone.now() - timedelta(days=window_days)
        expected = max(1.0, window_days / 30.0)
        actual = float(
            CareLog.objects.filter(
                user=plant.user,
                plant=plant,
                date__gte=since,
                action__icontains="fertiliz",
            ).count()
        )
        return cls._clamp(1.0 - abs(actual - expected) / (expected + 1e-6))

    @classmethod
    def disease_subscore(cls, plant: Plant, window_days: int) -> float:
        since = timezone.now() - timedelta(days=window_days)
        predictions = Prediction.objects.filter(user=plant.user, plant=plant, status="done", created_at__gte=since)

        severity_map = {
            "low": 0.2,
            "medium": 0.5,
            "high": 0.8,
            "critical": 1.0,
        }

        penalty = 0.0
        now = timezone.now()
        for prediction in predictions:
            urgency = (prediction.urgency_level or "low").lower()
            severity = severity_map.get(urgency, 0.2)
            days_old = max(0.0, (now - prediction.created_at).total_seconds() / 86400.0)
            penalty += severity * math.exp(-days_old / 14.0)

        return cls._clamp(1.0 - min(1.0, penalty))

    @classmethod
    def growth_subscore(cls, plant: Plant, window_days: int) -> float:
        since = timezone.now() - timedelta(days=window_days)
        predictions = Prediction.objects.filter(user=plant.user, plant=plant, status="done", created_at__gte=since)

        total = predictions.count()
        if total == 0:
            return 0.6 if plant.image or plant.image_url else 0.5

        healthy_count = predictions.filter(disease__code="healthy").count()
        healthy_ratio = healthy_count / total
        return cls._clamp(0.3 + 0.7 * healthy_ratio)

    @classmethod
    def missed_subscore(cls, plant: Plant, window_days: int) -> float:
        reminders = Reminder.objects.filter(user=plant.user, plant=plant)
        if not reminders.exists():
            return 1.0

        now = timezone.now()
        scheduled = 0.0
        missed = 0.0

        for reminder in reminders:
            freq = max(1, int(reminder.frequency_days or 1))
            scheduled += max(1.0, window_days / freq)
            if reminder.next_run < now - timedelta(days=1):
                missed += 1.0

        return cls._clamp(1.0 - min(1.0, missed / (scheduled + 1e-6)))


class HealthScoringEngine:
    VERSION = "health_v1"
    WEIGHTS = {
        "watering": 0.25,
        "fertilizing": 0.15,
        "disease": 0.25,
        "growth": 0.20,
        "missed": 0.15,
    }

    @classmethod
    def compute_components(cls, plant: Plant, window_days: int = 30) -> HealthScoreComponents:
        return HealthScoreComponents(
            watering=HealthDataAggregator.watering_subscore(plant, window_days),
            fertilizing=HealthDataAggregator.fertilizing_subscore(plant, window_days),
            disease=HealthDataAggregator.disease_subscore(plant, window_days),
            growth=HealthDataAggregator.growth_subscore(plant, window_days),
            missed=HealthDataAggregator.missed_subscore(plant, window_days),
        )

    @classmethod
    def compute_score(cls, components: HealthScoreComponents) -> int:
        raw = 100.0 * (
            components.watering * cls.WEIGHTS["watering"]
            + components.fertilizing * cls.WEIGHTS["fertilizing"]
            + components.disease * cls.WEIGHTS["disease"]
            + components.growth * cls.WEIGHTS["growth"]
            + components.missed * cls.WEIGHTS["missed"]
        )
        return int(round(max(0.0, min(100.0, raw))))


def compute_and_store_plant_health(plant: Plant, window_days: int = 30) -> PlantHealthSnapshot:
    components = HealthScoringEngine.compute_components(plant, window_days=window_days)
    score = HealthScoringEngine.compute_score(components)

    explanation = {
        "weights": HealthScoringEngine.WEIGHTS,
        "components": {
            "watering": round(components.watering, 4),
            "fertilizing": round(components.fertilizing, 4),
            "disease": round(components.disease, 4),
            "growth": round(components.growth, 4),
            "missed": round(components.missed, 4),
        },
    }

    snapshot = PlantHealthSnapshot.objects.create(
        plant=plant,
        user=plant.user,
        score=score,
        window_days=window_days,
        watering_subscore=components.watering,
        fertilizing_subscore=components.fertilizing,
        disease_subscore=components.disease,
        growth_subscore=components.growth,
        missed_subscore=components.missed,
        version=HealthScoringEngine.VERSION,
        explanation_json=explanation,
    )
    return snapshot
