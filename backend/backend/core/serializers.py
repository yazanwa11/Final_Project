from rest_framework import serializers
from django.contrib.auth.models import User
from .models import Plant ,CareLog


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



class PlantSerializer(serializers.ModelSerializer):
    class Meta:
        model = Plant
        fields = ['id', 'name', 'category', 'location', 'planting_date', 'image', 'created_at']
        read_only_fields = ['id', 'created_at']

    def to_representation(self, instance):
        data = super().to_representation(instance)
        request = self.context.get('request')
        if instance.image and hasattr(instance.image, 'url'):
            data['image'] = request.build_absolute_uri(instance.image.url)
        return data



class CareLogSerializer(serializers.ModelSerializer):
    plant_name = serializers.CharField(source="plant.name", read_only=True)

    class Meta:
        model = CareLog
        fields = ["id", "plant", "plant_name", "action", "notes", "date"]
        read_only_fields = ["id", "date"]

