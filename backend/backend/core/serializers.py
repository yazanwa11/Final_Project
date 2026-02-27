from rest_framework import serializers
from django.contrib.auth.models import User
from .models import Plant ,CareLog,Notification,ExpertPost


# --- Users ---
class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "username", "email", "password"]
        extra_kwargs = {"password": {"write_only": True}}

    def create(self, validated_data):
        return User.objects.create_user(
            username=validated_data["username"],
            email=validated_data["email"],
            password=validated_data["password"]
        )

# --- Plants ---

from rest_framework import serializers
from .models import Plant



from rest_framework import serializers
from datetime import timedelta
from django.utils import timezone
from .models import Plant

# serializers.py
from rest_framework import serializers
from .models import Plant
from datetime import timedelta

class PlantSerializer(serializers.ModelSerializer):
    next_watering_date = serializers.SerializerMethodField(read_only=True)
    next_sunlight_date = serializers.SerializerMethodField(read_only=True)

    # Output for the app (always a URL string)
    image = serializers.SerializerMethodField(read_only=True)

    # Input fields
    image_file = serializers.ImageField(write_only=True, required=False, allow_null=True)
    image_url = serializers.URLField(required=False, allow_null=True)

    class Meta:
        model = Plant
        fields = [
            "id","name","category","location","planting_date",
            "image","image_file","image_url",
            "created_at","watering_interval","sunlight_interval",
            "last_watered","last_sunlight",
            "latitude","longitude","location_timezone","weather_opt_in",
            "dynamic_watering_interval","last_weather_adjusted_at",
            "next_watering_date","next_sunlight_date",
        ]
        read_only_fields = [
            "id","created_at","last_watered","last_sunlight","image",
            "next_watering_date","next_sunlight_date","location_timezone","last_weather_adjusted_at"
        ]

    def create(self, validated_data):
        image_file = validated_data.pop("image_file", None)
        plant = super().create(validated_data)
        if image_file:
            plant.image = image_file
            plant.save(update_fields=["image"])
        return plant

    def update(self, instance, validated_data):
        image_file = validated_data.pop("image_file", None)
        instance = super().update(instance, validated_data)
        if image_file:
            instance.image = image_file
            instance.save(update_fields=["image"])
        return instance

    def get_image(self, obj):
        request = self.context.get("request")
        if obj.image and hasattr(obj.image, "url"):
            return request.build_absolute_uri(obj.image.url) if request else obj.image.url
        if obj.image_url:
            return obj.image_url
        return None

    def get_next_watering_date(self, obj):
        if not obj.watering_interval: return None
        base = obj.last_watered or obj.planting_date
        return base + timedelta(days=obj.watering_interval) if base else None

    def get_next_sunlight_date(self, obj):
        if not obj.sunlight_interval: return None
        base = obj.last_sunlight or obj.planting_date
        return base + timedelta(days=obj.sunlight_interval) if base else None



class MeSerializer(serializers.ModelSerializer):
    role = serializers.CharField(source="profile.role", read_only=True)
    avatar = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = User
        fields = ["id", "username", "email", "role", "avatar"]

    def get_avatar(self, obj):
        request = self.context.get("request")
        if hasattr(obj, "profile") and obj.profile.avatar and hasattr(obj.profile.avatar, "url"):
            return request.build_absolute_uri(obj.profile.avatar.url) if request else obj.profile.avatar.url
        return None





class CareLogSerializer(serializers.ModelSerializer):
    plant_name = serializers.CharField(source="plant.name", read_only=True)

    class Meta:
        model = CareLog
        fields = ["id", "plant", "plant_name", "action", "notes", "date"]
        read_only_fields = ["id", "date"]



class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = ["id", "type", "title", "body", "data", "is_read", "created_at"]


class ExpertPostSerializer(serializers.ModelSerializer):
    author_username = serializers.CharField(source="author.username", read_only=True)
    author_avatar = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = ExpertPost
        fields = ["id", "title", "content", "image_url", "created_at", "author_username", "author_avatar"]

    def get_author_avatar(self, obj):
        request = self.context.get("request")
        if hasattr(obj.author, "profile") and obj.author.profile.avatar and hasattr(obj.author.profile.avatar, "url"):
            return request.build_absolute_uri(obj.author.profile.avatar.url) if request else obj.author.profile.avatar.url
        return None
    
from .models import ExpertInquiry
from .models import Prediction, WeatherSnapshot, SmartReminderEvent, PlantHealthSnapshot
from PIL import Image

class ExpertInquirySerializer(serializers.ModelSerializer):
    user_username = serializers.CharField(source="user.username", read_only=True)

    class Meta:
        model = ExpertInquiry
        fields = [
            "id",
            "user_username",
            "plant_name",
            "question",
            "status",
            "answer",
            "answered_at",
            "created_at",
        ]
        read_only_fields = ["id", "user_username", "status", "answer", "answered_at", "created_at"]


class PredictionCreateSerializer(serializers.ModelSerializer):
    plant_id = serializers.IntegerField(required=False, allow_null=True, write_only=True)

    class Meta:
        model = Prediction
        fields = ["id", "plant_id", "image", "status", "created_at"]
        read_only_fields = ["id", "status", "created_at"]

    def validate_image(self, image):
        max_size = 8 * 1024 * 1024
        if image.size > max_size:
            raise serializers.ValidationError("Image is too large. Maximum allowed size is 8MB.")

        allowed_types = {"image/jpeg", "image/png", "image/webp"}
        content_type = getattr(image, "content_type", None)
        if content_type and content_type.lower() not in allowed_types:
            raise serializers.ValidationError("Only JPEG, PNG, or WEBP images are allowed.")

        try:
            img = Image.open(image)
            img.verify()
            image.seek(0)
        except Exception:
            raise serializers.ValidationError("Uploaded file is not a valid image.")

        return image

    def validate_plant_id(self, plant_id):
        if plant_id is None:
            return None

        request = self.context["request"]
        if not Plant.objects.filter(id=plant_id, user=request.user).exists():
            raise serializers.ValidationError("Plant not found or not owned by current user.")
        return plant_id

    def create(self, validated_data):
        plant_id = validated_data.pop("plant_id", None)
        plant = Plant.objects.filter(id=plant_id).first() if plant_id else None
        return Prediction.objects.create(
            user=self.context["request"].user,
            plant=plant,
            **validated_data,
        )


class PredictionSerializer(serializers.ModelSerializer):
    disease_name = serializers.CharField(source="disease.display_name", read_only=True)
    image_url = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Prediction
        fields = [
            "id",
            "status",
            "image_url",
            "disease_name",
            "confidence_score",
            "treatment_recommendation",
            "urgency_level",
            "model_version",
            "raw_topk",
            "failure_reason",
            "created_at",
            "completed_at",
        ]

    def get_image_url(self, obj):
        request = self.context.get("request")
        if obj.image and hasattr(obj.image, "url"):
            return request.build_absolute_uri(obj.image.url) if request else obj.image.url
        return None


class WeatherSnapshotSerializer(serializers.ModelSerializer):
    class Meta:
        model = WeatherSnapshot
        fields = [
            "id",
            "location_key",
            "timezone",
            "next24h_rain_prob_max",
            "next24h_rain_mm_sum",
            "next48h_temp_max",
            "next48h_temp_min",
            "frost_risk",
            "heatwave_risk",
            "forecast_at",
            "expires_at",
        ]


class SmartReminderEventSerializer(serializers.ModelSerializer):
    plant_name = serializers.CharField(source="plant.name", read_only=True)

    class Meta:
        model = SmartReminderEvent
        fields = [
            "id",
            "plant",
            "plant_name",
            "event_type",
            "severity",
            "decision_reason",
            "effective_from",
            "effective_to",
            "is_sent",
            "created_at",
        ]


class PlantHealthSnapshotSerializer(serializers.ModelSerializer):
    plant_name = serializers.CharField(source="plant.name", read_only=True)

    class Meta:
        model = PlantHealthSnapshot
        fields = [
            "id",
            "plant",
            "plant_name",
            "score",
            "window_days",
            "watering_subscore",
            "fertilizing_subscore",
            "disease_subscore",
            "growth_subscore",
            "missed_subscore",
            "version",
            "explanation_json",
            "created_at",
        ]
