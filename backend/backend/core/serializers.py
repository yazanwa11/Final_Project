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
            "next_watering_date","next_sunlight_date",
        ]
        read_only_fields = ["id","created_at","last_watered","last_sunlight","image","next_watering_date","next_sunlight_date"]

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
